import { resolveEmployee, resolveSales } from "./employee";

export const ALLOWED_CATEGORIES = ["Alat", "Setup", "FO Prepaid"] as const;
export type AllowedCategory = (typeof ALLOWED_CATEGORIES)[number];

// `type` values written by the new-customer path vs. the old-customer
// (recurring) path — used to scope re-runs so one job's delete+insert
// never touches the other job's rows for the same period.
export const NEW_CUSTOMER_TYPES = ["new", "upgrade", "prorate"];
export const RECURRING_TYPES = ["recurring"];

// For "Alat"/"Setup" rows, only service names starting with one of these
// are kept — anything else in those two categories is skipped.
const ALAT_SETUP_SERVICE_PREFIXES = [
  "broadband fo home",
  "nusafiber",
  "nusaselecta",
];

type Scalar = string | number | Date | null | undefined;

export function parseNumber(value: Scalar): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isNaN(value) ? null : value;
  if (value instanceof Date) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(/,/g, ""));
  return Number.isNaN(parsed) ? null : parsed;
}

export function parseIntOrNull(value: Scalar): number | null {
  const num = parseNumber(value);
  return num === null ? null : Math.trunc(num);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function parseDate(value: Scalar): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function isAllowedServiceName(
  category: string | null | undefined,
  serviceName: Scalar,
): boolean {
  if (category !== "Alat" && category !== "Setup") return true;

  const normalized = (serviceName ? String(serviceName) : "").trim().toLowerCase();
  return ALAT_SETUP_SERVICE_PREFIXES.some((prefix) =>
    normalized.startsWith(prefix),
  );
}

function resolveSubscription(
  category: AllowedCategory,
  fields: {
    dpp: Scalar;
    prorate: Scalar;
    upgrade: Scalar;
    biayaAlat: Scalar;
    setup: Scalar;
  },
): { subscription: number | null; type: "new" | "upgrade" | "prorate" } {
  if (category === "FO Prepaid") {
    const dpp = parseNumber(fields.dpp);
    if (dpp !== null) {
      return { subscription: dpp, type: "new" };
    }

    const prorateEmpty = parseNumber(fields.prorate) === null;
    if (prorateEmpty) {
      return { subscription: parseNumber(fields.upgrade), type: "upgrade" };
    }

    return { subscription: parseNumber(fields.prorate), type: "prorate" };
  }

  if (category === "Alat") {
    return { subscription: parseNumber(fields.biayaAlat), type: "new" };
  }

  // Setup
  return { subscription: parseNumber(fields.setup), type: "new" };
}

export type RawSnapshotInput = {
  category: string | null | undefined;
  paid: Scalar;
  namaService: Scalar;
  dpp: Scalar;
  prorate: Scalar;
  upgrade: Scalar;
  biayaAlat: Scalar;
  setup: Scalar;
  sales: Scalar;
  managerSales: Scalar;
  aiInvoice: Scalar;
  aiReceipt: Scalar;
  cid: Scalar;
  namaCustomer: Scalar;
  company: Scalar;
  csid: Scalar;
  account: Scalar;
  vendor: Scalar;
  lineRental: Scalar;
  paidDate: Scalar;
  bulan: Scalar;
  telatBulan: Scalar;
  biayaReferral: Scalar;
  referralName: Scalar;
};

/**
 * Applies the category/paid/service-name filters and the subscription+type
 * derivation shared by every snapshot source (sheet-based or DB-based).
 * Returns the ordered values for the snapshots INSERT, or null if the row
 * should be skipped.
 */
export function buildSnapshotValues(
  input: RawSnapshotInput,
  employeeMap: Map<string, string>,
): any[] | null {
  const category = input.category?.toString().trim() as
    | AllowedCategory
    | undefined;
  const paid = input.paid?.toString().trim();

  if (!category || !ALLOWED_CATEGORIES.includes(category) || paid !== "1") {
    return null;
  }

  if (!isAllowedServiceName(category, input.namaService)) {
    return null;
  }

  const { subscription, type } = resolveSubscription(category, {
    dpp: input.dpp,
    prorate: input.prorate,
    upgrade: input.upgrade,
    biayaAlat: input.biayaAlat,
    setup: input.setup,
  });

  const { value: sales, skip: skipSales } = resolveSales(
    input.sales?.toString(),
    employeeMap,
  );
  if (skipSales) return null;

  const manager = resolveEmployee(input.managerSales?.toString(), employeeMap);

  return assembleValues(input, category, sales, manager, subscription, type);
}

function assembleValues(
  input: RawSnapshotInput,
  category: string | null | undefined,
  sales: string | null,
  manager: string | null,
  subscription: number | null,
  type: "new" | "upgrade" | "prorate" | "recurring",
): any[] {
  return [
    parseIntOrNull(input.aiInvoice),
    parseIntOrNull(input.aiReceipt),
    input.cid?.toString().trim() ?? null,
    input.namaCustomer?.toString().trim() || null,
    input.company?.toString().trim() || null,
    parseIntOrNull(input.csid),
    input.account?.toString().trim() || null,
    input.namaService?.toString().trim() || null,
    category,
    sales,
    manager,
    input.vendor?.toString().trim() || null,
    subscription,
    parseNumber(input.lineRental),
    parseDate(input.paidDate),
    parseIntOrNull(input.bulan),
    parseIntOrNull(input.telatBulan) ?? 0,
    type,
    parseNumber(input.biayaReferral) ?? 0,
    input.referralName?.toString().trim() || null,
  ];
}

/**
 * Old-customer variant: no category allowlist (every category is kept),
 * subscription comes straight from DPP, and type is always "recurring".
 * Paid gate, the Alat/Setup service-name prefix rule, and sales/manager
 * resolution stay identical to the new-customer path.
 */
export function buildRecurringSnapshotValues(
  input: RawSnapshotInput,
  employeeMap: Map<string, string>,
): any[] | null {
  const category = input.category?.toString().trim() || null;
  const paid = input.paid?.toString().trim();

  if (paid !== "1") return null;

  if (!isAllowedServiceName(category, input.namaService)) {
    return null;
  }

  const { value: sales, skip: skipSales } = resolveSales(
    input.sales?.toString(),
    employeeMap,
  );
  if (skipSales) return null;

  const manager = resolveEmployee(input.managerSales?.toString(), employeeMap);

  return assembleValues(
    input,
    category,
    sales,
    manager,
    parseNumber(input.dpp),
    "recurring",
  );
}

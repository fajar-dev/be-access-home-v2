import { parseDate, parseIntOrNull, parseNumber } from "../helper/parse.helper";
import type { RawSnapshotInput, Scalar, SnapshotType } from "../interface/snapshot.interface";

// For "Alat"/"Setup" rows (from either domain), only service names
// starting with one of these are kept — anything else in those two
// categories is skipped.
const ALAT_SETUP_SERVICE_PREFIXES = [
  "broadband fo home",
  "nusafiber",
  "nusaselecta",
];

export function isAllowedServiceName(
  category: string | null | undefined,
  serviceName: Scalar,
): boolean {
  if (category !== "Alat" && category !== "Setup") return true;

  const normalized = (serviceName ? String(serviceName) : "").trim().toLowerCase();
  return ALAT_SETUP_SERVICE_PREFIXES.some((prefix) =>
    normalized.startsWith(prefix),
  );
}

/** Assembles the ordered values for a snapshots INSERT row (column order must match snapshot.repository.ts). */
export function assembleValues(
  input: RawSnapshotInput,
  category: string | null | undefined,
  sales: string | null,
  manager: string | null,
  subscription: number | null,
  type: SnapshotType,
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
    input.businessOperation?.toString().trim() || null,
  ];
}

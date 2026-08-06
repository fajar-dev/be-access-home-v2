import { nisQuery } from "./nisDb";
import { SQL_INVOICE_RECEIPT, SQL_ACCOUNT, SQL_SERVICE } from "./billingQueries";
import type { RawSnapshotInput } from "./snapshotRow";

// Stock-invoice codes that represent a setup charge rather than equipment.
const SETUP_CODE = [
  "SETUP000",
  "JSTRKKBL",
  "TARIKKBL",
  "TRKKBLDT",
  "INSTALWF",
  "TRKKBLFO",
  "MNTNCE00",
  "JSSETTAP",
  "TARKBLFO",
  "TARIKKBV",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toSqlDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * The billing cycle runs the 26th of the previous month through the 25th
 * of the target period, mirroring the Apps Script's getStartDate/getEndDate.
 */
export function getDateRangeForPeriod(period: string): { start: Date; end: Date } {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(4, 6));

  const start = new Date(year, month - 2, 26, 0, 0, 0, 0);
  const end = new Date(year, month - 1, 25, 23, 59, 59, 0);

  return { start, end };
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isNaN(num) ? null : num;
}

function mapCategory(sg: string | null, serviceName: string | null): string {
  const name = (serviceName ?? "").toLowerCase();
  switch (sg) {
    case "IC":
    case "II":
    case "WL":
    case "VB":
      return name.includes("bandwidth on demand") ? "BOD" : "Wireless";
    case "FD":
      return name.includes("bandwidth on demand") ? "BOD" : "FO";
    case "FB":
      return "FO";
    case "FBP":
      return "FO Prepaid";
    case "ST":
      return "Setup";
    case "Alat":
      return "Alat";
    case "SA":
      if (name.includes("cicilan")) return "Cicilan";
      if (name === "biaya rental cpe") return "Rental";
      return "Lain-lain";
    case "GS":
    case "SV":
    case "WH":
    case "DO":
    case "CM":
    case "ZH":
    case "NW":
      return "Digital Business";
    default:
      return "Lain-lain";
  }
}

function getLateInMonth(
  dueDate: unknown,
  paymentDateRaw: unknown,
): number | null {
  if (paymentDateRaw === null || paymentDateRaw === undefined) return null;
  const paymentDate = new Date(paymentDateRaw as any);
  if (Number.isNaN(paymentDate.getTime())) return null;
  if (dueDate === null || dueDate === undefined) return null;
  const expDate = new Date(dueDate as any);
  if (Number.isNaN(expDate.getTime())) return null;

  let month = 0;
  month += paymentDate.getFullYear() * 12 + paymentDate.getMonth() + 1;
  month -= expDate.getFullYear() * 12 + expDate.getMonth() + 2;
  month += paymentDate.getDate() > expDate.getDate() ? 1 : 0;

  const result = Math.max(month, 0);
  return result || null;
}

type InvoiceRow = {
  CID: string;
  CSID: number | null;
  SG: string;
  "Tanggal Jatuh Tempo": unknown;
  "Period Start": string;
  "Period End": string;
  Bulan: number;
  DPP: unknown;
  "Tanggal Input Pembayaran": unknown;
  "Tanggal Transaksi Pembayaran": unknown;
  "New Subscription": unknown;
  "Invoice Prorata": unknown;
  Code: string | null;
  "Is Upgrade": number | null;
  "Line Rental": unknown;
  "AI Invoice": number;
  "AI Receipt": number | null;
};

type AccountRow = {
  CID: string;
  CSID: number | null;
  "Nama Customer": string | null;
  Company: string | null;
  Account: string | null;
  "Nama Service": string | null;
  "Bandwidth (Mbps)": number | null;
  Vendor: string | null;
  Sales: string | null;
  "Manager Sales": string | null;
  CustStatus: string | null;
  "Branch ID": string | null;
};

type ServiceRow = {
  AI: number;
  ServiceType: string | null;
};

export async function fetchBillingSnapshotInputs(
  period: string,
): Promise<RawSnapshotInput[]> {
  const { start, end } = getDateRangeForPeriod(period);
  const startStr = toSqlDate(start);
  const endStr = toSqlDate(end);

  // Run sequentially — these are heavy queries (tens of thousands of rows)
  // and running them concurrently on the pool has been observed to trip a
  // "Connection lost" error against this server.
  const invoiceRows = await nisQuery<InvoiceRow[]>(SQL_INVOICE_RECEIPT, [
    startStr, endStr, startStr, endStr,
    startStr, endStr, startStr, endStr,
    startStr, endStr, startStr, endStr,
  ]);
  const accountRows = await nisQuery<AccountRow[]>(SQL_ACCOUNT);
  const serviceRows = await nisQuery<ServiceRow[]>(SQL_SERVICE, [
    startStr, endStr, startStr, endStr,
  ]);

  const accountByCsid = new Map<number, AccountRow>();
  const accountByCid = new Map<string, AccountRow>();
  for (const row of accountRows) {
    if (row.CSID) accountByCsid.set(row.CSID, row);
    accountByCid.set(row.CID, row);
  }

  const serviceLabelByAi = new Map<number, string>();
  for (const row of serviceRows) {
    if (row.ServiceType) serviceLabelByAi.set(row.AI, row.ServiceType);
  }

  const results: RawSnapshotInput[] = [];

  for (const inv of invoiceRows) {
    const account =
      (inv.CSID && accountByCsid.get(inv.CSID)) || accountByCid.get(inv.CID);

    let late: number | null = null;
    if (account && (account.CustStatus !== "BL" || inv.SG === "ST" || inv.SG === "Alat")) {
      late = getLateInMonth(inv["Tanggal Jatuh Tempo"], inv["Tanggal Transaksi Pembayaran"]);
    }

    let isPaid = 0;
    let inputPaymentDate: unknown = null;
    let aiReceipt: number | null = null;
    const transPaymentDateRaw = inv["Tanggal Transaksi Pembayaran"];
    if (transPaymentDateRaw !== null && transPaymentDateRaw !== undefined) {
      const paymentDate = new Date(transPaymentDateRaw as any);
      if (!Number.isNaN(paymentDate.getTime()) && paymentDate <= end) {
        isPaid = 1;
        inputPaymentDate = inv["Tanggal Input Pembayaran"];
        aiReceipt = inv["AI Receipt"];
      }
    }

    let serviceLabel = serviceLabelByAi.get(inv["AI Invoice"]) ?? "";
    if (!serviceLabel && account) {
      serviceLabel = account["Nama Service"] ?? "";
    }

    let bulan: number = inv.Bulan;
    if (account?.["Branch ID"] === "028") {
      bulan = 1;
    }

    let sg = inv.SG;
    let dpp = toNumber(inv.DPP);
    let biayaAlat: number | null = null;
    let setup: number | null = null;
    let upgrade: number | null = null;
    let prorate: number | null = null;
    let lineRental = toNumber(inv["Line Rental"]);
    if (lineRental !== null && bulan) lineRental = lineRental / bulan;
    let bandwidth = account?.["Bandwidth (Mbps)"] ?? null;
    let vendor = account?.Vendor ?? null;

    if (sg === "ST") {
      bandwidth = null;
      vendor = null;
      lineRental = null;
      dpp = null;
      setup = toNumber(inv["New Subscription"]);
    }

    if (sg === "Alat") {
      bandwidth = null;
      vendor = null;
      lineRental = null;
      dpp = null;
      if (inv.Code && SETUP_CODE.includes(inv.Code)) {
        setup = toNumber(inv.DPP);
        sg = "ST";
      } else {
        biayaAlat = toNumber(inv.DPP);
      }
    }

    if ((inv["Is Upgrade"] ?? 0) > 0) {
      dpp = null;
      upgrade = toNumber(inv["New Subscription"]);
    }

    if (toNumber(inv["Invoice Prorata"]) === 1) {
      dpp = null;
      prorate = toNumber(inv.DPP);
    }

    const categorySourceName = account?.["Nama Service"] ?? "";
    const category = mapCategory(sg, categorySourceName);

    results.push({
      category,
      paid: isPaid,
      namaService: serviceLabel,
      dpp,
      prorate,
      upgrade,
      biayaAlat,
      setup,
      sales: account?.Sales ?? null,
      managerSales: account?.["Manager Sales"] ?? null,
      aiInvoice: inv["AI Invoice"],
      aiReceipt,
      cid: inv.CID,
      namaCustomer: account?.["Nama Customer"] ?? null,
      company: account?.Company ?? null,
      csid: inv.CSID,
      account: account?.Account ?? null,
      vendor,
      lineRental,
      paidDate: inputPaymentDate as any,
      bulan,
      telatBulan: late,
      biayaReferral: null,
      referralName: null,
    });
  }

  return results;
}

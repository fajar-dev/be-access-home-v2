import { nisQuery } from "./nisDb";
import { SQL_INVOICE_RECEIPT, SQL_ACCOUNT } from "./oldBillingQueries";
import { getDateRangeForPeriod } from "./billingTransform";
import type { RawSnapshotInput } from "./snapshotRow";

const CPE_RENTAL_SERVICE_IDS = [
  "CPERENT",
  "CPESTD",
  "CPEHIGH",
  "CPEPNM",
  "CPESTDPNM",
];

const VPS_SERVICE_IDS = [
  "VPSSG200",
  "VPSSG400",
  "VPS320ID",
  "VPSSG55",
  "VPSSG160GB",
  "VPSSG640",
  "VPSSG1280",
];

const FO_CATEGORIES = ["FO", "FO Prepaid"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toSqlDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isNaN(num) ? null : num;
}

function mapCategory(sg: string | null, serviceId: string | null): string {
  if (serviceId && CPE_RENTAL_SERVICE_IDS.includes(serviceId)) return "CPE Rental";
  if (serviceId && VPS_SERVICE_IDS.includes(serviceId)) return "Digital Business";
  if (serviceId === "GCP") return "Digital Business";

  switch (sg) {
    case "IC":
    case "II":
    case "WL":
    case "VB":
      return "Wireless";
    case "FD":
    case "FB":
    case "PFO":
      return "FO";
    case "FBP":
      return "FO Prepaid";
    case "ST":
      return "Setup";
    case "SA":
      if (serviceId === "CICILALAT") return "Cicilan";
      if (serviceId === "CPERENT") return "Rental";
      return "Lain-lain";
    case "GS":
    case "SV":
    case "WH":
    case "DO":
    case "CM":
    case "ZH":
    case "NW":
    case "NP":
    case "CL":
    case "M3":
      return "Digital Business";
    case "IP":
      return "IP Public";
    case "SL":
    case "SLP":
      return "Starlink";
    default:
      return "Lain-lain";
  }
}

function getLateInMonth(dueDate: unknown, paymentDateRaw: unknown): number | null {
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
  SG: string | null;
  "Tanggal Jatuh Tempo": unknown;
  Bulan: number | null;
  DPP: unknown;
  Paid: number;
  "Tanggal Input Pembayaran": unknown;
  "Tanggal Transaksi Pembayaran": unknown;
  "AI Invoice": number;
  "AI Receipt": number | null;
  "Nama Service": string | null;
  "Line Rental": unknown;
  SID: string | null;
};

type AccountRow = {
  CID: string;
  CSID: number | null;
  "Nama Customer": string | null;
  Company: string | null;
  Account: string | null;
  Vendor: string | null;
  Sales: string | null;
  "Manager Sales": string | null;
};

export async function fetchOldBillingSnapshotInputs(
  period: string,
): Promise<RawSnapshotInput[]> {
  const { start, end } = getDateRangeForPeriod(period);
  const startStr = toSqlDate(start);
  const endStr = toSqlDate(end);

  // Sequential — the billing pool has been observed to drop the connection
  // under concurrent heavy queries (see billingTransform.ts).
  const invoiceRows = await nisQuery<InvoiceRow[]>(SQL_INVOICE_RECEIPT, [
    period,
    startStr, endStr,
    startStr, endStr,
    startStr, endStr,
  ]);
  const accountRows = await nisQuery<AccountRow[]>(SQL_ACCOUNT);

  const accountByCsid = new Map<number, AccountRow>();
  for (const row of accountRows) {
    if (row.CSID) accountByCsid.set(row.CSID, row);
  }

  const results: RawSnapshotInput[] = [];

  for (const inv of invoiceRows) {
    const account = inv.CSID ? accountByCsid.get(inv.CSID) : undefined;
    if (!account) continue;

    const category = mapCategory(inv.SG, inv.SID);
    const isFo = FO_CATEGORIES.includes(category);

    const vendor = isFo ? account.Vendor : null;
    const lineRental = isFo ? toNumber(inv["Line Rental"]) : 0;

    const late = getLateInMonth(
      inv["Tanggal Jatuh Tempo"],
      inv["Tanggal Transaksi Pembayaran"],
    );

    results.push({
      category,
      paid: inv.Paid,
      namaService: inv["Nama Service"],
      dpp: toNumber(inv.DPP),
      prorate: null,
      upgrade: null,
      biayaAlat: null,
      setup: null,
      sales: account.Sales,
      managerSales: account["Manager Sales"],
      aiInvoice: inv["AI Invoice"],
      aiReceipt: inv["AI Receipt"],
      cid: inv.CID,
      namaCustomer: account["Nama Customer"],
      company: account.Company,
      csid: inv.CSID,
      account: account.Account,
      vendor,
      lineRental,
      paidDate: inv["Tanggal Input Pembayaran"] as any,
      bulan: inv.Bulan,
      telatBulan: late,
      biayaReferral: null,
      referralName: null,
    });
  }

  return results;
}

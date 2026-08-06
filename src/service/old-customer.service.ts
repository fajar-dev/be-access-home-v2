import type { GoogleSpreadsheetRow } from "google-spreadsheet";
import { getDateRangeForPeriod } from "../helper/period.helper";
import { parseNumber } from "../helper/parse.helper";
import type { IEmployeeService } from "../interface/employee.interface";
import type {
  IOldCustomerRepository,
  IOldCustomerService,
  OldCustomerAccountRow,
} from "../interface/old-customer.interface";
import type { IServiceCatalogService } from "../interface/service-catalog.interface";
import type { ISnapshotService, RawSnapshotInput } from "../interface/snapshot.interface";

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

function mapBusinessOperation(value: string | null): "Internal" | "Resell" | null {
  if (value === "internal") return "Internal";
  if (value === "resell") return "Resell";
  return null;
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

export class OldCustomerService implements IOldCustomerService {
  // `type` value this domain writes — used to scope replaceForPeriod so a
  // re-run never touches the new-customer rows for the same period.
  static readonly TYPES = ["recurring"];

  constructor(
    private readonly oldCustomerRepository: IOldCustomerRepository,
    private readonly employeeService: IEmployeeService,
    private readonly serviceCatalogService: IServiceCatalogService,
    private readonly snapshotService: ISnapshotService,
  ) {}

  /** Pulls recurring invoice/account rows from the billing DB and shapes them into RawSnapshotInput. */
  async fetchSnapshotInputs(period: string): Promise<RawSnapshotInput[]> {
    const { start, end } = getDateRangeForPeriod(period);
    const startStr = toSqlDate(start);
    const endStr = toSqlDate(end);

    // Sequential — the billing pool has been observed to drop the connection
    // under concurrent heavy queries (see new-customer.service.ts).
    const invoiceRows = await this.oldCustomerRepository.findInvoices([
      period,
      startStr, endStr,
      startStr, endStr,
      startStr, endStr,
    ]);
    const accountRows = await this.oldCustomerRepository.findAccounts();

    const accountByCsid = new Map<number, OldCustomerAccountRow>();
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
        serviceId: inv.SID,
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
        businessOperation:
          category === "Digital Business"
            ? mapBusinessOperation(inv["Business Operation"])
            : null,
      });
    }

    return results;
  }

  /**
   * Maps an old-customer Google Sheet row into RawSnapshotInput. The sheet has
   * no ServiceId column, so it's resolved by looking the service name up
   * against the billing DB's Services catalog (see service-catalog.service.ts
   * for why this is best-effort, not a guaranteed match).
   */
  mapSheetRowToSnapshotInput(
    row: GoogleSpreadsheetRow,
    serviceIdMap: Map<string, string>,
  ): RawSnapshotInput {
    const get = (header: string): string | null | undefined => row.get(header);
    return {
      category: get("Category"),
      paid: get("Paid"),
      serviceId: this.serviceCatalogService.resolveServiceId(get("Nama Service"), serviceIdMap),
      namaService: get("Nama Service"),
      dpp: get("DPP"),
      prorate: null,
      upgrade: null,
      biayaAlat: null,
      setup: null,
      sales: get("Sales"),
      managerSales: get("Manager Sales"),
      aiInvoice: get("AI Invoice"),
      aiReceipt: get("AI Receipt"),
      cid: get("CID"),
      namaCustomer: get("Nama Customer"),
      company: get("Company"),
      csid: get("CSID"),
      account: get("Account"),
      vendor: get("Vendor"),
      lineRental: get("Line Rental"),
      paidDate: get("Tanggal Input Pembayaran"),
      bulan: get("Bulan"),
      telatBulan: get("Telat (Bulan)"),
      biayaReferral: get("Biaya Referral"),
      referralName: get("Reseller"),
    };
  }

  /**
   * Old-customer variant: no category allowlist (every category is kept),
   * subscription comes straight from DPP, and type is always "recurring".
   * Paid gate, the Alat/Setup service-name prefix rule, and sales/manager
   * resolution stay identical to the new-customer path.
   */
  buildRecurringSnapshotValues(
    input: RawSnapshotInput,
    employeeMap: Map<string, string>,
  ): any[] | null {
    const category = input.category?.toString().trim() || null;
    const paid = input.paid?.toString().trim();

    if (paid !== "1") return null;

    if (!this.snapshotService.isAllowedServiceName(category, input.namaService)) {
      return null;
    }

    const { value: sales, skip: skipSales } = this.employeeService.resolveSales(
      input.sales?.toString(),
      employeeMap,
    );
    if (skipSales) return null;

    const manager = this.employeeService.resolveEmployee(
      input.managerSales?.toString(),
      employeeMap,
    );

    return this.snapshotService.assembleValues(
      input,
      category,
      sales,
      manager,
      parseNumber(input.dpp),
      "recurring",
    );
  }
}

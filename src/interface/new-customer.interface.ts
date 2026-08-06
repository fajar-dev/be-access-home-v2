import type { GoogleSpreadsheetRow } from "google-spreadsheet";
import type { RawSnapshotInput } from "./snapshot.interface";

export type NewCustomerInvoiceRow = {
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

export type NewCustomerAccountRow = {
  CID: string;
  CSID: number | null;
  "Nama Customer": string | null;
  Company: string | null;
  Account: string | null;
  "Nama Service": string | null;
  "Service Id": string | null;
  "Bandwidth (Mbps)": number | null;
  Vendor: string | null;
  Sales: string | null;
  "Manager Sales": string | null;
  CustStatus: string | null;
  "Branch ID": string | null;
};

export type NewCustomerServiceRow = {
  AI: number;
  ServiceId: string | null;
  ServiceType: string | null;
};

export interface INewCustomerRepository {
  findInvoices(params: string[]): Promise<NewCustomerInvoiceRow[]>;
  findAccounts(): Promise<NewCustomerAccountRow[]>;
  findServices(params: string[]): Promise<NewCustomerServiceRow[]>;
  findSheetRows(period: string): Promise<GoogleSpreadsheetRow[]>;
}

export interface INewCustomerService {
  fetchSnapshotInputs(period: string): Promise<RawSnapshotInput[]>;
  mapSheetRowToSnapshotInput(
    row: GoogleSpreadsheetRow,
    serviceIdMap: Map<string, string>,
  ): RawSnapshotInput;
  buildSnapshotValues(
    input: RawSnapshotInput,
    employeeMap: Map<string, string>,
  ): any[] | null;
}

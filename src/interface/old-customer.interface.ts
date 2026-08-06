import type { GoogleSpreadsheetRow } from "google-spreadsheet";
import type { RawSnapshotInput } from "./snapshot.interface";

export type OldCustomerInvoiceRow = {
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
  "Business Operation": string | null;
};

export type OldCustomerAccountRow = {
  CID: string;
  CSID: number | null;
  "Nama Customer": string | null;
  Company: string | null;
  Account: string | null;
  Vendor: string | null;
  Sales: string | null;
  "Manager Sales": string | null;
};

export interface IOldCustomerRepository {
  findInvoices(params: string[]): Promise<OldCustomerInvoiceRow[]>;
  findAccounts(): Promise<OldCustomerAccountRow[]>;
  findSheetRows(period: string): Promise<GoogleSpreadsheetRow[]>;
}

export interface IOldCustomerService {
  fetchSnapshotInputs(period: string): Promise<RawSnapshotInput[]>;
  mapSheetRowToSnapshotInput(
    row: GoogleSpreadsheetRow,
    serviceIdMap: Map<string, string>,
  ): RawSnapshotInput;
  buildRecurringSnapshotValues(
    input: RawSnapshotInput,
    employeeMap: Map<string, string>,
  ): any[] | null;
}

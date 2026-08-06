import { GoogleSpreadsheet, type GoogleSpreadsheetRow } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { googleConfig } from "../config/google.config";

export class GoogleSheetsClient {
  private readonly auth: JWT;

  constructor() {
    this.auth = new JWT({
      email: googleConfig.serviceAccountEmail,
      key: googleConfig.privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
  }

  async getRows(
    sheetTitle: string,
    spreadsheetId: string,
  ): Promise<GoogleSpreadsheetRow[]> {
    const doc = new GoogleSpreadsheet(spreadsheetId, this.auth);
    await doc.loadInfo();

    const sheet = doc.sheetsByTitle[sheetTitle];
    if (!sheet) {
      throw new Error(`Sheet "${sheetTitle}" tidak ditemukan di spreadsheet`);
    }

    return sheet.getRows();
  }
}

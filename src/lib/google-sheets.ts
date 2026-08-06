import { GoogleSpreadsheet, type GoogleSpreadsheetRow } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { googleConfig } from "../config/google.config";

export async function getSheetRows(
  sheetTitle: string,
  spreadsheetId: string,
): Promise<GoogleSpreadsheetRow[]> {
  const auth = new JWT({
    email: googleConfig.serviceAccountEmail,
    key: googleConfig.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const doc = new GoogleSpreadsheet(spreadsheetId, auth);
  await doc.loadInfo();

  const sheet = doc.sheetsByTitle[sheetTitle];
  if (!sheet) {
    throw new Error(`Sheet "${sheetTitle}" tidak ditemukan di spreadsheet`);
  }

  return sheet.getRows();
}

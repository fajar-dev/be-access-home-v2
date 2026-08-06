export const googleConfig = {
  serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  newCustomerSpreadsheetId: process.env.GOOGLE_SPREADSHEET_ID!,
  oldCustomerSpreadsheetId: process.env.GOOGLE_SPREADSHEET_ID_OLD_CUSTOMER!,
};

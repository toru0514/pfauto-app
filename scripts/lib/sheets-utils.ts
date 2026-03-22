import { google, sheets_v4 } from "googleapis";

export function columnIndexToLetter(index: number): string {
  const baseCharCode = "A".charCodeAt(0);
  let dividend = index + 1;
  let columnName = "";

  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    columnName = String.fromCharCode(baseCharCode + modulo) + columnName;
    dividend = Math.floor((dividend - modulo) / 26);
  }

  return columnName;
}

export async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  const base64 = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;
  if (!base64) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_BASE64 が設定されていません。");
  }

  const credentials = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

export function getSpreadsheetId(): string {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID が設定されていません。");
  }
  return spreadsheetId;
}

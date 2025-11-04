import { google } from "googleapis";

async function main() {
  const base64 = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!base64 || !spreadsheetId) {
    throw new Error(
      "Environment variables GOOGLE_SERVICE_ACCOUNT_BASE64 / GOOGLE_SHEETS_SPREADSHEET_ID are not set."
    );
  }

  const credentials = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "A1:B5",
  });

  console.log("Spreadsheet values:", response.data.values);
}

main().catch((error) => {
  console.error("Google Sheets API call failed:", error);
  process.exit(1);
});

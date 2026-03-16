import { config } from "dotenv";
import { google } from "googleapis";
config({ path: ".env.local" });

const base64 = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64!;
const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
const credentials = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

async function main() {
  // シート情報を取得（データ入力規則を含む）
  const { data } = await sheets.spreadsheets.get({
    spreadsheetId,
    includeGridData: true,
    ranges: ["'共通'!A1:ZZ3"],
  });

  const sheet = data.sheets?.[0];
  const gridData = sheet?.data?.[0];
  const headerRow = gridData?.rowData?.[0];
  const dataRow = gridData?.rowData?.[1];

  console.log("共通シートのカテゴリ列とデータ入力規則:\n");

  headerRow?.values?.forEach((cell, i) => {
    const header = cell.formattedValue || "";
    if (header.includes("category")) {
      const dataCell = dataRow?.values?.[i];
      const validation = dataCell?.dataValidation;
      const hasValidation = validation != null;
      const validationType = validation?.condition?.type;
      const valueCount = validation?.condition?.values?.length || 0;

      console.log(`列${i} (${header}):`);
      console.log(`  入力規則: ${hasValidation ? "あり" : "なし"}`);
      if (hasValidation) {
        console.log(`  タイプ: ${validationType}`);
        console.log(`  選択肢数: ${valueCount}`);
      }
      console.log("");
    }
  });
}

main().catch(console.error);

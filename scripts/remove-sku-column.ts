import { config } from "dotenv";
import { google } from "googleapis";

config({ path: ".env.local" });

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

  const sheetTitle = process.env.GOOGLE_SHEETS_WORKSHEET_TITLE || "シート1";

  // スプレッドシートのメタデータを取得
  const spreadsheetMeta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title))",
  });

  const targetSheet = spreadsheetMeta.data.sheets?.find(
    (s) => s.properties?.title === sheetTitle
  );

  if (!targetSheet) {
    throw new Error(`シート "${sheetTitle}" が見つかりませんでした。`);
  }

  const sheetId = targetSheet.properties?.sheetId;

  // ヘッダー行を取得
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetTitle}!1:1`,
    majorDimension: "ROWS",
  });

  const headers = response.data.values?.[0] ?? [];
  console.log("現在のヘッダー:", headers);

  const skuIndex = headers.findIndex(
    (h: string) => h.toLowerCase().replace(/[\s　_-]/g, "") === "sku"
  );

  if (skuIndex === -1) {
    console.log("\n✅ sku列は既に存在しません。");
    return;
  }

  console.log(`\nsku列を発見: インデックス ${skuIndex} (列 ${String.fromCharCode(65 + skuIndex)})`);
  console.log("sku列を削除中...");

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "COLUMNS",
              startIndex: skuIndex,
              endIndex: skuIndex + 1,
            },
          },
        },
      ],
    },
  });

  // 削除後のヘッダー確認
  const verifyResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetTitle}!1:1`,
    majorDimension: "ROWS",
  });

  const updatedHeaders = verifyResponse.data.values?.[0] ?? [];
  console.log("\n✅ sku列を削除しました");
  console.log("更新後のヘッダー:", updatedHeaders);
}

main().catch((error) => {
  console.error("sku列の削除に失敗しました:", error);
  process.exit(1);
});

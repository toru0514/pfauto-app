/**
 * 共通シートの列を整理し、各PFシートにデータを移行するスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/cleanup-common-sheet.ts
 *
 * 処理内容:
 * 1. 共通シートから各PF固有列のデータを各PFシートに移行
 * 2. 共通シートから不要列を削除
 * 3. 各PFシートの数式を再設定
 */

import { config } from "dotenv";
import { google, sheets_v4 } from "googleapis";

config({ path: ".env.local" });

// シート設定
const SHEET_CONFIG = {
  common: process.env.GOOGLE_SHEETS_COMMON_SHEET || "共通",
  creema: process.env.GOOGLE_SHEETS_CREEMA_SHEET || "Creema",
  minne: process.env.GOOGLE_SHEETS_MINNE_SHEET || "minne",
  base: process.env.GOOGLE_SHEETS_BASE_SHEET || "BASE",
  iichi: process.env.GOOGLE_SHEETS_IICHI_SHEET || "iichi",
};

// 共通シートに残す列（順序通り）
const COMMON_COLUMNS_TO_KEEP = [
  "product_id",
  "title",
  "description",
  "price",
  "inventory",
  "material",
  "size_notes",
  "weight_grams",
  "tags",
  "image_urls",
  "production_lead_time_days",
  "shipping_fee",
  "shipping_method",
  "shipping_origin_pref",
  "出品先",
  "ステータス",
  "最終同期",
  "エラーメモ",
  "notes_internal",
];

// 各PFシートの共通参照列
const SHARED_COLUMNS = [
  "product_id",
  "title",
  "description",
  "price",
  "inventory",
  "material",
  "size_notes",
  "weight_grams",
  "tags",
  "image_urls",
  "production_lead_time_days",
  "shipping_fee",
  "shipping_method",
  "shipping_origin_pref",
];

// 各PFシート固有の列（共通シートから移行するもの含む）
const PLATFORM_COLUMNS: Record<string, string[]> = {
  creema: [
    "creema_category_level1_label",
    "creema_category_level2_label",
    "creema_category_level3_label",
    "creema_category_id",
    "creema_category2_id",
    "creema_category3_id",
    "creema_color_ids",
    "creema_status",
    "creema_last_synced_at",
    "creema_last_error",
    "creema_last_job_started_at",
    "creema_last_duration_seconds",
    "creema_attempt",
  ],
  minne: [
    "minne_category_parent_id",
    "minne_category_id",
    "minne_shipping_method",
    "minne_shipping_area",
    "minne_shipping_fee",
    "minne_shipping_additional_fee",
    "minne_status",
    "minne_last_synced_at",
    "minne_last_error",
    "minne_last_job_started_at",
    "minne_last_duration_seconds",
    "minne_attempt",
  ],
  base: [
    "base_status",
    "base_last_synced_at",
    "base_last_error",
    "base_last_job_started_at",
    "base_last_duration_seconds",
    "base_attempt",
  ],
  iichi: [
    "iichi_category_parent_label",
    "iichi_category_child_label",
    "iichi_status",
    "iichi_last_synced_at",
    "iichi_last_error",
    "iichi_last_job_started_at",
    "iichi_last_duration_seconds",
    "iichi_attempt",
  ],
};

// 完全に削除する列（共通にもPFシートにも不要）
const COLUMNS_TO_DELETE = [
  "variant_options",
  "category_common",
  "base_title",
  "base_description",
  "base_price",
  "base_inventory",
  "base_image_urls",
  "minne_image_urls",
  "iichi_image_urls",
  "iichi_material_label",
  "iichi_shipping_method_label",
];

function columnIndexToLetter(index: number): string {
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

async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  const base64 = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;
  if (!base64) throw new Error("GOOGLE_SERVICE_ACCOUNT_BASE64 が設定されていません。");
  const credentials = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function getSpreadsheetId(): string {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID が設定されていません。");
  return spreadsheetId;
}

async function getSheetIds(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<Record<string, number>> {
  const { data } = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });
  const sheetIds: Record<string, number> = {};
  for (const sheet of data.sheets || []) {
    const title = sheet.properties?.title;
    const sheetId = sheet.properties?.sheetId;
    if (title && typeof sheetId === "number") {
      sheetIds[title] = sheetId;
    }
  }
  return sheetIds;
}

async function getSheetData(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetTitle: string
): Promise<{ headers: string[]; rows: string[][] }> {
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetTitle}'!A1:ZZ500`,
    majorDimension: "ROWS",
  });
  const values = (data.values as string[][]) || [];
  if (!values.length) return { headers: [], rows: [] };
  const [headers, ...rows] = values;
  return { headers, rows };
}

async function main() {
  console.log("=== 共通シート列整理スクリプト ===\n");

  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  // シートID取得
  const sheetIds = await getSheetIds(sheets, spreadsheetId);
  console.log("シート一覧:", Object.keys(sheetIds).join(", "));

  // 共通シートのデータを取得
  const commonData = await getSheetData(sheets, spreadsheetId, SHEET_CONFIG.common);
  console.log(`\n共通シート: ${commonData.headers.length} 列, ${commonData.rows.length} 行`);

  // 共通シートの列インデックスマップ
  const commonColIndex: Record<string, number> = {};
  commonData.headers.forEach((h, i) => {
    commonColIndex[h] = i;
  });

  // Step 1: 各PFシートにデータを移行
  console.log("\n--- Step 1: 各PFシートにデータを移行 ---");

  const platforms = [
    { key: "creema", title: SHEET_CONFIG.creema },
    { key: "minne", title: SHEET_CONFIG.minne },
    { key: "base", title: SHEET_CONFIG.base },
    { key: "iichi", title: SHEET_CONFIG.iichi },
  ];

  for (const { key, title } of platforms) {
    console.log(`\n${title}シート:`);

    const pfColumns = PLATFORM_COLUMNS[key];
    const pfHeaders = [...SHARED_COLUMNS, ...pfColumns];

    // 共通シートから該当列のデータを抽出
    const pfRows: string[][] = [];

    for (const commonRow of commonData.rows) {
      const pfRow: string[] = [];

      for (let i = 0; i < pfHeaders.length; i++) {
        const header = pfHeaders[i];
        const commonIdx = commonColIndex[header];

        if (i < SHARED_COLUMNS.length) {
          // 共通参照列は数式
          if (commonIdx !== undefined) {
            const commonColLetter = columnIndexToLetter(commonIdx);
            const rowNum = pfRows.length + 2;
            pfRow.push(`='${SHEET_CONFIG.common}'!${commonColLetter}${rowNum}`);
          } else {
            pfRow.push("");
          }
        } else {
          // PF固有列は共通シートから値をコピー
          if (commonIdx !== undefined) {
            pfRow.push(commonRow[commonIdx] || "");
          } else {
            pfRow.push("");
          }
        }
      }

      pfRows.push(pfRow);
    }

    // PFシートにデータを書き込み
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${title}'!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [pfHeaders, ...pfRows],
      },
    });

    console.log(`  ${pfHeaders.length} 列, ${pfRows.length} 行を書き込み`);

    // 条件付き書式を設定
    const sheetId = sheetIds[title];
    if (typeof sheetId === "number") {
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addConditionalFormatRule: {
                  rule: {
                    ranges: [
                      {
                        sheetId,
                        startRowIndex: 1,
                        endRowIndex: pfRows.length + 1,
                        startColumnIndex: 0,
                        endColumnIndex: SHARED_COLUMNS.length,
                      },
                    ],
                    booleanRule: {
                      condition: {
                        type: "CUSTOM_FORMULA",
                        values: [{ userEnteredValue: `=NOT(ISFORMULA(A2))` }],
                      },
                      format: {
                        backgroundColor: { red: 1, green: 0.95, blue: 0.8 },
                      },
                    },
                  },
                  index: 0,
                },
              },
            ],
          },
        });
        console.log(`  条件付き書式を設定`);
      } catch {
        // 既存の書式がある場合はスキップ
      }
    }
  }

  // Step 2: 共通シートを再構築
  console.log("\n--- Step 2: 共通シートを再構築 ---");

  // 新しい共通シートのデータを構築
  const newCommonHeaders = COMMON_COLUMNS_TO_KEEP;
  const newCommonRows: string[][] = [];

  for (const commonRow of commonData.rows) {
    const newRow: string[] = [];
    for (const header of newCommonHeaders) {
      const idx = commonColIndex[header];
      if (idx !== undefined) {
        newRow.push(commonRow[idx] || "");
      } else {
        newRow.push("");
      }
    }
    newCommonRows.push(newRow);
  }

  // 列の削除情報を表示
  const deletedColumns = commonData.headers.filter(
    (h) => !COMMON_COLUMNS_TO_KEEP.includes(h)
  );
  console.log(`\n削除する列 (${deletedColumns.length}個):`);
  for (const col of deletedColumns) {
    const reason = COLUMNS_TO_DELETE.includes(col)
      ? "不要"
      : col.startsWith("creema_")
      ? "→ Creemaシート"
      : col.startsWith("minne_")
      ? "→ minneシート"
      : col.startsWith("base_")
      ? "→ BASEシート"
      : col.startsWith("iichi_")
      ? "→ iichiシート"
      : "その他";
    console.log(`  - ${col} (${reason})`);
  }

  console.log(`\n残す列 (${newCommonHeaders.length}個):`);
  newCommonHeaders.forEach((h, i) => console.log(`  ${i + 1}. ${h}`));

  // 共通シートをクリアして再書き込み
  const commonSheetId = sheetIds[SHEET_CONFIG.common];
  if (typeof commonSheetId !== "number") {
    throw new Error("共通シートが見つかりません。");
  }

  // 既存データをクリア
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${SHEET_CONFIG.common}'!A:ZZ`,
  });

  // 新しいデータを書き込み
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${SHEET_CONFIG.common}'!A1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [newCommonHeaders, ...newCommonRows],
    },
  });

  console.log(`\n共通シートを更新: ${newCommonHeaders.length} 列, ${newCommonRows.length} 行`);

  // Step 3: 各PFシートの数式を更新（共通シートの列が変わったため）
  console.log("\n--- Step 3: 各PFシートの数式を更新 ---");

  // 新しい共通シートの列インデックスマップ
  const newCommonColIndex: Record<string, number> = {};
  newCommonHeaders.forEach((h, i) => {
    newCommonColIndex[h] = i;
  });

  for (const { key, title } of platforms) {
    const pfColumns = PLATFORM_COLUMNS[key];
    const pfHeaders = [...SHARED_COLUMNS, ...pfColumns];

    // 既存のPFシートのデータを取得
    const pfData = await getSheetData(sheets, spreadsheetId, title);

    // 数式を更新
    const updatedRows: string[][] = [];

    for (let rowIdx = 0; rowIdx < pfData.rows.length; rowIdx++) {
      const pfRow = pfData.rows[rowIdx];
      const updatedRow: string[] = [];

      for (let colIdx = 0; colIdx < pfHeaders.length; colIdx++) {
        const header = pfHeaders[colIdx];

        if (colIdx < SHARED_COLUMNS.length) {
          // 共通参照列は新しい列位置で数式を設定
          const newCommonIdx = newCommonColIndex[header];
          if (newCommonIdx !== undefined) {
            const commonColLetter = columnIndexToLetter(newCommonIdx);
            const rowNum = rowIdx + 2;
            updatedRow.push(`='${SHEET_CONFIG.common}'!${commonColLetter}${rowNum}`);
          } else {
            updatedRow.push("");
          }
        } else {
          // PF固有列は既存値を維持
          updatedRow.push(pfRow[colIdx] || "");
        }
      }

      updatedRows.push(updatedRow);
    }

    // PFシートを更新
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${title}'!A2`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: updatedRows,
      },
    });

    console.log(`${title}シートの数式を更新`);
  }

  console.log("\n=== 完了 ===");
  console.log(`スプレッドシートURL: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
}

main().catch((error) => {
  console.error("エラー:", error);
  process.exit(1);
});

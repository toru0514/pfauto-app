/**
 * 共通シート中心の構成に再構築するスクリプト
 *
 * 目的:
 * - 共通シートのみで商品登録が完結するようにする
 * - 各PFシートは上書き用と同期管理用のみ
 *
 * 使用方法:
 *   npx tsx scripts/restructure-to-common-first.ts
 */

import { config } from "dotenv";
import { google, sheets_v4 } from "googleapis";

config({ path: ".env.local" });

const SHEET_CONFIG = {
  common: process.env.GOOGLE_SHEETS_COMMON_SHEET || "共通",
  backup: "バックアップ_20260316",
  creema: process.env.GOOGLE_SHEETS_CREEMA_SHEET || "Creema",
  minne: process.env.GOOGLE_SHEETS_MINNE_SHEET || "minne",
  base: process.env.GOOGLE_SHEETS_BASE_SHEET || "BASE",
  iichi: process.env.GOOGLE_SHEETS_IICHI_SHEET || "iichi",
};

// 新しい共通シートの列構成（順序通り）
const NEW_COMMON_COLUMNS = [
  // === 基本情報 ===
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

  // === 配送情報 ===
  "production_lead_time_days",
  "shipping_fee",
  "shipping_method",
  "shipping_origin_pref",

  // === Creemaカテゴリ ===
  "creema_category_level1_label",
  "creema_category_level2_label",
  "creema_category_level3_label",
  "creema_category_id",
  "creema_category2_id",
  "creema_category3_id",
  "creema_color_ids",

  // === minneカテゴリ・配送 ===
  "minne_category_parent_id",
  "minne_category_id",
  "minne_shipping_additional_fee", // minne固有の追加送料

  // === iichiカテゴリ ===
  "iichi_category_parent_label",
  "iichi_category_child_label",

  // === 共通管理 ===
  "出品先",
  "ステータス",
  "最終同期",
  "エラーメモ",
  "notes_internal",
];

// 各PFシートの列構成（共通参照 + 同期管理のみ）
// 共通参照列は NEW_COMMON_COLUMNS から同期管理列を除いたもの
const COMMON_REFERENCE_COLUMNS = NEW_COMMON_COLUMNS.filter(
  (col) => !["ステータス", "最終同期", "エラーメモ"].includes(col)
);

// 各PF固有の同期管理列
const SYNC_COLUMNS: Record<string, string[]> = {
  creema: [
    "creema_status",
    "creema_last_synced_at",
    "creema_last_error",
    "creema_last_job_started_at",
    "creema_last_duration_seconds",
    "creema_attempt",
  ],
  minne: [
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
    "iichi_status",
    "iichi_last_synced_at",
    "iichi_last_error",
    "iichi_last_job_started_at",
    "iichi_last_duration_seconds",
    "iichi_attempt",
  ],
};

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
  try {
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetTitle}'!A1:ZZ500`,
      majorDimension: "ROWS",
    });
    const values = (data.values as string[][]) || [];
    if (!values.length) return { headers: [], rows: [] };
    const [headers, ...rows] = values;
    return { headers, rows };
  } catch {
    return { headers: [], rows: [] };
  }
}

async function main() {
  console.log("=== 共通シート中心の構成に再構築 ===\n");

  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const sheetIds = await getSheetIds(sheets, spreadsheetId);

  console.log("シート一覧:", Object.keys(sheetIds).join(", "));

  // バックアップシートからデータを取得（元のデータソース）
  const backupData = await getSheetData(sheets, spreadsheetId, SHEET_CONFIG.backup);
  if (!backupData.headers.length) {
    throw new Error(`バックアップシート「${SHEET_CONFIG.backup}」が見つかりません。`);
  }
  console.log(`\nバックアップシート: ${backupData.headers.length} 列, ${backupData.rows.length} 行`);

  // バックアップシートの列インデックスマップ
  const backupColIndex: Record<string, number> = {};
  backupData.headers.forEach((h, i) => {
    backupColIndex[h] = i;
  });

  // 現在の各PFシートから同期管理データを取得
  const pfSyncData: Record<string, { headers: string[]; rows: string[][] }> = {};
  for (const pfKey of ["creema", "minne", "base", "iichi"]) {
    const pfTitle = SHEET_CONFIG[pfKey as keyof typeof SHEET_CONFIG];
    pfSyncData[pfKey] = await getSheetData(sheets, spreadsheetId, pfTitle);
  }

  // Step 1: 共通シートを再構築
  console.log("\n--- Step 1: 共通シートを再構築 ---");
  console.log(`新しい列数: ${NEW_COMMON_COLUMNS.length}`);

  const newCommonRows: string[][] = [];
  for (const backupRow of backupData.rows) {
    const newRow: string[] = [];
    for (const col of NEW_COMMON_COLUMNS) {
      const idx = backupColIndex[col];
      if (idx !== undefined) {
        newRow.push(backupRow[idx] || "");
      } else {
        newRow.push("");
      }
    }
    newCommonRows.push(newRow);
  }

  // 共通シートをクリアして再書き込み
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${SHEET_CONFIG.common}'!A:ZZ`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${SHEET_CONFIG.common}'!A1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [NEW_COMMON_COLUMNS, ...newCommonRows],
    },
  });

  console.log(`共通シートを更新: ${NEW_COMMON_COLUMNS.length} 列, ${newCommonRows.length} 行`);

  // 新しい共通シートの列インデックスマップ
  const newCommonColIndex: Record<string, number> = {};
  NEW_COMMON_COLUMNS.forEach((h, i) => {
    newCommonColIndex[h] = i;
  });

  // Step 2: 各PFシートを再構築
  console.log("\n--- Step 2: 各PFシートを再構築 ---");

  const platforms = [
    { key: "creema", title: SHEET_CONFIG.creema },
    { key: "minne", title: SHEET_CONFIG.minne },
    { key: "base", title: SHEET_CONFIG.base },
    { key: "iichi", title: SHEET_CONFIG.iichi },
  ];

  for (const { key, title } of platforms) {
    console.log(`\n${title}シート:`);

    // PFシートの列構成: 共通参照列 + 同期管理列
    const pfHeaders = [...COMMON_REFERENCE_COLUMNS, ...SYNC_COLUMNS[key]];
    console.log(`  列数: ${pfHeaders.length} (共通参照: ${COMMON_REFERENCE_COLUMNS.length}, 同期管理: ${SYNC_COLUMNS[key].length})`);

    // 現在のPFシートから同期管理データを取得
    const currentPfData = pfSyncData[key];
    const currentPfColIndex: Record<string, number> = {};
    currentPfData.headers.forEach((h, i) => {
      currentPfColIndex[h] = i;
    });

    // バックアップから同期管理データも取得（フォールバック用）
    const pfRows: string[][] = [];

    for (let rowIdx = 0; rowIdx < newCommonRows.length; rowIdx++) {
      const rowNum = rowIdx + 2; // ヘッダー行 + 0-indexed
      const pfRow: string[] = [];

      for (let colIdx = 0; colIdx < pfHeaders.length; colIdx++) {
        const header = pfHeaders[colIdx];

        if (colIdx < COMMON_REFERENCE_COLUMNS.length) {
          // 共通参照列は数式
          const commonColIdx = newCommonColIndex[header];
          if (commonColIdx !== undefined) {
            const commonColLetter = columnIndexToLetter(commonColIdx);
            pfRow.push(`='${SHEET_CONFIG.common}'!${commonColLetter}${rowNum}`);
          } else {
            pfRow.push("");
          }
        } else {
          // 同期管理列は既存データまたはバックアップから取得
          let value = "";

          // 現在のPFシートから取得を試みる
          if (currentPfData.rows[rowIdx]) {
            const currentIdx = currentPfColIndex[header];
            if (currentIdx !== undefined) {
              value = currentPfData.rows[rowIdx][currentIdx] || "";
            }
          }

          // なければバックアップから取得
          if (!value) {
            const backupIdx = backupColIndex[header];
            if (backupIdx !== undefined) {
              value = backupData.rows[rowIdx]?.[backupIdx] || "";
            }
          }

          pfRow.push(value);
        }
      }

      pfRows.push(pfRow);
    }

    // PFシートをクリアして再書き込み
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `'${title}'!A:ZZ`,
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${title}'!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [pfHeaders, ...pfRows],
      },
    });

    console.log(`  ${pfRows.length} 行を書き込み`);

    // 条件付き書式を設定（共通参照列の上書き箇所を黄色に）
    const sheetId = sheetIds[title];
    if (typeof sheetId === "number") {
      try {
        // 既存の条件付き書式を削除してから追加
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
                        endColumnIndex: COMMON_REFERENCE_COLUMNS.length,
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
        // エラーは無視
      }
    }
  }

  // 結果サマリー
  console.log("\n=== 完了 ===");
  console.log(`\n共通シートの列構成 (${NEW_COMMON_COLUMNS.length}列):`);
  NEW_COMMON_COLUMNS.forEach((h, i) => console.log(`  ${i + 1}. ${h}`));

  console.log(`\n各PFシートの構成:`);
  console.log(`  共通参照列: ${COMMON_REFERENCE_COLUMNS.length}列（すべて数式で共通シートを参照）`);
  console.log(`  同期管理列: 6列（*_status, *_last_synced_at, *_last_error, etc.）`);

  console.log(`\nスプレッドシートURL: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
}

main().catch((error) => {
  console.error("エラー:", error);
  process.exit(1);
});

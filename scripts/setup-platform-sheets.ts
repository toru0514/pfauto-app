/**
 * 各PFシートに共通シートを参照する数式を設定するスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/setup-platform-sheets.ts
 *
 * 処理内容:
 * 1. 共通シートの構造を取得
 * 2. 各PFシート（Creema, minne, BASE, iichi）を作成または更新
 * 3. 各PFシートの共通列に ='共通'!B2 のような数式を設定
 * 4. 条件付き書式で数式でないセルを色付け
 */

import { config } from "dotenv";
import { sheets_v4 } from "googleapis";
import { columnIndexToLetter, getSheetsClient, getSpreadsheetId } from "./lib/sheets-utils";

config({ path: ".env.local" });

// シート設定
const SHEET_CONFIG = {
  common: process.env.GOOGLE_SHEETS_COMMON_SHEET || "共通",
  creema: process.env.GOOGLE_SHEETS_CREEMA_SHEET || "Creema",
  minne: process.env.GOOGLE_SHEETS_MINNE_SHEET || "minne",
  base: process.env.GOOGLE_SHEETS_BASE_SHEET || "BASE",
  iichi: process.env.GOOGLE_SHEETS_IICHI_SHEET || "iichi",
};

// 共通シートの列構成
const COMMON_COLUMNS = [
  "product_id",
  "sku",
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

// 各PFシートで共通シートから参照する列
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

// 各PFシートで共通シートから参照するカテゴリ列
const SHARED_CATEGORY_COLUMNS: Record<string, string[]> = {
  creema: [
    "creema_category_level1_label",
    "creema_category_level2_label",
    "creema_category_level3_label",
  ],
  minne: [
    "minne_category_parent_label",
    "minne_category_label",
  ],
  base: [],
  iichi: [
    "iichi_category_parent_label",
    "iichi_category_child_label",
  ],
};

// 各PFシート固有の列（直接入力する列）
const PLATFORM_SPECIFIC_COLUMNS: Record<string, string[]> = {
  creema: [
    "creema_color_ids",
    "creema_status",
    "creema_last_synced_at",
    "creema_last_error",
    "creema_last_job_started_at",
    "creema_last_duration_seconds",
    "creema_attempt",
  ],
  minne: [
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
    "iichi_status",
    "iichi_last_synced_at",
    "iichi_last_error",
    "iichi_last_job_started_at",
    "iichi_last_duration_seconds",
    "iichi_attempt",
  ],
};

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

async function createSheetIfNotExists(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetTitle: string,
  existingSheetIds: Record<string, number>
): Promise<number> {
  if (existingSheetIds[sheetTitle] !== undefined) {
    console.log(`シート「${sheetTitle}」は既に存在します。`);
    return existingSheetIds[sheetTitle];
  }

  const { data } = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: sheetTitle,
            },
          },
        },
      ],
    },
  });

  const newSheetId = data.replies?.[0]?.addSheet?.properties?.sheetId;
  if (typeof newSheetId !== "number") {
    throw new Error(`シート「${sheetTitle}」の作成に失敗しました。`);
  }

  console.log(`シート「${sheetTitle}」を作成しました。(sheetId: ${newSheetId})`);
  return newSheetId;
}

async function getCommonSheetData(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  commonSheetTitle: string
): Promise<{ headers: string[]; rowCount: number; columnCount: number }> {
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${commonSheetTitle}'!A1:ZZ1`,
    majorDimension: "ROWS",
  });

  const headers = (data.values?.[0] as string[]) || [];

  // 行数を取得
  const { data: rowData } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${commonSheetTitle}'!A:A`,
    majorDimension: "COLUMNS",
  });

  const rowCount = rowData.values?.[0]?.length || 1;

  return {
    headers,
    rowCount,
    columnCount: headers.length,
  };
}

async function setupPlatformSheet(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  platformKey: string,
  platformSheetTitle: string,
  commonSheetTitle: string,
  commonHeaders: string[],
  commonRowCount: number,
  sheetId: number
): Promise<void> {
  console.log(`\n=== ${platformSheetTitle} シートのセットアップ ===`);

  // 共通シートの列インデックスマップを作成
  const commonColumnIndexMap: Record<string, number> = {};
  commonHeaders.forEach((header, index) => {
    commonColumnIndexMap[header] = index;
  });

  // PFシートのヘッダー行を構築（共通列 + カテゴリ列 + PF固有列）
  const categoryColumns = SHARED_CATEGORY_COLUMNS[platformKey] || [];
  const pfHeaders = [
    ...SHARED_COLUMNS,
    ...categoryColumns,
    ...PLATFORM_SPECIFIC_COLUMNS[platformKey],
  ];

  // 共通シートから参照すべき列のセット
  const columnsToReference = new Set([...SHARED_COLUMNS, ...categoryColumns]);

  // ヘッダー行を設定
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${platformSheetTitle}'!A1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [pfHeaders],
    },
  });
  console.log(`ヘッダー行を設定しました: ${pfHeaders.length} 列`);

  // 数式を設定（2行目以降）
  if (commonRowCount > 1) {
    const formulas: string[][] = [];

    for (let row = 2; row <= commonRowCount; row++) {
      const rowFormulas: string[] = [];

      for (const header of pfHeaders) {
        const commonColIndex = commonColumnIndexMap[header];
        if (commonColIndex !== undefined && columnsToReference.has(header)) {
          // 共通シートからの参照数式
          const commonColLetter = columnIndexToLetter(commonColIndex);
          rowFormulas.push(`='${commonSheetTitle}'!${commonColLetter}${row}`);
        } else {
          // PF固有列は空
          rowFormulas.push("");
        }
      }

      formulas.push(rowFormulas);
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${platformSheetTitle}'!A2`,
      valueInputOption: "USER_ENTERED", // 数式として解釈させる
      requestBody: {
        values: formulas,
      },
    });
    console.log(`数式を設定しました: ${formulas.length} 行`);
  }

  // 条件付き書式を設定（数式でないセルを黄色に）
  // 共通参照列の範囲を特定（共通列 + カテゴリ列）
  const sharedColCount = columnsToReference.size;

  // 条件付き書式を追加: 数式でないセル（上書き箇所）を黄色にする
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
                    startRowIndex: 1, // ヘッダー行をスキップ
                    endRowIndex: commonRowCount,
                    startColumnIndex: 0,
                    endColumnIndex: sharedColCount,
                  },
                ],
                booleanRule: {
                  condition: {
                    type: "CUSTOM_FORMULA",
                    values: [
                      {
                        userEnteredValue: `=NOT(ISFORMULA(A2))`,
                      },
                    ],
                  },
                  format: {
                    backgroundColor: {
                      red: 1,
                      green: 0.95,
                      blue: 0.8,
                    },
                  },
                },
              },
              index: 0,
            },
          },
        ],
      },
    });
    console.log(`条件付き書式を設定しました（上書き箇所を黄色表示）`);
  } catch (error) {
    console.warn(`条件付き書式の設定に失敗しました:`, error);
  }
}

async function main() {
  console.log("=== PFシートセットアップスクリプト ===\n");

  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  // 既存シートのIDを取得
  const existingSheetIds = await getSheetIds(sheets, spreadsheetId);
  console.log("既存シート:", Object.keys(existingSheetIds).join(", "));

  // 共通シートのデータを取得
  const commonData = await getCommonSheetData(sheets, spreadsheetId, SHEET_CONFIG.common);
  console.log(`共通シート: ${commonData.headers.length} 列, ${commonData.rowCount} 行`);
  console.log(`ヘッダー: ${commonData.headers.slice(0, 10).join(", ")}...`);

  // 各PFシートをセットアップ
  const platforms: Array<{ key: string; title: string }> = [
    { key: "creema", title: SHEET_CONFIG.creema },
    { key: "minne", title: SHEET_CONFIG.minne },
    { key: "base", title: SHEET_CONFIG.base },
    { key: "iichi", title: SHEET_CONFIG.iichi },
  ];

  for (const { key, title } of platforms) {
    const sheetId = await createSheetIfNotExists(sheets, spreadsheetId, title, existingSheetIds);
    existingSheetIds[title] = sheetId;

    await setupPlatformSheet(
      sheets,
      spreadsheetId,
      key,
      title,
      SHEET_CONFIG.common,
      commonData.headers,
      commonData.rowCount,
      sheetId
    );
  }

  console.log("\n=== セットアップ完了 ===");
  console.log(`スプレッドシートURL: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
}

main().catch((error) => {
  console.error("エラー:", error);
  process.exit(1);
});

/**
 * 共通シートのカテゴリ列にプルダウン（データ入力規則）を設定するスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/setup-category-dropdowns.ts
 *
 * 処理内容:
 * 1. 共通シートのカテゴリ列名を変更（ID列→ラベル列）
 * 2. 共通シートのCreema ID列を削除
 * 3. 共通シートのカテゴリ列にプルダウンを設定
 * 4. PFシートのプルダウンを解除（数式で共通シートを参照するため）
 */

import { config } from "dotenv";
import { sheets_v4 } from "googleapis";
import { CREEMA_CATEGORY_TREE } from "../playwright/tests/creema-categories";
import { MINNE_CATEGORY_TREE } from "../lib/categories/minne-categories";
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

// Creema大カテゴリラベル一覧
const CREEMA_LEVEL1_LABELS = CREEMA_CATEGORY_TREE.map((c) => c.label);

// Creema小カテゴリラベル一覧（全カテゴリを統合）
const CREEMA_LEVEL2_LABELS = CREEMA_CATEGORY_TREE.flatMap(
  (c) => c.children?.map((child) => child.label) ?? []
);

// minne大カテゴリラベル一覧
const MINNE_PARENT_LABELS = MINNE_CATEGORY_TREE.map((c) => c.label);

// minne小カテゴリラベル一覧（全カテゴリを統合）
const MINNE_CHILD_LABELS = MINNE_CATEGORY_TREE.flatMap(
  (c) => c.children?.map((child) => child.label) ?? []
);

async function getSheetInfo(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<Record<string, { sheetId: number; rowCount: number }>> {
  const { data } = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });

  const sheetInfo: Record<string, { sheetId: number; rowCount: number }> = {};
  for (const sheet of data.sheets || []) {
    const title = sheet.properties?.title;
    const sheetId = sheet.properties?.sheetId;
    const rowCount = sheet.properties?.gridProperties?.rowCount || 1000;
    if (title && typeof sheetId === "number") {
      sheetInfo[title] = { sheetId, rowCount };
    }
  }
  return sheetInfo;
}

async function getSheetHeaders(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetTitle: string
): Promise<string[]> {
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetTitle}'!A1:ZZ1`,
    majorDimension: "ROWS",
  });

  return (data.values?.[0] as string[]) || [];
}

async function updateHeaderCell(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetTitle: string,
  columnIndex: number,
  newHeaderName: string
): Promise<void> {
  const columnLetter = columnIndexToLetter(columnIndex);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetTitle}'!${columnLetter}1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[newHeaderName]],
    },
  });
  console.log(`  列名変更: ${columnLetter}1 → ${newHeaderName}`);
}

async function setDropdownValidation(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetId: number,
  columnIndex: number,
  values: string[],
  startRow: number,
  endRow: number
): Promise<void> {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          setDataValidation: {
            range: {
              sheetId,
              startRowIndex: startRow,
              endRowIndex: endRow,
              startColumnIndex: columnIndex,
              endColumnIndex: columnIndex + 1,
            },
            rule: {
              condition: {
                type: "ONE_OF_LIST",
                values: values.map((v) => ({ userEnteredValue: v })),
              },
              showCustomUi: true,
              strict: false, // 選択肢以外も入力可能
            },
          },
        },
      ],
    },
  });
  console.log(`  プルダウン設定: 列${columnIndexToLetter(columnIndex)}, ${values.length}個の選択肢`);
}

async function clearDataValidation(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetId: number,
  columnIndex: number,
  startRow: number,
  endRow: number
): Promise<void> {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          setDataValidation: {
            range: {
              sheetId,
              startRowIndex: startRow,
              endRowIndex: endRow,
              startColumnIndex: columnIndex,
              endColumnIndex: columnIndex + 1,
            },
            rule: undefined, // データ入力規則を削除
          },
        },
      ],
    },
  });
  console.log(`  プルダウン解除: 列${columnIndexToLetter(columnIndex)}`);
}

async function deleteColumns(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetId: number,
  headers: string[],
  columnsToDelete: string[]
): Promise<string[]> {
  const indicesToDelete: number[] = [];
  for (const colName of columnsToDelete) {
    const index = headers.indexOf(colName);
    if (index !== -1) {
      indicesToDelete.push(index);
    }
  }

  if (indicesToDelete.length === 0) {
    console.log("  削除対象の列がありません");
    return headers;
  }

  // 後ろから削除するため降順ソート
  indicesToDelete.sort((a, b) => b - a);

  const requests: sheets_v4.Schema$Request[] = indicesToDelete.map((colIndex) => ({
    deleteDimension: {
      range: {
        sheetId,
        dimension: "COLUMNS",
        startIndex: colIndex,
        endIndex: colIndex + 1,
      },
    },
  }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  // 更新後のヘッダーを返す
  const updatedHeaders = headers.filter((_, i) => !indicesToDelete.includes(i));
  console.log(`  ${indicesToDelete.length}列を削除しました: ${columnsToDelete.filter(c => headers.includes(c)).join(", ")}`);
  return updatedHeaders;
}

async function setupCommonSheetDropdowns(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetId: number,
  headers: string[],
  rowCount: number
): Promise<void> {
  console.log("\n=== 共通シートにプルダウン設定 ===");

  // Creema大カテゴリ（level1）
  const creemaLevel1Index = headers.indexOf("creema_category_level1_label");
  if (creemaLevel1Index !== -1) {
    await setDropdownValidation(
      sheets,
      spreadsheetId,
      sheetId,
      creemaLevel1Index,
      CREEMA_LEVEL1_LABELS,
      1,
      rowCount
    );
  } else {
    console.log("  警告: creema_category_level1_label 列が見つかりません");
  }

  // Creema小カテゴリ（level2）
  const creemaLevel2Index = headers.indexOf("creema_category_level2_label");
  if (creemaLevel2Index !== -1) {
    await setDropdownValidation(
      sheets,
      spreadsheetId,
      sheetId,
      creemaLevel2Index,
      CREEMA_LEVEL2_LABELS,
      1,
      rowCount
    );
  } else {
    console.log("  警告: creema_category_level2_label 列が見つかりません");
  }

  // minne大カテゴリ（parent）
  const minneParentIndex = headers.indexOf("minne_category_parent_label");
  if (minneParentIndex !== -1) {
    await setDropdownValidation(
      sheets,
      spreadsheetId,
      sheetId,
      minneParentIndex,
      MINNE_PARENT_LABELS,
      1,
      rowCount
    );
  } else {
    console.log("  警告: minne_category_parent_label 列が見つかりません");
  }

  // minne小カテゴリ（child）
  const minneChildIndex = headers.indexOf("minne_category_label");
  if (minneChildIndex !== -1) {
    await setDropdownValidation(
      sheets,
      spreadsheetId,
      sheetId,
      minneChildIndex,
      MINNE_CHILD_LABELS,
      1,
      rowCount
    );
  } else {
    console.log("  警告: minne_category_label 列が見つかりません");
  }
}

async function clearPfSheetDropdowns(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetId: number,
  headers: string[],
  rowCount: number,
  sheetTitle: string
): Promise<void> {
  console.log(`\n=== ${sheetTitle}シートのプルダウン解除 ===`);

  const categoryColumns = [
    "creema_category_level1_label",
    "creema_category_level2_label",
    "minne_category_parent_label",
    "minne_category_label",
  ];

  for (const colName of categoryColumns) {
    const index = headers.indexOf(colName);
    if (index !== -1) {
      await clearDataValidation(sheets, spreadsheetId, sheetId, index, 1, rowCount);
    }
  }
}

async function main() {
  console.log("=== カテゴリプルダウン設定スクリプト（共通シート版） ===\n");
  console.log(`Creema大カテゴリ: ${CREEMA_LEVEL1_LABELS.length}個`);
  console.log(`Creema小カテゴリ: ${CREEMA_LEVEL2_LABELS.length}個`);
  console.log(`minne大カテゴリ: ${MINNE_PARENT_LABELS.length}個`);
  console.log(`minne小カテゴリ: ${MINNE_CHILD_LABELS.length}個`);

  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  // シート情報を取得
  const sheetInfo = await getSheetInfo(sheets, spreadsheetId);
  console.log("\n既存シート:", Object.keys(sheetInfo).join(", "));

  // 共通シートの設定
  const commonSheetInfo = sheetInfo[SHEET_CONFIG.common];
  if (!commonSheetInfo) {
    throw new Error(`共通シート「${SHEET_CONFIG.common}」が見つかりません`);
  }

  let commonHeaders = await getSheetHeaders(sheets, spreadsheetId, SHEET_CONFIG.common);
  console.log(`\n共通シートのヘッダー数: ${commonHeaders.length}`);

  // 1. 共通シートのminne列名変更
  console.log("\n=== 共通シートの列名変更 ===");
  const minneParentIdIndex = commonHeaders.indexOf("minne_category_parent_id");
  if (minneParentIdIndex !== -1) {
    await updateHeaderCell(sheets, spreadsheetId, SHEET_CONFIG.common, minneParentIdIndex, "minne_category_parent_label");
    commonHeaders[minneParentIdIndex] = "minne_category_parent_label";
  }

  const minneCategoryIdIndex = commonHeaders.indexOf("minne_category_id");
  if (minneCategoryIdIndex !== -1) {
    await updateHeaderCell(sheets, spreadsheetId, SHEET_CONFIG.common, minneCategoryIdIndex, "minne_category_label");
    commonHeaders[minneCategoryIdIndex] = "minne_category_label";
  }

  // 2. 共通シートのCreema ID列を削除
  console.log("\n=== 共通シートのCreema ID列削除 ===");
  commonHeaders = await deleteColumns(
    sheets,
    spreadsheetId,
    commonSheetInfo.sheetId,
    commonHeaders,
    ["creema_category_id", "creema_category2_id", "creema_category3_id"]
  );

  // 3. 共通シートにプルダウン設定
  await setupCommonSheetDropdowns(
    sheets,
    spreadsheetId,
    commonSheetInfo.sheetId,
    commonHeaders,
    commonSheetInfo.rowCount
  );

  // 4. 各PFシートのプルダウンを解除
  for (const [pfKey, pfTitle] of [
    ["creema", SHEET_CONFIG.creema],
    ["minne", SHEET_CONFIG.minne],
  ] as const) {
    const pfSheetInfo = sheetInfo[pfTitle];
    if (pfSheetInfo) {
      const pfHeaders = await getSheetHeaders(sheets, spreadsheetId, pfTitle);
      await clearPfSheetDropdowns(
        sheets,
        spreadsheetId,
        pfSheetInfo.sheetId,
        pfHeaders,
        pfSheetInfo.rowCount,
        pfTitle
      );
    }
  }

  console.log("\n=== 設定完了 ===");
  console.log(`スプレッドシートURL: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
  console.log("\n次に setup-platform-sheets.ts を実行してPFシートの数式を再設定してください:");
  console.log("  npx tsx scripts/setup-platform-sheets.ts");
}

main().catch((error) => {
  console.error("エラー:", error);
  process.exit(1);
});

/**
 * 共通シートのminneカテゴリID列をラベルに変換するスクリプト
 */

import { config } from "dotenv";
import {
  getMinneParentLabelById,
  getMinneChildLabelById,
} from "../lib/categories/minne-categories";
import { columnIndexToLetter, getSheetsClient, getSpreadsheetId } from "./lib/sheets-utils";

config({ path: ".env.local" });

const SHEET_CONFIG = {
  common: process.env.GOOGLE_SHEETS_COMMON_SHEET || "共通",
};

async function main() {
  console.log("=== minneカテゴリID→ラベル変換 ===\n");

  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  // 共通シートのデータを取得
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${SHEET_CONFIG.common}'!A1:ZZ`,
    majorDimension: "ROWS",
  });

  const rows = data.values || [];
  if (rows.length < 2) {
    console.log("データがありません");
    return;
  }

  const headers = rows[0];
  const parentLabelIndex = headers.indexOf("minne_category_parent_label");
  const childLabelIndex = headers.indexOf("minne_category_label");

  if (parentLabelIndex === -1 || childLabelIndex === -1) {
    console.log("カテゴリ列が見つかりません");
    console.log("  minne_category_parent_label:", parentLabelIndex);
    console.log("  minne_category_label:", childLabelIndex);
    return;
  }

  console.log(`親カテゴリ列: ${columnIndexToLetter(parentLabelIndex)} (index: ${parentLabelIndex})`);
  console.log(`子カテゴリ列: ${columnIndexToLetter(childLabelIndex)} (index: ${childLabelIndex})`);
  console.log(`データ行数: ${rows.length - 1}\n`);

  // 変換処理
  const updates: { range: string; values: string[][] }[] = [];
  let convertedCount = 0;

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const parentValue = row[parentLabelIndex] || "";
    const childValue = row[childLabelIndex] || "";
    const rowNumber = rowIndex + 1;

    // 数字かどうかチェック（IDの場合は変換）
    const isParentId = /^\d+$/.test(parentValue.trim());
    const isChildId = /^\d+$/.test(childValue.trim());

    if (isParentId || isChildId) {
      let newParentLabel = parentValue;
      let newChildLabel = childValue;

      if (isParentId) {
        const label = getMinneParentLabelById(parentValue.trim());
        if (label) {
          newParentLabel = label;
          console.log(`行${rowNumber}: 親カテゴリ "${parentValue}" → "${label}"`);
        } else {
          console.log(`行${rowNumber}: 親カテゴリ "${parentValue}" のラベルが見つかりません`);
        }
      }

      if (isChildId && newParentLabel) {
        // 親IDを使って子ラベルを取得
        const parentId = isParentId ? parentValue.trim() : null;
        if (parentId) {
          const label = getMinneChildLabelById(parentId, childValue.trim());
          if (label) {
            newChildLabel = label;
            console.log(`行${rowNumber}: 子カテゴリ "${childValue}" → "${label}"`);
          } else {
            console.log(`行${rowNumber}: 子カテゴリ "${childValue}" のラベルが見つかりません`);
          }
        }
      }

      // 更新データを追加
      if (newParentLabel !== parentValue) {
        updates.push({
          range: `'${SHEET_CONFIG.common}'!${columnIndexToLetter(parentLabelIndex)}${rowNumber}`,
          values: [[newParentLabel]],
        });
        convertedCount++;
      }

      if (newChildLabel !== childValue) {
        updates.push({
          range: `'${SHEET_CONFIG.common}'!${columnIndexToLetter(childLabelIndex)}${rowNumber}`,
          values: [[newChildLabel]],
        });
        convertedCount++;
      }
    }
  }

  if (updates.length === 0) {
    console.log("\n変換対象のデータがありませんでした");
    return;
  }

  // バッチ更新
  console.log(`\n${updates.length}件の更新を実行中...`);

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: updates,
    },
  });

  console.log(`\n=== 変換完了 ===`);
  console.log(`${convertedCount}件のセルを更新しました`);
}

main().catch(console.error);

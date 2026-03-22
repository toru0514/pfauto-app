import { google, sheets_v4 } from "googleapis";
import { getLogger } from "@/lib/logger";
import { getGoogleSheetsRateLimiter } from "@/lib/rate-limiter";

const log = getLogger("wood-repository");
const rateLimiter = getGoogleSheetsRateLimiter();

const WOOD_SHEET_TITLE = "木材";
const WOOD_HEADERS = ["id", "name", "image_url", "features", "created_at"];

export type WoodMaterial = {
  id: string;
  name: string;
  imageUrl: string;
  features: string;
  createdAt: string;
};

let cachedSheetsClient: sheets_v4.Sheets | null = null;

function getSheetsClient(): sheets_v4.Sheets {
  if (cachedSheetsClient) return cachedSheetsClient;

  const base64 = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!base64 || !spreadsheetId) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_BASE64 / GOOGLE_SHEETS_SPREADSHEET_ID が設定されていません。"
    );
  }

  const credentials = JSON.parse(
    Buffer.from(base64, "base64").toString("utf-8")
  );

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  cachedSheetsClient = google.sheets({ version: "v4", auth });
  return cachedSheetsClient;
}

function getSpreadsheetId(): string {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID が設定されていません。");
  }
  return spreadsheetId;
}

async function ensureWoodSheet(): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  try {
    await rateLimiter.acquire();
    const { data } = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties.title",
    });

    const sheetExists = data.sheets?.some(
      (s) => s.properties?.title === WOOD_SHEET_TITLE
    );

    if (sheetExists) return;

    // シートを新規作成
    await rateLimiter.acquire();
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: WOOD_SHEET_TITLE },
            },
          },
        ],
      },
    });

    // ヘッダー行を追加
    await rateLimiter.acquire();
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${WOOD_SHEET_TITLE}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [WOOD_HEADERS],
      },
    });

    log.info("木材シートを作成しました");
  } catch (error) {
    log.error("木材シートの確認/作成に失敗しました", error);
    throw error;
  }
}

export async function listWoods(): Promise<WoodMaterial[]> {
  await ensureWoodSheet();

  try {
    await rateLimiter.acquire();
    const sheets = getSheetsClient();
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: `${WOOD_SHEET_TITLE}!A1:ZZ`,
      majorDimension: "ROWS",
    });

    const values = data.values ?? [];
    if (values.length <= 1) return []; // ヘッダーのみ

    const [headerRow, ...rows] = values;
    const idIdx = headerRow.indexOf("id");
    const nameIdx = headerRow.indexOf("name");
    const imageUrlIdx = headerRow.indexOf("image_url");
    const featuresIdx = headerRow.indexOf("features");
    const createdAtIdx = headerRow.indexOf("created_at");

    return rows
      .filter((row) => row[idIdx]?.trim())
      .map((row) => ({
        id: row[idIdx] ?? "",
        name: row[nameIdx] ?? "",
        imageUrl: row[imageUrlIdx] ?? "",
        features: row[featuresIdx] ?? "",
        createdAt: row[createdAtIdx] ?? "",
      }))
      .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  } catch (error) {
    log.error("木材一覧の取得に失敗しました", error);
    throw error;
  }
}

export async function addWood(input: {
  name: string;
  imageUrl: string;
  features: string;
}): Promise<WoodMaterial> {
  await ensureWoodSheet();

  const newWood: WoodMaterial = {
    id: `wood-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: input.name,
    imageUrl: input.imageUrl,
    features: input.features,
    createdAt: new Date().toISOString(),
  };

  try {
    await rateLimiter.acquire();
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: getSpreadsheetId(),
      range: `${WOOD_SHEET_TITLE}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          [
            newWood.id,
            newWood.name,
            newWood.imageUrl,
            newWood.features,
            newWood.createdAt,
          ],
        ],
      },
    });

    log.info("木材を追加しました", { id: newWood.id, name: newWood.name });
    return newWood;
  } catch (error) {
    log.error("木材の追加に失敗しました", error, { name: input.name });
    throw error;
  }
}

export async function deleteWood(woodId: string): Promise<void> {
  await ensureWoodSheet();

  try {
    await rateLimiter.acquire();
    const sheets = getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${WOOD_SHEET_TITLE}!A1:ZZ`,
      majorDimension: "ROWS",
    });

    const values = data.values ?? [];
    if (values.length <= 1) return;

    const [headerRow, ...rows] = values;
    const idIdx = headerRow.indexOf("id");
    if (idIdx === -1) return;

    const targetRowIndex = rows.findIndex((row) => row[idIdx] === woodId);
    if (targetRowIndex === -1) return;

    // シートIDを取得
    await rateLimiter.acquire();
    const sheetMeta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties",
    });

    const woodSheet = sheetMeta.data.sheets?.find(
      (s) => s.properties?.title === WOOD_SHEET_TITLE
    );
    const sheetId = woodSheet?.properties?.sheetId;
    if (sheetId === undefined) return;

    // 行を削除（ヘッダー行 + 0-indexed → +1）
    const deleteRowIndex = targetRowIndex + 1;
    await rateLimiter.acquire();
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: deleteRowIndex,
                endIndex: deleteRowIndex + 1,
              },
            },
          },
        ],
      },
    });

    log.info("木材を削除しました", { woodId });
  } catch (error) {
    log.error("木材の削除に失敗しました", error, { woodId });
    throw error;
  }
}

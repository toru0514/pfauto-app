import { google, sheets_v4 } from "googleapis";
import type {
  ProductRepositoryPort,
  UpdateProductStatusInput,
} from "@/application/ports/product-repository-port";
import type {
  PlatformJobSnapshot,
  SpreadsheetProductRecord,
} from "@/application/types/product";
import type { JobStatus, ProductStatus } from "@/application/types/status";

const DEFAULT_SHEET_TITLE = "シート1";
const VALUE_RANGE = "A1:ZZ"; // covers columns A-ZZ (~702 columns)
const MOCK_SHEET_MATRIX: SheetMatrix = {
  headerRow: [
    "product_id",
    "title",
    "description",
    "price",
    "inventory",
    "tags",
    "出品先",
    "ステータス",
    "最終同期",
    "エラーメモ",
    "creema_status",
    "creema_last_synced_at",
    "creema_last_error",
    "minne_status",
    "minne_last_synced_at",
    "minne_last_error",
  ],
  rows: [
    [
      "demo-1",
      "Creema向けリング",
      "Creema 自動化のスモークテスト用レコードです。",
      "3500",
      "5",
      "リング,シルバー",
      "Creema,Minne",
      "下書き準備済み",
      "2024-11-01 10:00",
      "",
      "processing",
      "2024-10-31 22:00",
      "",
      "queued",
      "",
      "",
    ],
    [
      "demo-2",
      "Minne向けピアス",
      "CI スモークテストで一覧に表示される確認用データです。",
      "4200",
      "8",
      "ピアス,ゴールド",
      "Minne",
      "エラー",
      "2024-10-20 09:30",
      "画像URLが不足しています",
      "",
      "",
      "",
      "error",
      "2024-10-19 18:20",
      "一時的なエラー",
    ],
  ],
};

const PRODUCT_STATUS_ALIASES: Record<ProductStatus, string[]> = {
  new: ["new", "新規"],
  ready: ["ready", "下書き準備済み", "準備済み"],
  queued: ["queued", "待機中", "キュー待ち"],
  processing: ["processing", "処理中"],
  drafted: ["drafted", "下書き作成済み", "下書き完了", "完了"],
  error: ["error", "エラー"],
  skipped: ["skipped", "スキップ", "対象外"],
};

const JOB_STATUS_ALIASES: Record<JobStatus, string[]> = {
  queued: ["queued", "待機中", "ready", "下書き準備済み"],
  processing: ["processing", "処理中"],
  success: ["success", "done", "完了", "drafted", "下書き作成済み"],
  error: ["error", "failed", "エラー"],
  skipped: ["skipped", "skipped", "対象外"],
};

const HEADER_ALIASES = {
  productId: ["product_id", "id", "商品id", "商品ID"],
  title: ["title", "商品名"],
  description: ["description", "商品説明"],
  price: ["price", "価格"],
  inventory: ["inventory", "在庫"],
  tags: ["tags", "タグ"],
  platforms: ["出品先", "platforms", "platform"],
  syncStatus: ["sync_status", "ステータス"],
  lastSyncedAt: ["last_synced_at", "最終同期"],
  lastError: ["last_error", "エラーメモ", "最新エラー"],
  note: ["notes_internal", "メモ", "note"],
};

const PLATFORM_PREFIXES = ["creema", "minne"];

type SheetMatrix = {
  headerRow: string[];
  rows: string[][];
};

let cachedSheetsClient: sheets_v4.Sheets | null = null;

function shouldUseMockSheetData(): boolean {
  return process.env.USE_MOCK_SHEETS_DATA === "true";
}

function getMockSheetMatrix(): SheetMatrix {
  return {
    headerRow: [...MOCK_SHEET_MATRIX.headerRow],
    rows: MOCK_SHEET_MATRIX.rows.map((row) => [...row]),
  };
}

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

function getSheetTitle(): string {
  return process.env.GOOGLE_SHEETS_WORKSHEET_TITLE || DEFAULT_SHEET_TITLE;
}

function normalizeHeaderName(value: string): string {
  return value.replace(/[\s　]/g, "").toLowerCase();
}

function findColumnIndex(headerRow: string[], aliases: string[]): number | null {
  const normalizedHeaders = headerRow.map(normalizeHeaderName);
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeaderName(alias);
    const index = normalizedHeaders.indexOf(normalizedAlias);
    if (index !== -1) return index;
  }
  return null;
}

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

function normalizeProductStatus(value: string | null | undefined): ProductStatus {
  if (!value) return "ready";
  const normalized = value.trim().toLowerCase();
  for (const [status, keywords] of Object.entries(PRODUCT_STATUS_ALIASES)) {
    if (keywords.some((keyword) => keyword.toLowerCase() === normalized)) {
      return status as ProductStatus;
    }
  }
  return "ready";
}

function normalizeJobStatus(value: string | null | undefined): JobStatus {
  if (!value) return "queued";
  const normalized = value.trim().toLowerCase();
  for (const [status, keywords] of Object.entries(JOB_STATUS_ALIASES)) {
    if (keywords.some((keyword) => keyword.toLowerCase() === normalized)) {
      return status as JobStatus;
    }
  }
  return "queued";
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const sanitized = value.replace(/[,\s]/g, "");
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitMultiValue(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[\n,、;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePlatformName(value: string): string {
  const lower = value.trim().toLowerCase();
  if (lower.includes("creema")) return "creema";
  if (lower.includes("minne")) return "minne";
  if (lower.includes("base")) return "base";
  return lower;
}

function extractPlatformSnapshots(
  raw: Record<string, string>
): PlatformJobSnapshot[] {
  const snapshots = new Map<string, PlatformJobSnapshot>();

  for (const [rawKey, rawValue] of Object.entries(raw)) {
    const key = normalizeHeaderName(rawKey);
    const platformMatch = PLATFORM_PREFIXES.find((prefix) =>
      key.startsWith(normalizeHeaderName(prefix))
    );

    if (!platformMatch) continue;

    const suffix = key.slice(normalizeHeaderName(platformMatch).length);
    const normalizedSuffix = suffix.replace(/^[-_]+/, "");
    const compactSuffix = normalizedSuffix.replace(/[-_]/g, "");
    const snapshot = snapshots.get(platformMatch) ?? {
      platform: platformMatch,
      status: "queued",
      lastSyncedAt: null,
      lastError: null,
      lastJobStartedAt: null,
      lastDurationSeconds: null,
      attemptCount: null,
    };

    if (compactSuffix === "status") {
      snapshot.status = normalizeJobStatus(rawValue);
    } else if (compactSuffix === "lastsyncedat") {
      snapshot.lastSyncedAt = rawValue || null;
    } else if (compactSuffix === "lasterror") {
      snapshot.lastError = rawValue || null;
    } else if (compactSuffix === "lasterrormessage") {
      snapshot.lastError = rawValue || null;
    } else if (compactSuffix === "lastjobstartedat") {
      snapshot.lastJobStartedAt = rawValue || null;
    } else if (compactSuffix === "lastdurationseconds") {
      snapshot.lastDurationSeconds = parseNumber(rawValue);
    } else if (compactSuffix === "attempt" || compactSuffix === "retrycount") {
      snapshot.attemptCount = parseNumber(rawValue);
    }

    snapshots.set(platformMatch, snapshot);
  }

  return Array.from(snapshots.values());
}

function buildRawRecord(headerRow: string[], row: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  headerRow.forEach((header, index) => {
    if (!header) return;
    record[header] = row[index] ?? "";
  });
  return record;
}

export class GoogleSheetsProductRepository implements ProductRepositoryPort {
  async listProducts(): Promise<SpreadsheetProductRecord[]> {
    const matrix = await this.fetchSheetMatrix();
    if (!matrix) return [];
    const { headerRow, rows } = matrix;

    const productIdIndex = findColumnIndex(headerRow, HEADER_ALIASES.productId);
    const titleIndex = findColumnIndex(headerRow, HEADER_ALIASES.title);
    const descriptionIndex = findColumnIndex(headerRow, HEADER_ALIASES.description);
    const priceIndex = findColumnIndex(headerRow, HEADER_ALIASES.price);
    const inventoryIndex = findColumnIndex(headerRow, HEADER_ALIASES.inventory);
    const tagsIndex = findColumnIndex(headerRow, HEADER_ALIASES.tags);
    const platformsIndex = findColumnIndex(headerRow, HEADER_ALIASES.platforms);
    const syncStatusIndex = findColumnIndex(headerRow, HEADER_ALIASES.syncStatus);
    const lastSyncedAtIndex = findColumnIndex(headerRow, HEADER_ALIASES.lastSyncedAt);
    const lastErrorIndex = findColumnIndex(headerRow, HEADER_ALIASES.lastError);

    const records: SpreadsheetProductRecord[] = [];

    rows.forEach((row, rowIndex) => {
      const rowNumber = rowIndex + 2; // header row is 1
      const raw = buildRawRecord(headerRow, row);

      const productId = productIdIndex !== null ? row[productIdIndex] ?? "" : "";
      if (!productId) return; // skip empty rows

      const title = titleIndex !== null ? row[titleIndex] ?? "" : "";
      const description =
        descriptionIndex !== null ? row[descriptionIndex] ?? "" : "";

      const price = priceIndex !== null ? parseNumber(row[priceIndex]) : null;
      const inventory =
        inventoryIndex !== null ? parseNumber(row[inventoryIndex]) : null;
      const tags = tagsIndex !== null ? splitMultiValue(row[tagsIndex]) : [];
      const platforms =
        platformsIndex !== null
          ? splitMultiValue(row[platformsIndex]).map(normalizePlatformName)
          : [];

      const syncStatusRaw =
        syncStatusIndex !== null ? row[syncStatusIndex] ?? "" : "";
      const syncStatus = normalizeProductStatus(syncStatusRaw);

      const lastSyncedAt =
        lastSyncedAtIndex !== null ? row[lastSyncedAtIndex] ?? null : null;
      const lastError =
        lastErrorIndex !== null ? row[lastErrorIndex] ?? null : null;

      const platformSnapshots = extractPlatformSnapshots(raw);

      records.push({
        rowNumber,
        id: productId,
        title,
        description,
        price,
        inventory,
        tags,
        platforms,
        syncStatus,
        lastSyncedAt,
        lastError,
        platformSnapshots,
        raw,
      });
    });

    return records;
  }

  async findProductById(
    productId: string
  ): Promise<SpreadsheetProductRecord | null> {
    const products = await this.listProducts();
    return products.find((product) => product.id === productId) ?? null;
  }

  async updateProductStatuses(input: UpdateProductStatusInput): Promise<void> {
    if (shouldUseMockSheetData()) {
      console.warn(
        "[googleSheetsProductRepository] USE_MOCK_SHEETS_DATA=true のため updateProductStatuses をスキップしました。"
      );
      return;
    }

    const matrix = await this.fetchSheetMatrix();
    if (!matrix) return;
    const { headerRow, rows } = matrix;

    const productIdIndex = findColumnIndex(headerRow, HEADER_ALIASES.productId);
    if (productIdIndex === null) {
      throw new Error("product_id 列が見つかりませんでした。");
    }

    let targetRowNumber: number | null = null;
    rows.forEach((row, rowIndex) => {
      const rowProductId = row[productIdIndex];
      if (rowProductId && rowProductId === input.productId) {
        targetRowNumber = rowIndex + 2; // header row offset
      }
    });

    if (!targetRowNumber) {
      throw new Error(`product_id=${input.productId} の行が見つかりませんでした。`);
    }

    const updates: sheets_v4.Schema$ValueRange[] = [];
    const sheetTitle = getSheetTitle();

    if (input.syncStatus) {
      const index = findColumnIndex(headerRow, HEADER_ALIASES.syncStatus);
      if (index !== null) {
        updates.push({
          range: `${sheetTitle}!${columnIndexToLetter(index)}${targetRowNumber}`,
          values: [[input.syncStatus]],
        });
      }
    }

    if (input.platformStatuses) {
      for (const [platform, status] of Object.entries(input.platformStatuses)) {
        if (!status) continue;
        const alias = [`${platform}_status`, `${platform}status`];
        const index = findColumnIndex(headerRow, alias);
        if (index !== null) {
          updates.push({
            range: `${sheetTitle}!${columnIndexToLetter(index)}${targetRowNumber}`,
            values: [[status]],
          });
        }
      }
    }

    if (input.lastSyncedTimestamps) {
      for (const [platform, timestamp] of Object.entries(
        input.lastSyncedTimestamps
      )) {
        const alias = [
          `${platform}_last_synced_at`,
          `${platform}lastsyncedat`,
          `last_synced_at_${platform}`,
        ];
        const index = findColumnIndex(headerRow, alias);
        if (index !== null) {
          updates.push({
            range: `${sheetTitle}!${columnIndexToLetter(index)}${targetRowNumber}`,
            values: [[timestamp ?? ""]],
          });
        }
      }
    }

    if (input.clearErrorsForPlatforms?.length) {
      // 共通エラー列を空にする
      const commonErrorIndex = findColumnIndex(
        headerRow,
        HEADER_ALIASES.lastError
      );
      if (commonErrorIndex !== null) {
        updates.push({
          range: `${sheetTitle}!${columnIndexToLetter(commonErrorIndex)}${targetRowNumber}`,
          values: [[""]],
        });
      }

      for (const platform of input.clearErrorsForPlatforms) {
        const aliases = [
          `${platform}_last_error`,
          `${platform}_last_error_message`,
          `last_error_message_${platform}`,
          `${platform}lasterror`,
        ];
        const index = findColumnIndex(headerRow, aliases);
        if (index !== null) {
          updates.push({
            range: `${sheetTitle}!${columnIndexToLetter(index)}${targetRowNumber}`,
            values: [[""]],
          });
        }
      }
    }

    if ("note" in input) {
      const noteIndex = findColumnIndex(headerRow, HEADER_ALIASES.note);
      if (noteIndex !== null) {
        updates.push({
          range: `${sheetTitle}!${columnIndexToLetter(noteIndex)}${targetRowNumber}`,
          values: [[input.note ?? ""]],
        });
      }
    }

    if (!updates.length) return;

    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: getSpreadsheetId(),
      requestBody: {
        valueInputOption: "RAW",
        data: updates,
      },
    });
  }

  private async fetchSheetMatrix(): Promise<SheetMatrix | null> {
    if (shouldUseMockSheetData()) {
      return getMockSheetMatrix();
    }

    const sheets = getSheetsClient();
    const spreadsheetId = getSpreadsheetId();
    const sheetTitle = getSheetTitle();
    const range = `${sheetTitle}!${VALUE_RANGE}`;

    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      majorDimension: "ROWS",
    });

    const values = data.values ?? [];
    if (!values.length) {
      return {
        headerRow: [],
        rows: [],
      };
    }

    const [headerRow, ...rows] = values;
    return { headerRow, rows };
  }
}

export const googleSheetsProductRepository = new GoogleSheetsProductRepository();

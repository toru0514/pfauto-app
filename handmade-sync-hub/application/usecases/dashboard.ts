import { googleSheetsProductRepository } from "@/adapters/google-sheets/product-repository";
import type { SpreadsheetProductRecord } from "@/application/types/product";
import type { JobStatus, ProductStatus } from "@/application/types/status";

export type DashboardProduct = {
  id: string;
  title: string;
  platforms: string[];
  status: ProductStatus;
  lastSyncedAt: string | null;
  lastError: string | null;
  price: number | null;
  inventory: number | null;
  tags: string[];
  description: string;
};

export type DashboardJob = {
  id: string;
  productId: string;
  platform: string;
  status: JobStatus;
  attempt: number | null;
  startedAt: string | null;
  durationSeconds: number | null;
  lastError: string | null;
};

export async function getDashboardSnapshotUseCase(): Promise<{
  products: DashboardProduct[];
  jobs: DashboardJob[];
}> {
  const records = await googleSheetsProductRepository.listProducts();

  const products = records.map(mapRecordToDashboardProduct);
  const jobs = buildJobsFromRecords(records);

  return {
    products,
    jobs,
  };
}

export async function refreshProductsFromSheetsUseCase(): Promise<void> {
  await googleSheetsProductRepository.listProducts();
}

export async function enqueueDraftUseCase(
  productId: string,
  platforms: string[]
): Promise<void> {
  const record = await googleSheetsProductRepository.findProductById(productId);
  if (!record) {
    throw new Error(`Product ${productId} がスプレッドシートに存在しません。`);
  }

  const normalizedPlatforms = platforms
    .map((platform) => platform.trim().toLowerCase())
    .filter((platform) => platform.length > 0);

  if (!normalizedPlatforms.length) {
    throw new Error("送信対象のプラットフォームが指定されていません。");
  }

  await googleSheetsProductRepository.updateProductStatuses({
    productId,
    syncStatus: "queued",
    platformStatuses: Object.fromEntries(
      normalizedPlatforms.map((platform) => [platform, "queued"] as const)
    ),
    clearErrorsForPlatforms: normalizedPlatforms,
  });
}

function mapRecordToDashboardProduct(
  record: SpreadsheetProductRecord
): DashboardProduct {
  const productTitle = record.title || "(タイトル未設定)";
  const lastSyncedAt =
    record.lastSyncedAt ??
    pickLatestDate(
      record.platformSnapshots
        .map((snapshot) => snapshot.lastSyncedAt)
        .filter((value): value is string => Boolean(value))
    );

  const lastError =
    record.lastError ??
    pickFirstNonEmpty(
      record.platformSnapshots
        .map((snapshot) => snapshot.lastError)
        .filter((value): value is string => Boolean(value))
    );

  return {
    id: record.id,
    title: productTitle,
    platforms: record.platforms,
    status: record.syncStatus,
    lastSyncedAt: lastSyncedAt ?? null,
    lastError: lastError ?? null,
    price: record.price,
    inventory: record.inventory,
    tags: record.tags,
    description: record.description,
  };
}

function buildJobsFromRecords(records: SpreadsheetProductRecord[]): DashboardJob[] {
  const jobs: DashboardJob[] = [];

  for (const record of records) {
    const declaredPlatforms = new Set(
      record.platforms.map((platform) => platform.toLowerCase())
    );
    const snapshotPlatforms = new Set(
      record.platformSnapshots.map((snapshot) => snapshot.platform.toLowerCase())
    );

    const allPlatforms = new Set<string>([
      ...declaredPlatforms,
      ...snapshotPlatforms,
    ]);

    for (const platform of allPlatforms) {
      const snapshot = record.platformSnapshots.find(
        (item) => item.platform.toLowerCase() === platform
      );
      const status = snapshot?.status ?? inferJobStatusFromProduct(record);
      const startedAt = snapshot?.lastJobStartedAt ?? snapshot?.lastSyncedAt ?? null;
      const durationSeconds = snapshot?.lastDurationSeconds ?? null;
      const attempt = snapshot?.attemptCount ?? null;
      const lastError = snapshot?.lastError ?? null;

      jobs.push({
        id: `${record.id}:${platform}`,
        productId: record.id,
        platform,
        status,
        attempt,
        startedAt,
        durationSeconds,
        lastError,
      });
    }
  }

  return jobs;
}

function inferJobStatusFromProduct(record: SpreadsheetProductRecord): JobStatus {
  const statusMap: Record<ProductStatus, JobStatus> = {
    new: "queued",
    ready: "queued",
    queued: "queued",
    processing: "processing",
    drafted: "success",
    error: "error",
    skipped: "skipped",
  };
  return statusMap[record.syncStatus];
}

function pickLatestDate(values: string[]): string | undefined {
  if (!values.length) return undefined;
  return values
    .map((value) => ({ value, time: Date.parse(value) }))
    .filter((item) => Number.isFinite(item.time))
    .sort((a, b) => b.time - a.time)[0]?.value;
}

function pickFirstNonEmpty(values: string[]): string | undefined {
  return values.find((value) => value && value.trim().length > 0);
}

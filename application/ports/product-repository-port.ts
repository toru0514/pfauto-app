import type { JobStatus, ProductStatus } from "@/application/types/status";
import type { SpreadsheetProductRecord } from "@/application/types/product";

export type UpdateProductStatusInput = {
  productId: string;
  syncStatus?: ProductStatus;
  platformStatuses?: Record<string, JobStatus | undefined>;
  clearErrorsForPlatforms?: string[];
  lastSyncedTimestamps?: Record<string, string | null | undefined>;
  note?: string | null;
};

export interface ProductRepositoryPort {
  listProducts(): Promise<SpreadsheetProductRecord[]>;
  findProductById(productId: string): Promise<SpreadsheetProductRecord | null>;
  updateProductStatuses(input: UpdateProductStatusInput): Promise<void>;
}

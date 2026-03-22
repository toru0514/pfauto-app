"use server";

import { revalidatePath } from "next/cache";
import {
  getDashboardSnapshotUseCase,
  refreshProductsFromSheetsUseCase,
  enqueueDraftUseCase,
  addProductUseCase,
  type DashboardJob,
  type DashboardProduct,
} from "@/application/usecases/dashboard";
import {
  getProductDetailUseCase,
  updateProductUseCase,
  copyProductUseCase,
} from "@/application/usecases/product-management";
import type { SpreadsheetProductRecord } from "@/application/types/product";

export type ProductRow = DashboardProduct;
export type JobRow = DashboardJob;

export async function getDashboardData() {
  return getDashboardSnapshotUseCase();
}

export async function refreshProductsFromSheets() {
  await refreshProductsFromSheetsUseCase();
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function enqueueDraft(productId: string, platforms: string[]) {
  await enqueueDraftUseCase(productId, platforms);
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function addProduct(input: unknown) {
  if (
    typeof input !== "object" ||
    input === null ||
    typeof (input as Record<string, unknown>).productId !== "string" ||
    typeof (input as Record<string, unknown>).title !== "string" ||
    !Array.isArray((input as Record<string, unknown>).platforms) ||
    !(input as Record<string, unknown[]>).platforms.every(
      (v: unknown) => typeof v === "string"
    )
  ) {
    throw new Error("不正な入力です。");
  }

  const raw = input as Record<string, unknown>;
  const price = raw.price === null || typeof raw.price === "number" ? (raw.price as number | null) : null;
  const inventory = raw.inventory === null || typeof raw.inventory === "number" ? (raw.inventory as number | null) : null;
  const description = typeof raw.description === "string" ? raw.description : "";

  await addProductUseCase({
    productId: raw.productId as string,
    title: raw.title as string,
    description,
    price,
    inventory,
    platforms: raw.platforms as string[],
  });
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export type ProductDetail = SpreadsheetProductRecord;

export async function getProductDetail(
  productId: string
): Promise<ProductDetail> {
  return getProductDetailUseCase(productId);
}

export async function updateProduct(input: {
  productId: string;
  fields: Record<string, string>;
}): Promise<void> {
  if (
    typeof input !== "object" ||
    !input ||
    typeof input.productId !== "string" ||
    typeof input.fields !== "object" ||
    !input.fields
  ) {
    throw new Error("不正な入力です。");
  }

  await updateProductUseCase(input.productId, input.fields);
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function copyProduct(
  sourceProductId: string,
  newProductId: string
): Promise<void> {
  if (typeof sourceProductId !== "string" || typeof newProductId !== "string") {
    throw new Error("不正な入力です。");
  }

  await copyProductUseCase(sourceProductId, newProductId);
  revalidatePath("/dashboard");
  revalidatePath("/");
}

/**
 * selectフィールドの選択肢を共通シートの既存データから取得する。
 * キー: カラム名, 値: ユニーク値の配列
 */
export async function getFieldOptions(
  keys: string[]
): Promise<Record<string, string[]>> {
  const { googleSheetsProductRepository } = await import(
    "@/adapters/google-sheets/product-repository"
  );
  const products = await googleSheetsProductRepository.listProducts();

  const result: Record<string, string[]> = {};
  for (const key of keys) {
    const values = new Set<string>();
    for (const product of products) {
      const v = (product.raw[key] ?? "").trim();
      if (v) values.add(v);
    }
    result[key] = [...values].sort();
  }
  return result;
}

export async function getSpreadsheetUrl(): Promise<string | null> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) return null;

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

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

  await addProductUseCase({
    productId: raw.productId as string,
    title: raw.title as string,
    price,
    inventory,
    platforms: raw.platforms as string[],
  });
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function getSpreadsheetUrl(): Promise<string | null> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) return null;

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

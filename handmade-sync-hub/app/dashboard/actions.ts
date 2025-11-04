"use server";

import { revalidatePath } from "next/cache";
import {
  getDashboardSnapshotUseCase,
  refreshProductsFromSheetsUseCase,
  enqueueDraftUseCase,
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

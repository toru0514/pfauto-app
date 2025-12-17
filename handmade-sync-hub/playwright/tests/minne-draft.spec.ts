import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { googleSheetsProductRepository } from "@/adapters/google-sheets/product-repository";
import type { SpreadsheetProductRecord } from "@/application/types/product";

const RUN_MINNE_FLOW = process.env.PLAYWRIGHT_RUN_MINNE === "true";
const MINNE_LOGIN_URL = "https://minne.com/signin";
const MINNE_HOME_URL = "https://minne.com/account";
const MINNE_NEW_PRODUCT_URL = "https://minne.com/account/products/new";

const selectors = {
  loginEmail: "#email",
  loginSubmit: "input.c-magic-link-sending-button",
  titleInput: "#name",
  categoryParentSelect: "#category",
  categoryChildSelect: "select[aria-label*='小カテゴリー']",
  descriptionTextarea: "#description",
  priceInput: "#price",
  stockInput: "#stock-unit",
  shippingDaysInput: "#shipping-days",
  imageFileInput: "input[type='file']",
  shippingMethodSelect: "#shipping-method-shipped-by-0",
  shippingAreaInput: "#shipping-method-shipped-to-0",
  shippingFeeInput: "#shipping-method-cost-0",
  shippingAdditionalFeeInput: "#shipping-method-additional-cost-0",
  submitButton: "button.gtm-products-new-submit-click-tracking-web-front",
  flashSuccess: "p.AccountPhysicalProductPage_flash-message-success__CI_ug",
};

test.describe("minne 自動化フロー", () => {
  test.skip(!RUN_MINNE_FLOW, "PLAYWRIGHT_RUN_MINNE=true を指定したときのみ実行します。");

  test("ログインして商品登録フォームに下書きを入力", async ({ page }, testInfo) => {
    const minneEmail = process.env.PLAYWRIGHT_MINNE_EMAIL;
    test.skip(!minneEmail, "PLAYWRIGHT_MINNE_EMAIL を設定してください。");

    const product = await pickProductForMinne();
    console.log("[minne-draft] product found?", Boolean(product), product?.id);
    test.skip(!product, "minne 対象のシート商品が見つかりませんでした。");

    const mapped = mapProductToMinneDraft(product!);

    await test.step("ログインリンクを送信", async () => {
      await page.goto(MINNE_LOGIN_URL, { waitUntil: "domcontentloaded" });
      await page.fill(selectors.loginEmail, minneEmail!);
      await page.click(selectors.loginSubmit);
      testInfo.annotations.push({
        type: "INFO",
        description:
          "メールに届く minne のログインリンクを開いてください。開いた後、Playwright Inspector で Resume を押すと次に進みます。",
      });
      await page.pause();
    });

    await test.step("マイページを開く", async () => {
      await page.goto(MINNE_HOME_URL, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/account/);
    });

    await test.step("作品登録画面を開く", async () => {
      await page.goto(MINNE_NEW_PRODUCT_URL, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/account\/products\/new/);
    });

    await test.step("フォームに商品情報を入力", async () => {
      await page.fill(selectors.titleInput, mapped.title);

      if (mapped.categoryParentId) {
        await page.selectOption(selectors.categoryParentSelect, mapped.categoryParentId).catch(() => {
          console.warn("[minne-draft] 親カテゴリが選択できません", mapped.categoryParentId);
        });
      }

      if (mapped.categoryId) {
        const childSelect = page.locator(selectors.categoryChildSelect).first();
        await childSelect.waitFor({ state: "attached", timeout: 10_000 }).catch(() => {});
        if (await childSelect.isEnabled()) {
          await childSelect.selectOption(mapped.categoryId).catch(() => {
            console.warn("[minne-draft] 子カテゴリが選択できません", mapped.categoryId);
          });
        }
      }

      await page.fill(selectors.descriptionTextarea, mapped.description);
      await page.fill(selectors.priceInput, mapped.price);
      await page.fill(selectors.stockInput, mapped.stock);
      await page.fill(selectors.shippingDaysInput, mapped.shippingDays);

      const imageFiles = await downloadImages(mapped.imageUrls);
      let filesToUpload = imageFiles;
      if (!filesToUpload.length && fs.existsSync(path.resolve(process.cwd(), "public/vercel.svg"))) {
        filesToUpload = [path.resolve(process.cwd(), "public/vercel.svg")];
      }
      try {
        if (filesToUpload.length) {
          const fileInput = page.locator(selectors.imageFileInput).first();
          await fileInput.evaluate((node) => {
            if (node instanceof HTMLElement) {
              node.removeAttribute("hidden");
              node.style.display = "block";
            }
          }).catch(() => {});
          await fileInput.setInputFiles(filesToUpload);
        } else {
          testInfo.annotations.push({
            type: "WARN",
            description: "画像URLがないため、手動で画像をアップロードしてください。",
          });
        }
      } finally {
        await cleanupTempFiles(imageFiles);
      }

      if (mapped.shippingMethod) {
        await page.selectOption(selectors.shippingMethodSelect, mapped.shippingMethod).catch(() => {
          console.warn("[minne-draft] 配送方法を選択できません", mapped.shippingMethod);
        });
      }
      if (mapped.shippingArea) {
        await page.fill(selectors.shippingAreaInput, mapped.shippingArea);
      }
      if (mapped.shippingFee) {
        await page.fill(selectors.shippingFeeInput, mapped.shippingFee);
      }
      if (mapped.shippingAdditionalFee) {
        await page.fill(selectors.shippingAdditionalFeeInput, mapped.shippingAdditionalFee);
      }
    });

    await test.step("登録ボタンをクリック", async () => {
      const submitButton = page.locator(selectors.submitButton).first();
      await expect(submitButton).toBeVisible();
      await submitButton.scrollIntoViewIfNeeded();
      await submitButton.click();
      await expect(page.locator(selectors.flashSuccess)).toContainText("作品", {
        timeout: 15_000,
      });
    });
  });
});

type MinneDraftMapped = {
  title: string;
  description: string;
  price: string;
  stock: string;
  shippingDays: string;
  categoryParentId: string | null;
  categoryId: string | null;
  shippingMethod: string | null;
  shippingArea: string | null;
  shippingFee: string | null;
  shippingAdditionalFee: string | null;
  imageUrls: string[];
};

async function pickProductForMinne(): Promise<SpreadsheetProductRecord | null> {
  const products = await googleSheetsProductRepository.listProducts();
  console.log("[minne-draft] fetched products", products.length);
  for (const p of products) {
    console.log("[minne-draft] candidate", p.id, p.platforms, p.syncStatus);
  }
  return (
    products.find(
      (product) =>
        product.platforms.some((platform) => platform.toLowerCase() === "minne") &&
        product.syncStatus === "ready"
    ) ?? null
  );
}

function mapProductToMinneDraft(product: SpreadsheetProductRecord): MinneDraftMapped {
  const title =
    pickFirstNonEmpty(product.raw["minne_title"], product.title, product.raw["title"]) ??
    `minne商品 ${product.id}`;
  const description =
    pickFirstNonEmpty(
      product.raw["minne_description"],
      product.description,
      product.raw["description"]
    ) ?? "";
  const priceValue =
    parseInteger(
      pickFirstNonEmpty(
        product.raw["minne_price"],
        product.raw["price"],
        product.price != null ? product.price.toString() : null
      )
    ) ?? 0;
  const stockValue =
    parseInteger(
      pickFirstNonEmpty(
        product.raw["minne_inventory"],
        product.raw["inventory"],
        product.inventory != null ? product.inventory.toString() : null
      )
    ) ?? 1;
  const shippingDaysValue =
    parseInteger(
      pickFirstNonEmpty(
        product.raw["minne_shipping_days"],
        product.raw["production_lead_time_days"],
        product.raw["制作期間"]
      )
    ) ?? 0;

  const shippingFeeValue =
    parseInteger(
      pickFirstNonEmpty(product.raw["minne_shipping_fee"], product.raw["shipping_fee"])
    );
  const shippingAdditionalValue =
    parseInteger(product.raw["minne_shipping_additional_fee"]);

  return {
    title,
    description,
    price: Math.max(50, priceValue).toString(),
    stock: Math.max(1, stockValue).toString(),
    shippingDays: Math.min(120, Math.max(0, shippingDaysValue)).toString(),
    categoryParentId: normalizeId(product.raw["minne_category_parent_id"]),
    categoryId: normalizeId(product.raw["minne_category_id"]),
    shippingMethod: pickFirstNonEmpty(
      product.raw["minne_shipping_method"],
      product.raw["shipping_method"]
    ),
    shippingArea:
      pickFirstNonEmpty(
        product.raw["minne_shipping_area"],
        product.raw["shipping_origin_pref"],
        product.raw["発送元"]
      ) ?? "全国一律",
    shippingFee: shippingFeeValue != null ? shippingFeeValue.toString() : null,
    shippingAdditionalFee:
      shippingAdditionalValue != null ? shippingAdditionalValue.toString() : "0",
    imageUrls: parseImageUrls(
      pickFirstNonEmpty(
        product.raw["minne_image_urls"],
        product.raw["image_urls"],
        product.raw["images"]
      )
    ),
  };
}

function normalizeId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function pickFirstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function parseInteger(value: string | null | undefined): number | null {
  if (!value) return null;
  const sanitized = value.replace(/[^0-9.+-]/g, "");
  if (!sanitized) return null;
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseImageUrls(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function downloadImages(urls: string[]): Promise<string[]> {
  const results: string[] = [];
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn("[minne-draft] image download failed", url, response.status);
        continue;
      }
      const arrayBuffer = await response.arrayBuffer();
      const ext = (() => {
        try {
          const pathname = new URL(url).pathname;
          const candidate = path.extname(pathname);
          return candidate || ".jpg";
        } catch {
          return ".jpg";
        }
      })();
      const tempPath = path.join(os.tmpdir(), `minne-image-${randomUUID()}${ext}`);
      await fsPromises.writeFile(tempPath, Buffer.from(arrayBuffer));
      console.log("[minne-draft] image saved", url, tempPath, arrayBuffer.byteLength);
      results.push(tempPath);
    } catch (error) {
      console.warn("[minne-draft] image download failed", url, error);
    }
  }
  return results;
}

async function cleanupTempFiles(files: string[]): Promise<void> {
  await Promise.all(
    files.map((file) =>
      fsPromises.unlink(file).catch((error) => {
        console.warn("[minne-draft] temp image cleanup failed", file, error);
      })
    )
  );
}

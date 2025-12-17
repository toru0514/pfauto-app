import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { googleSheetsProductRepository } from "@/adapters/google-sheets/product-repository";
import type { SpreadsheetProductRecord } from "@/application/types/product";

const RUN_IICHI_FLOW = process.env.PLAYWRIGHT_RUN_IICHI === "true";
const ENABLE_IICHI_CATEGORY_SELECTION = false;
const IICHI_ROOT_URL = "https://www.iichi.com";
const IICHI_LOGIN_PATH = "/signin";
const IICHI_ACCOUNT_PATH = "/account";
const IICHI_NEW_ITEM_PATH = "/your/item/create";

const selectors = {
  loginLink: "a.HeaderIcons__text--MsSNs[href='/signin']",
  loginEmail: "input[name='email']",
  loginPassword: "input[name='password']",
  loginContainer: ".SigninSignupForm__container--y8Xy7",
  loginSubmitButton: "button[type='submit'], input[type='submit']",
  titleInput: "input[name='title']",
  descriptionTextarea: "textarea[name='description']",
  priceInput: "input[name='price']",
  stockInput: "input[name='stock']",
  imageFileInput: "input[type='file'][accept*='image']",
  saveButton: "button.el-button--primary[type='submit']",
};

test.describe("iichi 自動化フロー", () => {
  test.skip(!RUN_IICHI_FLOW, "PLAYWRIGHT_RUN_IICHI=true を指定したときのみ実行します。");

  test("ログインして作品登録フォームに商品情報を入力", async ({ page }, testInfo) => {
    const email = process.env.PLAYWRIGHT_IICHI_EMAIL;
    const password = process.env.PLAYWRIGHT_IICHI_PASSWORD;
    test.skip(!email || !password, "PLAYWRIGHT_IICHI_EMAIL / PLAYWRIGHT_IICHI_PASSWORD を設定してください。");

    const product = await pickProductForIichi();
    console.log("[iichi-draft] product found?", Boolean(product), product?.id);
    test.skip(!product, "iichi 対象のシート商品が見つかりませんでした。");

    const mapped = mapProductToIichiDraft(product!);

    await test.step("トップページからログインへ遷移", async () => {
      await page.goto(IICHI_ROOT_URL, { waitUntil: "domcontentloaded" });
      await page.locator(selectors.loginLink).first().click();
      const loginContainer = page.locator(selectors.loginContainer).first();
      const loginFormVisible = await loginContainer
        .waitFor({ state: "visible", timeout: 5_000 })
        .then(() => true)
        .catch(() => false);
      if (!loginFormVisible) {
        await page.goto(`${IICHI_ROOT_URL}${IICHI_LOGIN_PATH}`, { waitUntil: "domcontentloaded" });
        await expect(page.locator(selectors.loginEmail)).toBeVisible();
      }
    });

    await test.step("メール・パスワードでログイン", async () => {
      await page.fill(selectors.loginEmail, email!);
      await page.fill(selectors.loginPassword, password!);
      const buttonByRole = page
        .getByRole("button", { name: /ログイン/ })
        .filter({ hasText: /ログインする|ログイン/i })
        .first();
      if ((await buttonByRole.count()) > 0) {
        await buttonByRole.click();
      } else {
        await page.locator(selectors.loginSubmitButton).first().click();
      }

      const container = page.locator(selectors.loginContainer).first();
      await container.waitFor({ state: "detached", timeout: 10_000 }).catch(() => {
        console.warn("[iichi-draft] login form still visible; waiting for manual login");
        testInfo.annotations.push({
          type: "INFO",
          description: "ログイン後にモーダルが閉じていることを確認し、閉じない場合はブラウザで手動ログインして Resume を押してください。",
        });
        return page.pause();
      });
    });

    await test.step("マイページ・作品登録画面を開く", async () => {
      await page.goto(`${IICHI_ROOT_URL}${IICHI_ACCOUNT_PATH}`, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(new RegExp(`${IICHI_ACCOUNT_PATH.replace(/\//g, "\\/")}`));
      await page.goto(`${IICHI_ROOT_URL}${IICHI_NEW_ITEM_PATH}`, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(new RegExp(`${IICHI_NEW_ITEM_PATH.replace(/\//g, "\\/")}`));
    });

    await test.step("フォームに商品情報を入力", async () => {
      await page.fill(selectors.titleInput, mapped.title);
      await page.fill(selectors.descriptionTextarea, mapped.description);
      await page.fill(selectors.priceInput, mapped.price);
      await page.fill(selectors.stockInput, mapped.stock);

      if (ENABLE_IICHI_CATEGORY_SELECTION && mapped.categoryParentLabel) {
        const parentSelected = await selectDropdownByLabel(page, "カテゴリ", mapped.categoryParentLabel, 0);
        if (!parentSelected) {
          console.warn("[iichi-draft] 親カテゴリを選択できません", mapped.categoryParentLabel);
        }
      }

      if (ENABLE_IICHI_CATEGORY_SELECTION && mapped.categoryChildLabel) {
        const childSelected = await selectDropdownByLabel(page, "カテゴリ", mapped.categoryChildLabel, 1);
        if (!childSelected) {
          console.warn("[iichi-draft] 子カテゴリを選択できません", mapped.categoryChildLabel);
        }
      }

      if (mapped.materialLabel) {
        const materialSelected = await selectDropdownByLabel(page, "素材", mapped.materialLabel);
        if (!materialSelected) {
          console.warn("[iichi-draft] 素材を選択できません", mapped.materialLabel);
        }
      }

      const tempFiles = await downloadImages(mapped.imageUrls);
      let filesToUpload = tempFiles;
      const fallbackImage = path.resolve(process.cwd(), "public/vercel.svg");
      if (!filesToUpload.length && fs.existsSync(fallbackImage)) {
        filesToUpload = [fallbackImage];
      }
      try {
        if (filesToUpload.length) {
          const fileInput = page.locator(selectors.imageFileInput).first();
          await expect(fileInput).toBeAttached();
          await fileInput.setInputFiles(filesToUpload);
        } else {
          testInfo.annotations.push({
            type: "WARN",
            description: "画像URLがないため、手動で画像をアップロードしてください。",
          });
        }
      } finally {
        await cleanupTempFiles(tempFiles);
      }

      if (mapped.shippingMethodLabel) {
        const shippingSelected = await selectDropdownByLabel(page, "配送方法", mapped.shippingMethodLabel);
        if (!shippingSelected) {
          console.warn("[iichi-draft] 配送方法を選択できません", mapped.shippingMethodLabel);
        }
      }
    });

    await test.step("保存", async () => {
      const saveButton = page.getByRole("button", { name: /保存/ }).first();
      await expect(saveButton).toBeVisible();
      await saveButton.click();
      await expect(page.locator(".AfterPostPopup__title--jnwVU")).toHaveText(/保存されました/, {
        timeout: 15_000,
      });
      testInfo.annotations.push({
        type: "NEXT",
        description: "保存完了後のレビューや公開設定は画面上でご確認ください。",
      });
    });
  });
});

type IichiDraftMapped = {
  title: string;
  description: string;
  price: string;
  stock: string;
  categoryParentLabel: string | null;
  categoryChildLabel: string | null;
  materialLabel: string | null;
  shippingMethodLabel: string | null;
  imageUrls: string[];
};

async function pickProductForIichi(): Promise<SpreadsheetProductRecord | null> {
  const products = await googleSheetsProductRepository.listProducts();
  console.log("[iichi-draft] fetched products", products.length);
  for (const p of products) {
    console.log("[iichi-draft] candidate", p.id, p.platforms, p.syncStatus);
  }
  return (
    products.find(
      (product) =>
        product.platforms.some((platform) => platform.toLowerCase() === "iichi") &&
        product.syncStatus === "ready"
    ) ?? null
  );
}

function mapProductToIichiDraft(product: SpreadsheetProductRecord): IichiDraftMapped {
  const title =
    pickFirstNonEmpty(product.raw["iichi_title"], product.title, product.raw["title"]) ??
    `iichi商品 ${product.id}`;
  const description =
    pickFirstNonEmpty(
      product.raw["iichi_description"],
      product.description,
      product.raw["description"]
    ) ?? "";
  const price =
    (parseInteger(
      pickFirstNonEmpty(
        product.raw["iichi_price"],
        product.raw["price"],
        product.price != null ? product.price.toString() : null
      )
    ) ?? 0).toString();
  const stock =
    Math.max(
      1,
      parseInteger(
        pickFirstNonEmpty(
          product.raw["iichi_stock"],
          product.raw["inventory"],
          product.inventory != null ? product.inventory.toString() : null
        )
      ) ?? 1
    ).toString();

  return {
    title,
    description,
    price,
    stock,
    categoryParentLabel: pickFirstNonEmpty(
      product.raw["iichi_category_parent_label"],
      product.raw["category_common"],
      product.raw["category"]
    ),
    categoryChildLabel: pickFirstNonEmpty(
      product.raw["iichi_category_child_label"],
      product.raw["creema_category_level2_label"],
      product.raw["category_common"]
    ),
    materialLabel: pickFirstNonEmpty(
      product.raw["iichi_material_label"],
      product.raw["material"],
      product.raw["素材"]
    ),
    shippingMethodLabel: pickFirstNonEmpty(
      product.raw["iichi_shipping_method_label"],
      product.raw["shipping_method"],
      product.raw["配送方法"]
    ),
    imageUrls: parseImageUrls(
      pickFirstNonEmpty(
        product.raw["iichi_image_urls"],
        product.raw["image_urls"],
        product.raw["images"]
      )
    ),
  };
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
        console.warn("[iichi-draft] image download failed", url, response.status);
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
      const tempPath = path.join(os.tmpdir(), `iichi-image-${randomUUID()}${ext}`);
      await fsPromises.writeFile(tempPath, Buffer.from(arrayBuffer));
      console.log("[iichi-draft] image saved", url, tempPath, arrayBuffer.byteLength);
      results.push(tempPath);
    } catch (error) {
      console.warn("[iichi-draft] image download failed", url, error);
    }
  }
  return results;
}

async function cleanupTempFiles(files: string[]): Promise<void> {
  await Promise.all(
    files.map((file) =>
      fsPromises.unlink(file).catch((error) => {
        console.warn("[iichi-draft] temp image cleanup failed", file, error);
      })
    )
  );
}

async function selectDropdownByLabel(
  page: Page,
  labelText: string,
  optionText: string | null,
  occurrence = 0
): Promise<boolean> {
  if (!optionText) return false;
  const formItems = page
    .locator(".el-form-item")
    .filter({ has: page.locator(`.el-form-item__label:has-text("${labelText}")`) });
  const count = await formItems.count();
  if (!count) return false;
  const target = formItems.nth(Math.min(occurrence, count - 1));
  const selectWrapper = target.locator(".el-select__wrapper").first();
  const visibleDropdowns = page.locator(".el-select-dropdown:visible");
  const dropdownBefore = await visibleDropdowns.count();
  await selectWrapper.click();
  await page.waitForTimeout(200);
  let dropdown = page.locator(".el-select-dropdown:visible").nth(dropdownBefore);
  if ((await dropdown.count()) === 0) {
    dropdown = page.locator(".el-select-dropdown:visible").last();
  }
  const option = dropdown
    .locator(".el-select-dropdown__item")
    .filter({ hasText: optionText.trim() })
    .first();
  try {
    await option.waitFor({ timeout: 10_000 });
    await option.click();
    return true;
  } catch (error) {
    console.warn("[iichi-draft] select option not found", labelText, optionText, error);
    await page.keyboard.press("Escape").catch(() => {});
    return false;
  }
}

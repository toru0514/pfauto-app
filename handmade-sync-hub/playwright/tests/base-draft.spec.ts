import { expect, test } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { googleSheetsProductRepository } from "@/adapters/google-sheets/product-repository";
import type { SpreadsheetProductRecord } from "@/application/types/product";

const RUN_BASE_FLOW = process.env.PLAYWRIGHT_RUN_BASE === "true";
const BASE_LOGIN_PATH = "/users/login";
const BASE_ITEMS_PATH = "/shop_admin/items/";
const BASE_ADD_ITEM_PATH = "/shop_admin/items/add";
const LOCAL_SAMPLE_IMAGE = path.resolve(process.cwd(), "public/vercel.svg");

const emailSelector = "input[type='email'], input[name='email'], input#user_email";
const passwordSelector =
  "input[type='password'], input[name='password'], input#user_password";

test.describe("BASE 自動化フロー", () => {
  test.skip(!RUN_BASE_FLOW, "PLAYWRIGHT_RUN_BASE=true を指定したときのみ実行します。");

  test("ログインして管理画面へ遷移する", async ({ page }, testInfo) => {
    const baseEmail = process.env.PLAYWRIGHT_BASE_EMAIL;
    const basePassword = process.env.PLAYWRIGHT_BASE_PASSWORD;
    const baseOrigin = process.env.BASE_BASE_URL ?? "https://admin.thebase.com";

    test.skip(
      !baseEmail || !basePassword,
      "PLAYWRIGHT_BASE_EMAIL / PLAYWRIGHT_BASE_PASSWORD を設定してください。"
    );

    const product = await pickProductForBase();
    console.log(
      "[base-draft] product found?",
      Boolean(product),
      product?.id
    );
    test.skip(!product, "BASE 対象のシート商品が見つかりませんでした。");

    const mappedProduct = mapProductToBaseDraft(product!);

    testInfo.annotations.push({
      type: "TODO",
      description:
        "BASE のログインフォーム構造を確認し、セレクタや遷移先URLの検証を確定させる。",
    });

    await test.step("ログインページへ遷移", async () => {
      await page.goto(`${baseOrigin}${BASE_LOGIN_PATH}`, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/users\/login/);
      await expect(page.locator("form")).toBeVisible();
    });

    await test.step("認証情報を入力する", async () => {
      const emailInput = page.locator(emailSelector).first();
      const passwordInput = page.locator(passwordSelector).first();

      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();

      await emailInput.fill(baseEmail!);
      await passwordInput.fill(basePassword!);
    });

    await test.step("手動でログイン/追加認証を完了する", async () => {
      testInfo.annotations.push({
        type: "INFO",
        description:
          "メールアドレス/パスワード入力後、ブラウザ上でログインボタン押下と追加認証を手動で完了し、完了後に Resume を押してください。",
      });
      await page.pause();
    });

    await test.step("商品一覧ページを開く", async () => {
      const openItemsPage = async () => {
        await page.goto(`${baseOrigin}${BASE_ITEMS_PATH}`, {
          waitUntil: "domcontentloaded",
        });
        await expect(page).toHaveURL(new RegExp(`${BASE_ITEMS_PATH.replace(/\//g, "\\/")}`));
        await expect(
          page.getByRole("button", { name: /商品を登録する/i })
        ).toBeVisible();
      };

      try {
        await openItemsPage();
      } catch (error) {
        testInfo.annotations.push({
          type: "INFO",
          description:
            "商品を登録するボタンが見えない場合は、ブラウザでログイン/認証手続きを完了してから Resume を押してください。",
        });
        await page.pause();
        await openItemsPage();
      }
    });

    await test.step("商品登録ボタンを押下", async () => {
      await page.getByRole("button", { name: /商品を登録する/i }).click();
      await page.waitForURL(new RegExp(`${BASE_ADD_ITEM_PATH.replace(/\//g, "\\/")}`), {
        waitUntil: "domcontentloaded",
      });
      await expect(page).toHaveURL(new RegExp(`${BASE_ADD_ITEM_PATH.replace(/\//g, "\\/")}`));
      await expect(page.locator("body")).toContainText(/商品登録/i);
    });

    await test.step("公開設定を下書きに変更", async () => {
      const publishInput = page.locator(
        'xpath=//p[contains(normalize-space(),"公開する")]/ancestor::*[self::label or contains(@class,"c-checkbox")][1]//input[@type="checkbox"] | //input[@type="checkbox"][contains(@name,"publish")] | //input[@type="checkbox"][contains(@id,"publish")]'
      );

      const publishToggleArea = page.locator(
        'xpath=//p[contains(normalize-space(),"公開する")]/ancestor::*[self::label or contains(@class,"c-checkbox")]'
      );

      try {
        await publishInput.first().waitFor({ state: "attached", timeout: 5000 });
        const inputHandle = publishInput.first();
        if (await inputHandle.isChecked()) {
          try {
            await inputHandle.setChecked(false, { force: true });
          } catch {
            // fallback to clicking surrounding area
          }
        }

        if (await inputHandle.isChecked()) {
          await publishToggleArea.first().click({ force: true });
        }

        if (await inputHandle.isChecked()) {
          await page.evaluate(() => {
            const label = document.querySelector(
              'p.c-checkbox__text'
            );
            if (label) {
              const checkbox = label.closest(".c-checkbox")?.querySelector("input[type='checkbox']");
              if (checkbox) {
                checkbox.checked = false;
                checkbox.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }
          });
        }
      } catch (error) {
        testInfo.annotations.push({
          type: "WARN",
          description: "公開設定のチェックボックスを操作できませんでした。手動で外してください。",
        });
      }
    });

    await test.step("商品情報を入力", async () => {
      const tempImageFiles = await downloadImages(mappedProduct.imageUrls);
      let imageFiles = tempImageFiles;
      if (!imageFiles.length && fs.existsSync(LOCAL_SAMPLE_IMAGE)) {
        imageFiles = [LOCAL_SAMPLE_IMAGE];
      }

      await page.locator("#itemDetail_name").fill(mappedProduct.title);
      await page.locator("#itemDetail_detail").fill(mappedProduct.description);
      await page.locator("#itemDetail_price").fill(mappedProduct.price);
      await page.locator("#itemDetail_stock").fill(mappedProduct.stock);

      try {
        if (imageFiles.length) {
          await page.setInputFiles("input.m-uploadBox__input[type='file']", imageFiles);
        } else {
          testInfo.annotations.push({
            type: "WARN",
            description: "画像URLが見つからないため、手動で画像をアップロードしてください。",
          });
        }
      } finally {
        await cleanupTempFiles(tempImageFiles);
      }
    });

    await test.step("商品を登録ボタンで送信", async () => {
      await Promise.all([
        page.waitForLoadState("networkidle"),
        page
          .getByRole("button", { name: /商品を登録/i })
          .first()
          .click(),
      ]);
    });
  });
});

type BaseDraftMapped = {
  title: string;
  description: string;
  price: string;
  stock: string;
  imageUrls: string[];
};

async function pickProductForBase(): Promise<SpreadsheetProductRecord | null> {
  const products = await googleSheetsProductRepository.listProducts();
  console.log("[base-draft] fetched products", products.length);
  for (const p of products) {
    console.log("[base-draft] candidate", p.id, p.platforms, p.syncStatus);
  }
  return (
    products.find(
      (product) =>
        product.platforms.some((platform) => platform.toLowerCase() === "base") &&
        product.syncStatus === "ready"
    ) ?? null
  );
}

function mapProductToBaseDraft(product: SpreadsheetProductRecord): BaseDraftMapped {
  const title =
    pickFirstNonEmpty(product.raw["base_title"], product.title, product.raw["title"]) ??
    `BASE商品 ${product.id}`;
  const description =
    pickFirstNonEmpty(
      product.raw["base_description"],
      product.description,
      product.raw["description"]
    ) ?? "";
  const priceCandidate = pickFirstNonEmpty(
    product.raw["base_price"],
    product.raw["price"],
    product.price != null ? product.price.toString() : null
  );
  const stockCandidate = pickFirstNonEmpty(
    product.raw["base_inventory"],
    product.raw["inventory"],
    product.inventory != null ? product.inventory.toString() : null
  );
  const priceValue = parseInteger(priceCandidate);
  const stockValue = parseInteger(stockCandidate);

  const normalizedPrice = priceValue && priceValue > 0 ? priceValue : 1000;
  const normalizedStock = stockValue && stockValue > 0 ? stockValue : 1;

  const imageUrls = Array.from(
    new Set(
      parseImageUrls(
        pickFirstNonEmpty(
          product.raw["base_image_urls"],
          product.raw["image_urls"],
          product.raw["images"]
        )
      )
    )
  ).slice(0, 10);

  return {
    title,
    description,
    price: normalizedPrice.toString(),
    stock: normalizedStock.toString(),
    imageUrls,
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
        console.warn("[base-draft] image download failed", url, response.status);
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
      const tempPath = path.join(os.tmpdir(), `base-image-${randomUUID()}${ext}`);
      await fsPromises.writeFile(tempPath, Buffer.from(arrayBuffer));
      console.log("[base-draft] image saved", url, tempPath, arrayBuffer.byteLength);
      results.push(tempPath);
    } catch (error) {
      console.warn("[base-draft] image download failed", url, error);
    }
  }
  return results;
}

async function cleanupTempFiles(files: string[]): Promise<void> {
  await Promise.all(
    files.map((file) =>
      fsPromises.unlink(file).catch((error) => {
        console.warn("[base-draft] temp image cleanup failed", file, error);
      })
    )
  );
}

import { expect, test } from "@playwright/test";
import { googleSheetsProductRepository } from "@/adapters/google-sheets/product-repository";
import type { SpreadsheetProductRecord } from "@/application/types/product";

const RUN_CREEMA_FLOW = process.env.PLAYWRIGHT_RUN_CREEMA === "true";
// デバッグ用ログ（必要に応じて削除）
console.log(
  "[creema-draft] PLAYWRIGHT_RUN_CREEMA=",
  JSON.stringify(process.env.PLAYWRIGHT_RUN_CREEMA)
);
const CREEMA_LOGIN_PATH = "/user/login";
const CREEMA_AFTER_LOGIN_PATH = "/my/home";
const CREEMA_NEW_ITEM_PATH = "/my/item/create";

const selectors = {
  loginEmail: "input[name='email']", // TODO: フォーム構造に合わせて更新
  loginPassword: "input[name='password']",
  loginSubmit: "input.js-user-login-button",
  titleInput: "#form-item-title",
  descriptionInput: "#form-item-description",
  priceInput: "#form-item-price",
  stockSelect: "select.js-attach-stock",
  tagInput: "input[name='tags']",
  saveDraftButton: "button[data-testid='draft-save']", // TODO: 実際の属性に合わせる
};

test.describe("Creema 自動化フロー", () => {
  test.skip(!RUN_CREEMA_FLOW, "PLAYWRIGHT_RUN_CREEMA=true を指定したときのみ実行します。");

  test("ログインして下書き保存直前まで進める", async ({ page, baseURL }, testInfo) => {
    const email = process.env.PLAYWRIGHT_CREEMA_EMAIL;
    const password = process.env.PLAYWRIGHT_CREEMA_PASSWORD;
    console.log(
      "[creema-draft] credentials",
      JSON.stringify(email),
      JSON.stringify(password ? "***" : password)
    );

    test.skip(!email || !password, "PLAYWRIGHT_CREEMA_EMAIL / PASSWORD を設定してください。");

    const product = await pickProductForCreema();
    console.log(
      "[creema-draft] product found?",
      Boolean(product),
      product?.id
    );
    test.skip(!product, "Creema 対象のシート商品が見つかりませんでした。");

    testInfo.annotations.push({
      type: "TODO",
      description:
        "selectors オブジェクトを実際の Creema 画面に合わせて調整してください。",
    });

    await test.step("ログインページへ遷移", async () => {
      await page.goto(`${baseURL ?? "https://www.creema.jp"}${CREEMA_LOGIN_PATH}`);
      await expect(page).toHaveURL(/\/user\/login/);
    });

    await test.step("認証情報を入力", async () => {
      await page.fill(selectors.loginEmail, email!);
      await page.fill(selectors.loginPassword, password!);
      await Promise.all([
        page.waitForURL(
          `${baseURL ?? "https://www.creema.jp"}${CREEMA_AFTER_LOGIN_PATH}`,
          { timeout: 120_000 }
        ),
        page.click(selectors.loginSubmit),
      ]);
    });

    await test.step("商品登録画面を開く", async () => {
      await page.goto(`${baseURL ?? "https://www.creema.jp"}${CREEMA_NEW_ITEM_PATH}`);
      await expect(page).toHaveURL(/\/my\/item\/create/);
    });

    const mapped = mapProductToCreemaDraft(product!);

    await test.step("フォームに商品情報を入力", async () => {
      await page.fill(selectors.titleInput, mapped.title);
      await page.fill(selectors.descriptionInput, mapped.description);
      await page.fill(selectors.priceInput, mapped.price);
      await page.selectOption(selectors.stockSelect, mapped.stock);

      if (mapped.tags.length) {
        for (const tag of mapped.tags) {
          await page.fill(selectors.tagInput, tag);
          await page.keyboard.press("Enter");
        }
      }

      // TODO: 画像アップロードやカテゴリ選択など、Creema 固有の必須項目を追記
    });

    await test.step("下書き保存直前で停止", async () => {
      await expect(page.locator(selectors.saveDraftButton)).toBeVisible();
      testInfo.annotations.push({
        type: "NEXT",
        description:
          "実際に保存を行う場合は `page.click(selectors.saveDraftButton)` を有効化してください。",
      });
    });
  });
});

async function pickProductForCreema(): Promise<SpreadsheetProductRecord | null> {
  const products = await googleSheetsProductRepository.listProducts();
  console.log("[creema-draft] fetched products", products.length);
  for (const p of products) {
    console.log(
      "[creema-draft] candidate",
      p.id,
      p.platforms,
      p.syncStatus
    );
  }
  return (
    products.find(
      (product) =>
        product.platforms.some((platform) => platform.toLowerCase() === "creema") &&
        product.syncStatus === "ready"
    ) ?? null
  );
}

type CreemaDraftMapped = {
  title: string;
  description: string;
  price: string;
  stock: string;
  tags: string[];
};

function mapProductToCreemaDraft(product: SpreadsheetProductRecord): CreemaDraftMapped {
  const price = product.price ?? 0;
  const inventory = product.inventory ?? 1;
  const tags = product.tags.slice(0, 5);

  return {
    title: product.title,
    description: product.description,
    price: price.toString(),
    stock: inventory.toString(),
    tags,
  };
}

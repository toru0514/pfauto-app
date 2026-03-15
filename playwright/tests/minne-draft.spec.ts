import { expect, test } from "@playwright/test";
import { googleSheetsProductRepository } from "@/adapters/google-sheets/product-repository";
import type { SpreadsheetProductRecord } from "@/application/types/product";
import { MinnePage } from "./page-objects/minne-page";
import { pickFirstNonEmpty, parseInteger, parseImageUrls, normalizeId, cleanupTempFiles } from "./shared/utils";

const RUN_MINNE_FLOW = process.env.PLAYWRIGHT_RUN_MINNE === "true";

test.describe("minne 自動化フロー", () => {
  test.skip(!RUN_MINNE_FLOW, "PLAYWRIGHT_RUN_MINNE=true を指定したときのみ実行します。");

  test("ログインして商品登録フォームに下書きを入力", async ({ page }, testInfo) => {
    const minneEmail = process.env.PLAYWRIGHT_MINNE_EMAIL;
    test.skip(!minneEmail, "PLAYWRIGHT_MINNE_EMAIL を設定してください。");

    const products = await listProductsForMinne();
    console.log(
      "[minne-draft] ready products",
      products.map((p) => p.id)
    );
    test.skip(!products.length, "minne 対象のシート商品が見つかりませんでした。");

    const minnePage = new MinnePage(page);

    await test.step("ログインリンクを送信", async () => {
      await minnePage.sendLoginLink(minneEmail!);
      testInfo.annotations.push({
        type: "INFO",
        description:
          "メールに届く minne のログインリンクを開いてください。開いた後、Playwright Inspector で Resume を押すと次に進みます。",
      });
    });

    await test.step("マイページを開く", async () => {
      await minnePage.navigateToHome();
    });

    for (const product of products) {
      const mapped = mapProductToMinneDraft(product);
      await test.step(`作品 ${product.id} の入力`, async () => {
        await minnePage.navigateToNewProduct();
        await minnePage.fillTitle(mapped.title);
        await minnePage.selectCategory(mapped.categoryParentId, mapped.categoryId);
        await minnePage.fillDescription(mapped.description);
        await minnePage.fillPrice(mapped.price);
        await minnePage.fillStock(mapped.stock);
        await minnePage.fillShippingDays(mapped.shippingDays);

        const imageFiles = await minnePage.uploadImages(mapped.imageUrls);
        try {
          if (!imageFiles.length && !mapped.imageUrls.length) {
            testInfo.annotations.push({
              type: "WARN",
              description: "画像URLがないため、手動で画像をアップロードしてください。",
            });
          }

          await minnePage.fillShipping(
            mapped.shippingMethod,
            mapped.shippingArea,
            mapped.shippingFee,
            mapped.shippingAdditionalFee
          );

          await minnePage.submitForm();
        } finally {
          await cleanupTempFiles(imageFiles, "minne");
        }
      });
    }
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

async function listProductsForMinne(): Promise<SpreadsheetProductRecord[]> {
  const products = await googleSheetsProductRepository.listProducts();
  console.log("[minne-draft] fetched products", products.length);
  for (const p of products) {
    console.log("[minne-draft] candidate", p.id, p.platforms, p.syncStatus);
  }
  return products.filter(
    (product) =>
      product.platforms.some((platform) => platform.toLowerCase() === "minne") &&
      product.syncStatus === "ready"
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

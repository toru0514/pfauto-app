import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { googleSheetsProductRepository } from "@/adapters/google-sheets/product-repository";
import type { SpreadsheetProductRecord } from "@/application/types/product";
import {
  isValidCreemaLevel1CategoryId,
  isValidCreemaLevel2CategoryId,
  resolveCreemaCategoryPath,
} from "./creema-categories";

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
  materialSelect: "#form-item-material-id",
  imageFileInput: "input.js-file-upload",
  shippingOriginSelect: "select[name='item[delivery_from_prefecture_id]']",
  shippingMethodSelect: "select[name='item[shipping_methods][]']",
  craftPeriodSelect: "select[name='item[craft_period]']",
  sizeTextarea: "#form-item-size-freeinput",
  categoryLevel1Select: "#form-item-level1-category-id",
  categoryLevel2Select: "#form-item-level2-category-id",
  categoryLevel3Select: "#form-item-level3-category-id",
  colorCheckboxes: "input.js-item-skus-color-ids",
  categoryLevel1Select: "#form-item-level1-category-id",
  categoryLevel2Select: "#form-item-level2-category-id",
  tagHiddenInput: "#form-item-tags",
  nextStepButton: "input.js-item-next",
  confirmButton: "input.js-item-confirm",
  saveDraftButton: "input.js-item-form-draft",
};

const CREEMA_MATERIAL_OPTIONS = [
  { id: "2", label: "シルバー", aliases: ["銀", "silver", "sv"] },
  { id: "3", label: "粘土、陶土 （土類）", aliases: ["粘土", "陶土", "土類"] },
  { id: "4", label: "ゴールド", aliases: ["金", "gold", "k18", "k10"] },
  { id: "5", label: "フェルト、羊毛", aliases: ["フェルト", "羊毛", "ウール"] },
  { id: "6", label: "リネン、麻、綿麻", aliases: ["麻", "綿麻", "リネン"] },
  { id: "7", label: "レジン・樹脂", aliases: ["レジン", "樹脂", "resin"] },
  { id: "8", label: "ビーズ、スワロ", aliases: ["ビーズ", "スワロ", "スワロフスキー"] },
  { id: "9", label: "プラスティック", aliases: ["プラスチック", "アクリル"] },
  { id: "10", label: "皮、革、レザー", aliases: ["革", "レザー", "皮"] },
  { id: "11", label: "紙、段ボール", aliases: ["紙", "段ボール", "和紙"] },
  { id: "12", label: "木材", aliases: ["木", "ウッド"] },
  { id: "13", label: "その他金属", aliases: ["金属", "ブラス", "メタル"] },
  { id: "14", label: "ひも、ヘンプ", aliases: ["ひも", "紐", "ヘンプ", "コード"] },
  { id: "16", label: "リボン、ボタン", aliases: ["リボン", "ボタン"] },
  { id: "17", label: "花・木の実・枝葉・果実", aliases: ["花", "木の実", "枝葉", "果実", "ドライフラワー"] },
  { id: "18", label: "コットン", aliases: ["コットン", "綿"] },
  { id: "19", label: "レース、糸", aliases: ["レース", "糸", "ヤーン"] },
  { id: "20", label: "布", aliases: ["布", "ファブリック", "生地"] },
  { id: "21", label: "その他", aliases: ["その他", "other"] },
  { id: "22", label: "アクリル絵具、油絵具", aliases: ["アクリル絵具", "油絵具", "絵具"] },
  { id: "23", label: "水彩絵具、墨", aliases: ["水彩", "墨", "インク"] },
  { id: "24", label: "クレパス、色鉛筆、ペン　", aliases: ["クレパス", "色鉛筆", "ペン"] },
  { id: "25", label: "インクジェット・ほか画材", aliases: ["インクジェット", "画材"] },
  { id: "26", label: "パール・コットンパール", aliases: ["パール", "コットンパール"] },
  { id: "27", label: "天然石", aliases: ["天然石", "ストーン", "gem"] },
  { id: "28", label: "毛糸", aliases: ["毛糸", "ウールヤーン"] },
  { id: "29", label: "ガラス・ステンドグラス", aliases: ["ガラス", "ステンドグラス"] },
  { id: "30", label: "真鍮", aliases: ["真鍮", "ブラス"] },
  { id: "31", label: "帆布・キャンバス", aliases: ["帆布", "キャンバス"] },
];

const MATERIAL_ALIAS_MAP = buildMaterialAliasMap(CREEMA_MATERIAL_OPTIONS);

const PREFECTURE_ENTRIES: Array<{ id: string; labels: string[] }> = [
  { id: "1", labels: ["北海道"] },
  { id: "2", labels: ["青森県", "青森"] },
  { id: "3", labels: ["岩手県", "岩手"] },
  { id: "4", labels: ["宮城県", "宮城"] },
  { id: "5", labels: ["秋田県", "秋田"] },
  { id: "6", labels: ["山形県", "山形"] },
  { id: "7", labels: ["福島県", "福島"] },
  { id: "8", labels: ["茨城県", "茨城"] },
  { id: "9", labels: ["栃木県", "栃木"] },
  { id: "10", labels: ["群馬県", "群馬"] },
  { id: "11", labels: ["埼玉県", "埼玉"] },
  { id: "12", labels: ["千葉県", "千葉"] },
  { id: "13", labels: ["東京都", "東京"] },
  { id: "14", labels: ["神奈川県", "神奈川"] },
  { id: "15", labels: ["新潟県", "新潟"] },
  { id: "16", labels: ["富山県", "富山"] },
  { id: "17", labels: ["石川県", "石川"] },
  { id: "18", labels: ["福井県", "福井"] },
  { id: "19", labels: ["山梨県", "山梨"] },
  { id: "20", labels: ["長野県", "長野"] },
  { id: "21", labels: ["岐阜県", "岐阜"] },
  { id: "22", labels: ["静岡県", "静岡"] },
  { id: "23", labels: ["愛知県", "愛知"] },
  { id: "24", labels: ["三重県", "三重"] },
  { id: "25", labels: ["滋賀県", "滋賀"] },
  { id: "26", labels: ["京都府", "京都"] },
  { id: "27", labels: ["大阪府", "大阪"] },
  { id: "28", labels: ["兵庫県", "兵庫"] },
  { id: "29", labels: ["奈良県", "奈良"] },
  { id: "30", labels: ["和歌山県", "和歌山"] },
  { id: "31", labels: ["鳥取県", "鳥取"] },
  { id: "32", labels: ["島根県", "島根"] },
  { id: "33", labels: ["岡山県", "岡山"] },
  { id: "34", labels: ["広島県", "広島"] },
  { id: "35", labels: ["山口県", "山口"] },
  { id: "36", labels: ["徳島県", "徳島"] },
  { id: "37", labels: ["香川県", "香川"] },
  { id: "38", labels: ["愛媛県", "愛媛"] },
  { id: "39", labels: ["高知県", "高知"] },
  { id: "40", labels: ["福岡県", "福岡"] },
  { id: "41", labels: ["佐賀県", "佐賀"] },
  { id: "42", labels: ["長崎県", "長崎"] },
  { id: "43", labels: ["熊本県", "熊本"] },
  { id: "44", labels: ["大分県", "大分"] },
  { id: "45", labels: ["宮崎県", "宮崎"] },
  { id: "46", labels: ["鹿児島県", "鹿児島"] },
  { id: "47", labels: ["沖縄県", "沖縄"] },
  { id: "48", labels: ["その他"] },
  { id: "49", labels: ["海外"] },
];

const PREFECTURE_ALIAS_MAP = buildPrefectureAliasMap(PREFECTURE_ENTRIES);

const SHIPPING_METHOD_ENTRIES: Array<{ id: string; labels: string[] }> = [
  { id: "1920251", labels: ["宅急便コンパクト", "ヤマト宅急便コンパクト"] },
  { id: "1712550", labels: ["定形外郵便-100g以内（規格外）", "定形外郵便"] },
  { id: "1717715", labels: ["送料無料", "送料無料（国内）", "送料無料(国内)"] },
  { id: "1717714", labels: ["送料無料（海外）", "送料無料(海外)"] },
];

const SHIPPING_METHOD_ALIAS_MAP = buildShippingMethodAliasMap(SHIPPING_METHOD_ENTRIES);

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
      if (mapped.imageUrls.length) {
        await uploadImages(page, selectors.imageFileInput, mapped.imageUrls);
      }

      await page.fill(selectors.titleInput, mapped.title);
      await page.fill(selectors.descriptionInput, mapped.description);
      await page.fill(selectors.priceInput, mapped.price);
      await page.selectOption(selectors.stockSelect, mapped.stock);

      if (mapped.materialId) {
        const materialSelect = page.locator(selectors.materialSelect);
        await expect(materialSelect).toBeAttached();
        await materialSelect.selectOption(mapped.materialId).catch(() => {
          console.warn(
            "[creema-draft] material option not selectable",
            mapped.materialId
          );
        });
      } else {
        console.warn(
          "[creema-draft] material not resolved",
          product!.id,
          product!.raw["creema_material_id"],
          product!.raw["creema_material_label"],
          product!.raw["material"]
        );
      }

      if (mapped.categoryLevel1Id) {
        await page.selectOption(selectors.categoryLevel1Select, mapped.categoryLevel1Id);

        if (mapped.categoryLevel2Id) {
          const level2 = page.locator(selectors.categoryLevel2Select);
          await expect(level2).toBeEnabled({ timeout: 15_000 });

          const optionLocator = page.locator(
            `${selectors.categoryLevel2Select} option[value="${mapped.categoryLevel2Id}"]`
          );
          await expect(optionLocator).toHaveCount(1, { timeout: 15_000 });

          await level2.selectOption(mapped.categoryLevel2Id).catch(async () => {
            console.warn(
              "[creema-draft] level2 option not selectable",
              mapped.categoryLevel2Id
            );
          });

          if (mapped.categoryLevel3Id || mapped.categoryLevel3Label) {
            const success = await setSelectValueByIdOrLabel(
              page,
              selectors.categoryLevel3Select,
              mapped.categoryLevel3Id,
              mapped.categoryLevel3Label
            );
            if (!success) {
              console.warn(
                "[creema-draft] level3 option not selectable",
                mapped.categoryLevel3Id ?? mapped.categoryLevel3Label
              );
            }
          }
        }
      }

      if (mapped.colorIds.length) {
        for (const colorId of mapped.colorIds) {
          const checkbox = page.locator(`${selectors.colorCheckboxes}[value="${colorId}"]`);
          await expect(checkbox).toBeVisible();
          await checkbox.check({ force: true });
        }
      }

      // キーワードタグの入力は一時停止（使用不可文字の検証後に再開）

      // TODO: 画像アップロードなど、Creema 固有の必須項目を追記
    });

    await test.step("発送情報を入力", async () => {
      await page.click(selectors.nextStepButton);

      if (mapped.shippingOriginPrefectureId) {
        const success = await setSelectValue(
          page,
          selectors.shippingOriginSelect,
          mapped.shippingOriginPrefectureId
        );
        if (!success) {
          console.warn(
            "[creema-draft] shipping origin option not selectable",
            mapped.shippingOriginPrefectureId
          );
        }
      } else if (
        pickFirstNonEmpty(
          product!.raw["creema_shipping_origin_pref"],
          product!.raw["shipping_origin_pref"],
          product!.raw["発送元都道府県"],
          product!.raw["発送元"]
        )
      ) {
        console.warn("[creema-draft] shipping origin not resolved", product!.id);
      }

      if (mapped.shippingMethodId) {
        const success = await setSelectValue(
          page,
          selectors.shippingMethodSelect,
          mapped.shippingMethodId
        );
        if (!success) {
          console.warn(
            "[creema-draft] shipping method not selectable",
            mapped.shippingMethodId
          );
        }
      } else if (
        pickFirstNonEmpty(
          product!.raw["creema_shipping_method"],
          product!.raw["shipping_method"],
          product!.raw["配送方法"]
        )
      ) {
        console.warn("[creema-draft] shipping method not resolved", product!.id);
      }

      if (mapped.craftPeriodId) {
        const success = await setSelectValue(
          page,
          selectors.craftPeriodSelect,
          mapped.craftPeriodId
        );
        if (!success) {
          console.warn(
            "[creema-draft] craft period not selectable",
            mapped.craftPeriodId
          );
        }
      } else if (
        pickFirstNonEmpty(
          product!.raw["creema_craft_period_id"],
          product!.raw["production_lead_time_days"],
          product!.raw["制作期間"]
        )
      ) {
        console.warn("[creema-draft] craft period not resolved", product!.id);
      }

      if (mapped.sizeFreeInput) {
        const success = await setTextareaValue(page, selectors.sizeTextarea, mapped.sizeFreeInput);
        if (!success) {
          console.warn("[creema-draft] size textarea not fillable", mapped.sizeFreeInput);
        }
      }
    });

    await test.step("入力内容を確認", async () => {
      const confirmButton = page.locator(selectors.confirmButton);
      await expect(confirmButton).toBeVisible();
      await Promise.all([
        page.waitForNavigation({ waitUntil: "load" }),
        confirmButton.click(),
      ]);
      await expect(page).toHaveURL(/\/my\/item\/input\/preview/);
      testInfo.annotations.push({
        type: "NEXT",
        description:
          "プレビューで内容を確認し、下書きを保存する場合は保存ボタンをクリックしてください。",
      });
    });

    await test.step("下書きを保存", async () => {
      const saveButton = page
        .locator(`${selectors.saveDraftButton}[value="保存する"]:visible`)
        .first();
      await expect(saveButton).toBeVisible();
      await saveButton.scrollIntoViewIfNeeded();
      await Promise.all([
        page.waitForNavigation({ waitUntil: "load" }),
        saveButton.click(),
      ]);
      await expect(page).toHaveURL(/\/my\/item\/list\?status=draft/);
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
  materialId: string | null;
  imageUrls: string[];
  shippingOriginPrefectureId: string | null;
  shippingMethodId: string | null;
  craftPeriodId: string | null;
  sizeFreeInput: string | null;
  categoryLevel1Id: string | null;
  categoryLevel2Id: string | null;
  categoryLevel3Id: string | null;
  categoryLevel3Label: string | null;
  colorIds: string[];
};

function mapProductToCreemaDraft(product: SpreadsheetProductRecord): CreemaDraftMapped {
  const price = product.price ?? 0;
  const inventory = product.inventory ?? 1;
  const tags = product.tags.slice(0, 5);
  const materialId = resolveMaterialId(
    product.id,
    normalizeId(product.raw["creema_material_id"] ?? product.raw["material_id"]),
    [
      product.raw["creema_material_label"],
      product.raw["creema_material"],
      product.raw["material"],
      product.raw["素材"],
    ]
  );
  const shippingOriginPrefectureId = resolvePrefectureId(
    pickFirstNonEmpty(
      product.raw["creema_shipping_origin_pref"],
      product.raw["shipping_origin_pref"],
      product.raw["発送元都道府県"],
      product.raw["発送元"]
    )
  );

  const shippingMethodId = resolveShippingMethodId(
    pickFirstNonEmpty(
      product.raw["creema_shipping_method"],
      product.raw["shipping_method"],
      product.raw["配送方法"]
    )
  );

  const craftPeriodId = resolveCraftPeriodId(
    parseInteger(
      pickFirstNonEmpty(
        product.raw["creema_craft_period_days"],
        product.raw["production_lead_time_days"],
        product.raw["制作期間"]
      )
    )
  );

  const sizeFreeInput = buildSizeFreeInput(
    pickFirstNonEmpty(
      product.raw["creema_size_free_input"],
      product.raw["size_notes"],
      product.raw["サイズ"]
    ),
    pickFirstNonEmpty(
      product.raw["creema_weight_grams"],
      product.raw["weight_grams"],
      product.raw["重量"]
    )
  );
  const imageUrls = parseImageUrls(product.raw["image_urls"]);

  const categoryPathFromSheet = pickFirstNonEmpty(
    product.raw["creema_category_path"],
    product.raw["creema_category"],
    product.raw["category_path"],
    product.raw["category_common"],
    product.raw["category"],
    product.raw["カテゴリ"],
    product.raw["カテゴリー"]
  );

  const categoryLevel1Label = pickFirstNonEmpty(
    product.raw["creema_category_level1_label"],
    product.raw["creema_category_level1_name"],
    product.raw["creema_category_level1"]
  );
  const categoryLevel2Label = pickFirstNonEmpty(
    product.raw["creema_category_level2_label"],
    product.raw["creema_category_level2_name"],
    product.raw["creema_category_level2"]
  );
  const categoryLevel3Label = pickFirstNonEmpty(
    product.raw["creema_category_level3_label"],
    product.raw["creema_category_level3_name"],
    product.raw["creema_category_level3"]
  );

  const resolvedCategoryPath = resolveCreemaCategoryPath(categoryPathFromSheet, {
    level1Label: categoryLevel1Label,
    level2Label: categoryLevel2Label,
  });

  let categoryLevel1Id = normalizeId(
    product.raw["creema_category_id"] ?? product.raw["creema_category1_id"]
  );
  if (categoryLevel1Id && !isValidCreemaLevel1CategoryId(categoryLevel1Id)) {
    console.warn(
      "[creema-draft] 無効な第一階層カテゴリIDを検出",
      product.id,
      categoryLevel1Id
    );
    categoryLevel1Id = null;
  }
  if (!categoryLevel1Id && resolvedCategoryPath.level1Id) {
    categoryLevel1Id = resolvedCategoryPath.level1Id;
  }

  let categoryLevel2Id = normalizeId(
    product.raw["creema_category2_id"] ??
      product.raw["creema_subcategory_id"] ??
      product.raw["creema_category_level2_id"]
  );
  if (categoryLevel2Id) {
    if (categoryLevel1Id) {
      if (!isValidCreemaLevel2CategoryId(categoryLevel1Id, categoryLevel2Id)) {
        console.warn(
          "[creema-draft] 無効な第二階層カテゴリIDを検出",
          product.id,
          categoryLevel1Id,
          categoryLevel2Id
        );
        categoryLevel2Id = null;
      }
    } else {
      console.warn(
        "[creema-draft] 第二階層カテゴリIDが設定されていますが第一階層が未確定です",
        product.id,
        categoryLevel2Id
      );
      categoryLevel2Id = null;
    }
  }

  if (categoryLevel1Id && !categoryLevel2Id && resolvedCategoryPath.level2Id) {
    if (isValidCreemaLevel2CategoryId(categoryLevel1Id, resolvedCategoryPath.level2Id)) {
      categoryLevel2Id = resolvedCategoryPath.level2Id;
    }
  }

  let categoryLevel3Id = normalizeId(
    product.raw["creema_category3_id"] ??
      product.raw["creema_subcategory2_id"] ??
      product.raw["creema_category_level3_id"]
  );
  const categoryLevel3LabelResolved =
    categoryLevel3Label ?? resolvedCategoryPath.level3Label ?? null;
  if (categoryLevel3Id && !categoryLevel2Id) {
    console.warn(
      "[creema-draft] 第三階層カテゴリIDが設定されていますが第二階層が未確定です",
      product.id,
      categoryLevel3Id
    );
    categoryLevel3Id = null;
  }

  const colorIds = parseColorIds(
    product.raw["creema_color_ids"] ?? product.raw["color_ids"] ?? ""
  );

  return {
    title: product.title,
    description: product.description,
    price: price.toString(),
    stock: inventory.toString(),
    tags,
    materialId,
    imageUrls,
    shippingOriginPrefectureId,
    shippingMethodId,
    craftPeriodId,
    sizeFreeInput,
    categoryLevel1Id,
    categoryLevel2Id,
    categoryLevel3Id,
    categoryLevel3Label: categoryLevel3LabelResolved,
    colorIds,
  };
}

function normalizeId(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseColorIds(value: string): string[] {
  if (!value) return [];
  return value
    .split(/[\s,、;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseImageUrls(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function setSelectValue(page: Page, selector: string, value: string): Promise<boolean> {
  if (!value) return false;
  return page.evaluate(
    ({ selector, value }) => {
      const element = document.querySelector<HTMLSelectElement>(selector);
      if (!element) return false;
      const hasOption = Array.from(element.options).some((option) => option.value === value);
      if (!hasOption) return false;
      element.value = value;
      const ev = { bubbles: true, cancelable: true };
      element.dispatchEvent(new Event("input", ev));
      element.dispatchEvent(new Event("change", ev));
      return true;
    },
    { selector, value }
  );
}

async function setSelectValueByIdOrLabel(
  page: Page,
  selector: string,
  id: string | null,
  label: string | null
): Promise<boolean> {
  if (!id && !label) return false;
  const selectLocator = page.locator(selector);
  if (!(await selectLocator.count())) return false;
  await page
    .waitForFunction(
      (sel) => {
        const element = document.querySelector<HTMLSelectElement>(sel);
        return !!element && element.options.length > 1;
      },
      selector,
      { timeout: 10_000 }
    )
    .catch(() => {});

  return page.evaluate(
    ({ selector, id, label }) => {
      const element = document.querySelector<HTMLSelectElement>(selector);
      if (!element) return false;
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") {
        element.classList.remove("u-hide");
        element.style.display = "";
        element.removeAttribute("style");
      }
      const options = Array.from(element.options);
      let targetValue: string | null = null;
      if (id && options.some((option) => option.value === id)) {
        targetValue = id;
      } else if (label) {
        const normalizedLabel = label.trim();
        const matched = options.find((option) =>
          (option.textContent ?? "").trim() === normalizedLabel
        );
        if (matched) {
          targetValue = matched.value;
        }
      }
      if (!targetValue) return false;
      element.value = targetValue;
      const ev = { bubbles: true, cancelable: true };
      element.dispatchEvent(new Event("input", ev));
      element.dispatchEvent(new Event("change", ev));
      return true;
    },
    { selector, id, label }
  );
}

async function setTextareaValue(page: Page, selector: string, value: string): Promise<boolean> {
  if (!value) return false;
  return page.evaluate(
    ({ selector, value }) => {
      const element = document.querySelector<HTMLTextAreaElement>(selector);
      if (!element) return false;
      element.value = value;
      const ev = { bubbles: true, cancelable: true };
      element.dispatchEvent(new Event("input", ev));
      element.dispatchEvent(new Event("change", ev));
      return true;
    },
    { selector, value }
  );
}

async function uploadImages(page: Page, selector: string, urls: string[]): Promise<void> {
  const normalized = Array.from(new Set(urls.filter(Boolean))).slice(0, 10);
  if (!normalized.length) return;
  console.log("[creema-draft] image upload start", normalized);
  const files = await downloadImages(normalized);
  console.log("[creema-draft] image downloaded", files);
  if (!files.length) return;
  try {
    await expect(page.locator(selector)).toBeAttached();
    await page.setInputFiles(selector, files);
    await waitForImagePreview(page, files.length);
    console.log("[creema-draft] image upload completed", files);
  } catch (error) {
    console.warn("[creema-draft] image upload failed", error);
  } finally {
    await Promise.all(
      files.map((file) =>
        fs
          .unlink(file)
          .catch((unlinkError) => console.warn("[creema-draft] temp image cleanup failed", file, unlinkError))
      )
    );
  }
}

async function downloadImages(urls: string[]): Promise<string[]> {
  const results: string[] = [];
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn("[creema-draft] image download failed", url, response.status);
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
      const tempPath = path.join(os.tmpdir(), `creema-image-${randomUUID()}${ext}`);
      await fs.writeFile(tempPath, Buffer.from(arrayBuffer));
      console.log("[creema-draft] image saved", url, tempPath, arrayBuffer.byteLength);
      results.push(tempPath);
    } catch (error) {
      console.warn("[creema-draft] image download failed", url, error);
    }
  }
  return results;
}

async function waitForImagePreview(page: Page, expectedCount: number): Promise<void> {
  try {
    const preview = page.locator("#js-preview-item-image");
    await preview.waitFor({ state: "visible", timeout: 15_000 });
    const previewItems = preview.locator(".p-item-preview-images__media, .p-item-preview-images__seed");
    await expect(previewItems).toHaveCount(expectedCount, { timeout: 15_000 });
  } catch (error) {
    console.warn("[creema-draft] image preview wait failed", error);
  }
}

function resolvePrefectureId(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = normalizePrefectureToken(value);
  return PREFECTURE_ALIAS_MAP.get(normalized) ?? null;
}

function resolveShippingMethodId(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = normalizeShippingMethodToken(value);
  const matches = SHIPPING_METHOD_ALIAS_MAP.get(normalized);
  if (!matches || matches.length === 0) return null;
  return matches[0];
}

function resolveCraftPeriodId(days: number | null): string | null {
  if (days == null || !Number.isFinite(days)) return null;
  const normalizedDays = Math.max(1, Math.ceil(days));
  if (normalizedDays <= 90) {
    return String(normalizedDays);
  }
  const extended = [100, 110, 120, 130, 140, 150, 160, 170, 180];
  for (const candidate of extended) {
    if (normalizedDays <= candidate) {
      return String(candidate);
    }
  }
  return String(extended[extended.length - 1]);
}

function buildSizeFreeInput(
  sizeNotes: string | null | undefined,
  weightGrams: string | null | undefined
): string | null {
  const parts: string[] = [];
  if (sizeNotes && sizeNotes.trim()) {
    parts.push(sizeNotes.trim());
  }
  const weightValue = parseInteger(weightGrams);
  if (weightValue !== null) {
    parts.push(`重量: ${weightValue}g`);
  }
  return parts.length ? parts.join("\n") : null;
}

function parseInteger(value: string | null | undefined): number | null {
  if (!value) return null;
  const sanitized = value.replace(/[^0-9.+-]/g, "");
  if (!sanitized.length) return null;
  const parsed = Number.parseFloat(sanitized);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function pickFirstNonEmpty(
  ...values: Array<string | null | undefined>
): string | null {
  for (const value of values) {
    if (value && value.trim()) {
      return value;
    }
  }
  return null;
}

function buildPrefectureAliasMap(
  entries: Array<{ id: string; labels: string[] }>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) {
    for (const label of entry.labels) {
      const normalized = normalizePrefectureToken(label);
      if (!normalized) continue;
      map.set(normalized, entry.id);
    }
  }
  return map;
}

function normalizePrefectureToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s　]/g, "")
    .replace(/[都道府県]/g, "");
}

function buildShippingMethodAliasMap(
  entries: Array<{ id: string; labels: string[] }>
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const entry of entries) {
    for (const label of entry.labels) {
      const normalized = normalizeShippingMethodToken(label);
      if (!normalized) continue;
      const existing = map.get(normalized) ?? [];
      if (!existing.includes(entry.id)) {
        existing.push(entry.id);
      }
      map.set(normalized, existing);
    }
  }
  return map;
}

function normalizeShippingMethodToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s　]/g, "")
    .replace(/[（）()]/g, "");
}

function resolveMaterialId(
  productId: string,
  explicitId: string | null,
  candidateStrings: Array<string | null | undefined>
): string | null {
  if (explicitId) {
    if (isValidMaterialId(explicitId)) {
      return explicitId;
    }
    console.warn(
      "[creema-draft] 無効な素材IDを検出",
      productId,
      explicitId
    );
  }

  const tokens = new Set<string>();
  for (const candidate of candidateStrings) {
    if (!candidate) continue;
    tokens.add(candidate);
    for (const token of splitMaterialTokens(candidate)) {
      tokens.add(token);
    }
  }

  for (const token of tokens) {
    const normalized = normalizeMaterialToken(token);
    if (!normalized) continue;
    const options = MATERIAL_ALIAS_MAP.get(normalized);
    if (!options || options.length === 0) continue;
    if (options.length > 1) {
      console.warn(
        "[creema-draft] 素材候補が複数マッチしました",
        productId,
        token,
        options.map((option) => option.label)
      );
      continue;
    }
    return options[0].id;
  }

  if ([...tokens].length) {
    console.warn("[creema-draft] 素材候補に一致がありません", productId, [...tokens]);
  }

  return null;
}

function splitMaterialTokens(value: string): string[] {
  return value
    .split(/[\s,、，,/／・\-|＋+&＆（）()\[\]{}【】「」『』]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

type MaterialAliasEntry = { id: string; label: string };

function buildMaterialAliasMap(
  options: {
    id: string;
    label: string;
    aliases: string[];
  }[]
): Map<string, MaterialAliasEntry[]> {
  const map = new Map<string, MaterialAliasEntry[]>();
  for (const option of options) {
    const entry: MaterialAliasEntry = { id: option.id, label: option.label };
    const candidates = new Set<string>();
    candidates.add(option.label);
    candidates.add(option.label.replace(/[\s　]+/g, ""));
    for (const alias of option.aliases) {
      candidates.add(alias);
      candidates.add(alias.replace(/[\s　]+/g, ""));
    }

    for (const candidate of candidates) {
      const normalized = normalizeMaterialToken(candidate);
      if (!normalized) continue;
      const list = map.get(normalized);
      if (!list) {
        map.set(normalized, [entry]);
      } else if (!list.some((existing) => existing.id === entry.id)) {
        list.push(entry);
      }
    }
  }
  return map;
}

function normalizeMaterialToken(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s　]/g, "")
    .replace(/[・、，,/／\-（）()\[\]{}【】「」『』"'`]+/g, "");
}

function isValidMaterialId(value: string): boolean {
  return CREEMA_MATERIAL_OPTIONS.some((option) => option.id === value);
}

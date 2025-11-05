import { expect, test } from "@playwright/test";
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
  categoryLevel1Select: "#form-item-level1-category-id",
  categoryLevel2Select: "#form-item-level2-category-id",
  colorCheckboxes: "input.js-item-skus-color-ids",
  categoryLevel1Select: "#form-item-level1-category-id",
  categoryLevel2Select: "#form-item-level2-category-id",
  tagHiddenInput: "#form-item-tags",
  nextStepButton: "input.js-item-next",
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

      if (mapped.materialId) {
        console.log("[creema-draft] material resolved", mapped.materialId);
        await page
          .selectOption(selectors.materialSelect, mapped.materialId)
          .catch(() => {
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
        }
      }

      if (mapped.colorIds.length) {
        for (const colorId of mapped.colorIds) {
          const checkbox = page.locator(`${selectors.colorCheckboxes}[value="${colorId}"]`);
          await expect(checkbox).toBeVisible();
          await checkbox.check({ force: true });
        }
      }

      if (mapped.tags.length) {
        await page.evaluate(
          ({ selector, tags }) => {
            const input = document.querySelector<HTMLInputElement>(selector);
            if (!input) {
              console.warn("[creema-draft] タグ入力 hidden が見つかりません", selector);
              return;
            }
            const serialized = tags.join(",");
            input.value = serialized;
            const eventInit = { bubbles: true, cancelable: true };
            input.dispatchEvent(new Event("input", eventInit));
            input.dispatchEvent(new Event("change", eventInit));
          },
          { selector: selectors.tagHiddenInput, tags: mapped.tags }
        );
      }

      // TODO: 画像アップロードなど、Creema 固有の必須項目を追記
    });

    await test.step("下書き保存直前で停止", async () => {
      await expect(page.locator(selectors.nextStepButton)).toBeVisible();
      testInfo.annotations.push({
        type: "NEXT",
        description:
          "次のステップに進む場合は `page.click(selectors.nextStepButton)` を実行してください。",
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
  materialId: string | null;
  categoryLevel1Id: string | null;
  categoryLevel2Id: string | null;
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
    categoryLevel1Id,
    categoryLevel2Id,
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

export type FieldType = "text" | "textarea" | "number";

export type FieldSection = "basic" | "creema" | "minne" | "base" | "iichi";

export type FieldConfig = {
  key: string; // rawカラム名（スプシのヘッダーと完全一致）
  label: string; // 表示名
  type: FieldType;
  section: FieldSection;
  placeholder?: string;
};

export const SECTION_LABELS: Record<FieldSection, string> = {
  basic: "基本情報",
  creema: "Creema設定",
  minne: "minne設定",
  base: "BASE設定",
  iichi: "iichi設定",
};

// 共通シートのカラム順に合わせた定義
export const FIELD_CONFIGS: FieldConfig[] = [
  // === 基本情報 ===
  { key: "product_id", label: "商品ID", type: "text", section: "basic" },
  { key: "sku", label: "SKU", type: "text", section: "basic" },
  { key: "title", label: "商品名", type: "text", section: "basic" },
  { key: "description", label: "商品説明", type: "textarea", section: "basic" },
  { key: "price", label: "価格", type: "number", section: "basic", placeholder: "例: 3500" },
  { key: "inventory", label: "在庫", type: "number", section: "basic", placeholder: "例: 5" },
  { key: "material", label: "素材", type: "text", section: "basic" },
  { key: "size_notes", label: "サイズ備考", type: "textarea", section: "basic" },
  { key: "weight_grams", label: "重量(g)", type: "number", section: "basic" },
  { key: "tags", label: "タグ", type: "text", section: "basic", placeholder: "カンマ区切り" },
  { key: "image_urls", label: "画像URL", type: "textarea", section: "basic", placeholder: "カンマ区切りまたは1行に1URL" },
  { key: "production_lead_time_days", label: "制作日数", type: "number", section: "basic", placeholder: "例: 7" },
  { key: "shipping_fee", label: "送料", type: "number", section: "basic", placeholder: "例: 300" },
  { key: "shipping_method", label: "配送方法", type: "text", section: "basic" },
  { key: "shipping_origin_pref", label: "発送元都道府県", type: "text", section: "basic" },
  { key: "出品先", label: "出品先", type: "text", section: "basic", placeholder: "Creema,minne,BASE,iichi" },
  { key: "notes_internal", label: "内部メモ", type: "textarea", section: "basic" },

  // === Creema ===
  { key: "creema_category_level1_label", label: "カテゴリ(大)", type: "text", section: "creema" },
  { key: "creema_category_level2_label", label: "カテゴリ(中)", type: "text", section: "creema" },
  { key: "creema_category_level3_label", label: "カテゴリ(小)", type: "text", section: "creema" },
  { key: "creema_color_ids", label: "カラーID", type: "text", section: "creema" },

  // === minne ===
  { key: "minne_category_parent_label", label: "カテゴリ(親)", type: "text", section: "minne" },
  { key: "minne_category_label", label: "カテゴリ", type: "text", section: "minne" },
  { key: "minne_shipping_additional_fee", label: "追加送料", type: "number", section: "minne" },

  // === iichi ===
  { key: "iichi_category_parent_label", label: "カテゴリ(親)", type: "text", section: "iichi" },
  { key: "iichi_category_child_label", label: "カテゴリ(子)", type: "text", section: "iichi" },
];

/**
 * rawデータ内のキーのうち、FIELD_CONFIGSに定義されていないキーを
 * 「その他」フィールドとして返す。ステータス系・エラー系は除外。
 */
export function getExtraFields(raw: Record<string, string>): FieldConfig[] {
  const knownKeys = new Set(FIELD_CONFIGS.map((f) => f.key));

  const excludePatterns = [
    /status/i,
    /synced/i,
    /error/i,
    /started/i,
    /duration/i,
    /attempt/i,
    /retry/i,
    /ステータス/,
    /最終同期/,
    /エラー/,
  ];

  return Object.keys(raw)
    .filter((key) => {
      if (knownKeys.has(key)) return false;
      if (!key.trim()) return false;
      return !excludePatterns.some((p) => p.test(key));
    })
    .map((key) => ({
      key,
      label: key,
      type: "text" as const,
      section: inferSection(key),
    }));
}

function inferSection(key: string): FieldSection {
  const lower = key.toLowerCase();
  if (lower.startsWith("creema")) return "creema";
  if (lower.startsWith("minne")) return "minne";
  if (lower.startsWith("base")) return "base";
  if (lower.startsWith("iichi")) return "iichi";
  return "basic";
}

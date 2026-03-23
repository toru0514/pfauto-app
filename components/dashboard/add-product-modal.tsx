"use client";

import { useState } from "react";

const AVAILABLE_PLATFORMS = [
  { value: "creema", label: "Creema" },
  { value: "minne", label: "minne" },
  { value: "base", label: "BASE" },
  { value: "iichi", label: "iichi" },
];

export type AddProductFormData = {
  productId: string;
  title: string;
  description: string;
  price: number | null;
  inventory: number | null;
  platforms: string[];
};

type Props = {
  pending: boolean;
  onSubmit: (data: AddProductFormData) => void;
  onClose: () => void;
};

export function AddProductModal({ pending, onSubmit, onClose }: Props) {
  const [productId] = useState(() => `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceText, setPriceText] = useState("");
  const [inventoryText, setInventoryText] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  const togglePlatform = (value: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(value)
        ? prev.filter((p) => p !== value)
        : [...prev, value]
    );
  };

  const priceError =
    priceText.trim() && !Number.isFinite(Number(priceText.replace(/,/g, "")))
      ? "数値を入力してください"
      : null;

  const inventoryError =
    inventoryText.trim() && !Number.isFinite(Number(inventoryText))
      ? "数値を入力してください"
      : null;

  const canSubmit =
    !pending &&
    title.trim().length > 0 &&
    selectedPlatforms.length > 0 &&
    !priceError &&
    !inventoryError;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const price = priceText.trim() ? Number(priceText.replace(/,/g, "")) : null;
    const inventory = inventoryText.trim() ? Number(inventoryText) : null;

    onSubmit({
      productId: productId.trim(),
      title: title.trim(),
      description: description.trim(),
      price: price !== null && Number.isFinite(price) ? price : null,
      inventory: inventory !== null && Number.isFinite(inventory) ? inventory : null,
      platforms: selectedPlatforms,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-3">
          <h2 className="text-lg font-semibold text-foreground">商品を追加</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground transition hover:bg-muted disabled:opacity-60"
          >
            閉じる
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 py-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              商品名 <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: シルバーリング"
              disabled={pending}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              商品説明
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="商品の説明を入力"
              disabled={pending}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 disabled:opacity-60 resize-y"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                価格
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                placeholder="例: 3500"
                disabled={pending}
                className={`w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 disabled:opacity-60 ${priceError ? "border-destructive" : "border-border"}`}
              />
              {priceError && (
                <p className="mt-1 text-xs text-destructive">{priceError}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                在庫
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={inventoryText}
                onChange={(e) => setInventoryText(e.target.value)}
                placeholder="例: 5"
                disabled={pending}
                className={`w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 disabled:opacity-60 ${inventoryError ? "border-destructive" : "border-border"}`}
              />
              {inventoryError && (
                <p className="mt-1 text-xs text-destructive">{inventoryError}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              出品先 <span className="text-destructive">*</span>
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              {AVAILABLE_PLATFORMS.map((platform) => {
                const selected = selectedPlatforms.includes(platform.value);
                return (
                  <button
                    key={platform.value}
                    type="button"
                    onClick={() => togglePlatform(platform.value)}
                    disabled={pending}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {platform.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-60"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "追加中..." : "追加する"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

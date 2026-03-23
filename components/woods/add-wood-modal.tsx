"use client";

import { useState } from "react";

export type AddWoodFormData = {
  name: string;
  imageUrl: string;
  features: string;
};

type Props = {
  pending: boolean;
  onSubmit: (data: AddWoodFormData) => void;
  onClose: () => void;
};

export function AddWoodModal({ pending, onSubmit, onClose }: Props) {
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [features, setFeatures] = useState("");

  const canSubmit = !pending && name.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      imageUrl: imageUrl.trim(),
      features: features.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-3">
          <h2 className="text-lg font-semibold text-foreground">木材を追加</h2>
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
              木材名 <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: ウォールナット"
              disabled={pending}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              画像URL
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              disabled={pending}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 disabled:opacity-60"
            />
            {imageUrl.trim() && (
              <div className="mt-2 overflow-hidden rounded-md border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="プレビュー"
                  className="h-32 w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              特徴
            </label>
            <textarea
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              placeholder="例: 濃い茶色で重厚感がある。硬くて耐久性に優れる。"
              disabled={pending}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 disabled:opacity-60 resize-y"
            />
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

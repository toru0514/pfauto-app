"use client";

import { useState, useTransition } from "react";
import { copyProduct } from "@/app/dashboard/actions";

type Props = {
  sourceProductId: string;
  onClose: () => void;
  onCopied: (newProductId: string) => void;
};

export function CopyProductDialog({ sourceProductId, onClose, onCopied }: Props) {
  const [newProductId, setNewProductId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const generateId = () => {
    setNewProductId(`prod-${Date.now()}`);
  };

  const canSubmit = !pending && newProductId.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);
    startTransition(async () => {
      try {
        await copyProduct(sourceProductId, newProductId.trim());
        onCopied(newProductId.trim());
      } catch (err) {
        setError(err instanceof Error ? err.message : "コピーに失敗しました");
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-3">
          <h2 className="text-lg font-semibold text-foreground">商品をコピー</h2>
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
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{sourceProductId}</span>{" "}
            のすべてのフィールドをコピーして新しい商品を作成します。
          </p>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              新しい商品ID <span className="text-destructive">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newProductId}
                onChange={(e) => setNewProductId(e.target.value)}
                placeholder="例: ring-002"
                disabled={pending}
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={generateId}
                disabled={pending}
                className="shrink-0 rounded-md border border-border bg-muted px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted/80 disabled:opacity-60"
              >
                自動生成
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

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
              {pending ? "コピー中..." : "コピーする"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

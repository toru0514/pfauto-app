"use client";

import { useState, useTransition } from "react";
import { copyProduct } from "@/app/dashboard/actions";

type Props = {
  sourceProductId: string;
  sourceProductTitle: string;
  onClose: () => void;
  onCopied: (newProductId: string) => void;
};

export function CopyProductDialog({ sourceProductId, sourceProductTitle, onClose, onCopied }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleCopy = () => {
    setError(null);
    startTransition(async () => {
      try {
        const newId = await copyProduct(sourceProductId);
        onCopied(newId);
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
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card shadow-2xl">
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

        <div className="space-y-4 px-4 py-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{sourceProductTitle}</span>{" "}
            をコピーしますか？
          </p>

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
              type="button"
              onClick={handleCopy}
              disabled={pending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "コピー中..." : "コピーする"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

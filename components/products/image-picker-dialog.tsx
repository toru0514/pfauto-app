"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Check } from "lucide-react";
import { fetchMicroCmsImages, type MicroCmsImage } from "@/app/dashboard/actions";

type Props = {
  currentUrls: string[];
  onConfirm: (urls: string[]) => void;
  onClose: () => void;
};

const PAGE_SIZE = 20;

export function ImagePickerDialog({ currentUrls, onConfirm, onClose }: Props) {
  const [images, setImages] = useState<MicroCmsImage[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(
    () => new Set(currentUrls.filter(Boolean))
  );

  const loadImages = useCallback(async (pageOffset: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMicroCmsImages(pageOffset, PAGE_SIZE);
      setImages(result.images);
      setTotalCount(result.totalCount);
      setOffset(pageOffset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "画像の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImages(0);
  }, [loadImages]);

  const toggleImage = (url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm([...selectedUrls]);
  };

  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < totalCount;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              microCMS 画像を選択
            </h2>
            <p className="text-xs text-muted-foreground">
              {selectedUrls.size} 件選択中 / 全 {totalCount} 件
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : (
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
              {images.map((img) => {
                const isSelected = selectedUrls.has(img.url);
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => toggleImage(img.url)}
                    className={`group relative aspect-square overflow-hidden rounded-md border-2 transition ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <img
                      src={`${img.url}?w=200&h=200&fit=crop`}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                        <Check className="h-6 w-6 text-primary" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination + Confirm */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadImages(offset - PAGE_SIZE)}
              disabled={!hasPrev || loading}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-40"
            >
              前へ
            </button>
            <span className="text-xs text-muted-foreground">
              {offset + 1}-{Math.min(offset + PAGE_SIZE, totalCount)} / {totalCount}
            </span>
            <button
              type="button"
              onClick={() => loadImages(offset + PAGE_SIZE)}
              disabled={!hasNext || loading}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-40"
            >
              次へ
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              選択を確定 ({selectedUrls.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

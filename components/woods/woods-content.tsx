"use client";

import { useCallback, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { AddWoodModal, type AddWoodFormData } from "./add-wood-modal";
import { useToast } from "@/components/providers/toast-provider";

type WoodMaterial = {
  id: string;
  name: string;
  imageUrl: string;
  features: string;
  createdAt: number;
};

const STORAGE_KEY = "pfauto-wood-materials";

function loadWoods(): WoodMaterial[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WoodMaterial[]) : [];
  } catch {
    return [];
  }
}

function saveWoods(woods: WoodMaterial[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(woods));
}

export function WoodsContent() {
  const [woods, setWoods] = useState<WoodMaterial[]>(() => loadWoods());
  const [showAddModal, setShowAddModal] = useState(false);
  const [pendingAdd, startAdd] = useTransition();
  const { showToast } = useToast();

  const handleAdd = useCallback(
    (data: AddWoodFormData) => {
      startAdd(() => {
        const newWood: WoodMaterial = {
          id: `wood-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: data.name,
          imageUrl: data.imageUrl,
          features: data.features,
          createdAt: Date.now(),
        };
        const updated = [newWood, ...woods];
        saveWoods(updated);
        setWoods(updated);
        setShowAddModal(false);
        showToast({
          title: "木材を追加しました",
          description: data.name,
          variant: "success",
        });
      });
    },
    [woods, showToast]
  );

  const handleDelete = useCallback(
    (id: string) => {
      const target = woods.find((w) => w.id === id);
      const updated = woods.filter((w) => w.id !== id);
      saveWoods(updated);
      setWoods(updated);
      showToast({
        title: "木材を削除しました",
        description: target?.name ?? "",
        variant: "info",
      });
    },
    [woods, showToast]
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">木材一覧</h1>
          <p className="text-sm text-muted-foreground">
            木材の画像・名前・特徴を管理できます。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          木材を追加
        </button>
      </header>

      {woods.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            木材がまだ登録されていません。「木材を追加」ボタンから追加してください。
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {woods.map((wood) => (
            <div
              key={wood.id}
              className="group overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:shadow-md"
            >
              {wood.imageUrl ? (
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={wood.imageUrl}
                    alt={wood.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-muted">
                  <span className="text-xs text-muted-foreground">画像なし</span>
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold text-foreground">
                    {wood.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleDelete(wood.id)}
                    className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-destructive group-hover:opacity-100"
                    title="削除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {wood.features && (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {wood.features}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddWoodModal
          pending={pendingAdd}
          onSubmit={handleAdd}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

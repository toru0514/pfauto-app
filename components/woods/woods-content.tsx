"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Trash2, Pencil } from "lucide-react";
import { AddWoodModal, type AddWoodFormData } from "./add-wood-modal";
import {
  addWoodAction,
  updateWoodAction,
  deleteWoodAction,
} from "@/app/dashboard/woods/actions";
import type { WoodMaterial } from "@/adapters/google-sheets/wood-repository";
import { useToast } from "@/components/providers/toast-provider";

type Props = {
  woods: WoodMaterial[];
};

export function WoodsContent({ woods }: Props) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWood, setEditingWood] = useState<WoodMaterial | null>(null);
  const [pendingAdd, startAdd] = useTransition();
  const [pendingEdit, startEdit] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startDelete] = useTransition();
  const { showToast } = useToast();

  const handleAdd = (data: AddWoodFormData) => {
    startAdd(async () => {
      try {
        await addWoodAction({
          name: data.name,
          imageUrl: data.imageUrl,
          features: data.features,
        });
        setShowAddModal(false);
        showToast({
          title: "木材を追加しました",
          description: data.name,
          variant: "success",
        });
      } catch (error) {
        showToast({
          title: "木材の追加に失敗しました",
          description: error instanceof Error ? error.message : "不明なエラー",
          variant: "error",
        });
      }
    });
  };

  const handleEdit = (data: AddWoodFormData) => {
    if (!editingWood) return;
    startEdit(async () => {
      try {
        await updateWoodAction({
          id: editingWood.id,
          name: data.name,
          imageUrl: data.imageUrl,
          features: data.features,
        });
        setEditingWood(null);
        showToast({
          title: "木材を更新しました",
          description: data.name,
          variant: "success",
        });
      } catch (error) {
        showToast({
          title: "木材の更新に失敗しました",
          description: error instanceof Error ? error.message : "不明なエラー",
          variant: "error",
        });
      }
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`「${name}」を削除しますか？`)) return;

    setDeletingId(id);
    startDelete(async () => {
      try {
        await deleteWoodAction(id);
        showToast({
          title: "木材を削除しました",
          description: name,
          variant: "info",
        });
      } catch (error) {
        showToast({
          title: "木材の削除に失敗しました",
          description: error instanceof Error ? error.message : "不明なエラー",
          variant: "error",
        });
      } finally {
        setDeletingId(null);
      }
    });
  };

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
              <Link href={`/dashboard/woods/${encodeURIComponent(wood.id)}`}>
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
              </Link>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/dashboard/woods/${encodeURIComponent(wood.id)}`}
                    className="text-base font-semibold text-foreground hover:underline"
                  >
                    {wood.name}
                  </Link>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingWood(wood)}
                      className="rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
                      title="編集"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(wood.id, wood.name)}
                      disabled={deletingId === wood.id}
                      className="rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-destructive group-hover:opacity-100 disabled:opacity-60"
                      title="削除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {wood.features && (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap line-clamp-3">
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

      {editingWood && (
        <AddWoodModal
          pending={pendingEdit}
          onSubmit={handleEdit}
          onClose={() => setEditingWood(null)}
          initialData={{
            name: editingWood.name,
            imageUrl: editingWood.imageUrl,
            features: editingWood.features,
          }}
        />
      )}
    </div>
  );
}

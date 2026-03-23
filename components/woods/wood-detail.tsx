"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { AddWoodModal, type AddWoodFormData } from "./add-wood-modal";
import { updateWoodAction, deleteWoodAction } from "@/app/dashboard/woods/actions";
import type { WoodMaterial } from "@/adapters/google-sheets/wood-repository";
import { useToast } from "@/components/providers/toast-provider";

type Props = {
  wood: WoodMaterial;
};

export function WoodDetail({ wood }: Props) {
  const router = useRouter();
  const [showEditModal, setShowEditModal] = useState(false);
  const [pendingEdit, startEdit] = useTransition();
  const [deleting, setDeleting] = useState(false);
  const [, startDelete] = useTransition();
  const { showToast } = useToast();

  const handleEdit = (data: AddWoodFormData) => {
    startEdit(async () => {
      try {
        await updateWoodAction({
          id: wood.id,
          name: data.name,
          imageUrl: data.imageUrl,
          features: data.features,
        });
        setShowEditModal(false);
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

  const handleDelete = () => {
    if (!window.confirm(`「${wood.name}」を削除しますか？`)) return;

    setDeleting(true);
    startDelete(async () => {
      try {
        await deleteWoodAction(wood.id);
        showToast({
          title: "木材を削除しました",
          description: wood.name,
          variant: "info",
        });
        router.push("/dashboard/woods");
      } catch (error) {
        showToast({
          title: "木材の削除に失敗しました",
          description: error instanceof Error ? error.message : "不明なエラー",
          variant: "error",
        });
        setDeleting(false);
      }
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard/woods")}
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted"
            title="一覧に戻る"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-semibold text-foreground">{wood.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted"
          >
            <Pencil className="h-4 w-4" />
            編集
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            削除
          </button>
        </div>
      </header>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        {wood.imageUrl ? (
          <div className="aspect-video overflow-hidden bg-muted">
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
          <div className="flex aspect-video items-center justify-center bg-muted">
            <span className="text-sm text-muted-foreground">画像なし</span>
          </div>
        )}

        <div className="p-6">
          <h2 className="text-lg font-semibold text-foreground">{wood.name}</h2>
          {wood.features && (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {wood.features}
            </p>
          )}
          <p className="mt-4 text-xs text-muted-foreground/60">
            登録日: {new Date(wood.createdAt).toLocaleDateString("ja-JP")}
          </p>
        </div>
      </div>

      {showEditModal && (
        <AddWoodModal
          pending={pendingEdit}
          onSubmit={handleEdit}
          onClose={() => setShowEditModal(false)}
          initialData={{
            name: wood.name,
            imageUrl: wood.imageUrl,
            features: wood.features,
          }}
        />
      )}
    </div>
  );
}

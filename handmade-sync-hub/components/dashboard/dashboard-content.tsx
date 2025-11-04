"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
  enqueueDraft,
  refreshProductsFromSheets,
  ProductRow,
  JobRow,
} from "@/app/dashboard/actions";
import { useToast } from "@/components/providers/toast-provider";

type Props = {
  products: ProductRow[];
  jobs: JobRow[];
};

type DetailProduct = ProductRow & {
  jobHistory: JobRow[];
};

type OperationLogEntry = {
  id: string;
  type: "sync" | "enqueue";
  status: "success" | "error";
  message: string;
  detail?: string;
  createdAt: number;
};

export function DashboardContent({ products, jobs }: Props) {
  const [pendingRefresh, startRefresh] = useTransition();
  const [pendingEnqueue, startEnqueue] = useTransition();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [operationLogs, setOperationLogs] = useState<OperationLogEntry[]>([]);
  const { showToast } = useToast();

  const appendLog = useCallback(
    (entry: Omit<OperationLogEntry, "id" | "createdAt"> & { detail?: string }) => {
      setOperationLogs((prev) => {
        const next: OperationLogEntry[] = [
          {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            createdAt: Date.now(),
            ...entry,
          },
          ...prev,
        ];
        return next.slice(0, 20);
      });
    },
    []
  );

  const handleRefresh = () => {
    startRefresh(async () => {
      try {
        await refreshProductsFromSheets();
        showToast({
          title: "同期が完了しました",
          description: "スプレッドシートの内容を読み込みました。",
          variant: "success",
        });
        appendLog({
          type: "sync",
          status: "success",
          message: "最新データを同期しました。",
        });
      } catch (error) {
        const message = extractErrorMessage(error);
        showToast({
          title: "同期に失敗しました",
          description: message,
          variant: "error",
        });
        appendLog({
          type: "sync",
          status: "error",
          message: "同期に失敗しました。",
          detail: message,
        });
      }
    });
  };

  const selectedProduct: DetailProduct | null = useMemo(() => {
    if (!selectedProductId) return null;
    const product = products.find((item) => item.id === selectedProductId);
    if (!product) return null;
    const jobHistory = jobs.filter((job) => job.productId === product.id);
    return {
      ...product,
      jobHistory,
    };
  }, [jobs, products, selectedProductId]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">ダッシュボード</h1>
          <p className="text-sm text-muted-foreground">
            スプレッドシートの同期状態と自動化ジョブの状況を確認できます。
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={pendingRefresh}
          className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendingRefresh ? "同期中..." : "最新データを同期"}
        </button>
      </header>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-muted/50 px-4 py-2 text-sm font-semibold text-muted-foreground">
          商品一覧
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">商品名</th>
                <th className="px-4 py-3 text-left font-medium">出品先</th>
                <th className="px-4 py-3 text-left font-medium">ステータス</th>
                <th className="px-4 py-3 text-left font-medium">最終同期</th>
                <th className="px-4 py-3 text-left font-medium">エラー</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((product) => (
                <tr key={product.id} className="bg-card">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{product.title}</div>
                    <div className="text-xs text-muted-foreground">ID: {product.id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <PlatformBadges values={product.platforms} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={product.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {product.lastSyncedAt ? formatDate(product.lastSyncedAt) : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-destructive">
                    {product.lastError ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted"
                        onClick={() => setSelectedProductId(product.id)}
                      >
                        詳細
                      </button>
                      <button
                        type="button"
                        disabled={pendingEnqueue}
                        onClick={() =>
                          startEnqueue(async () => {
                            try {
                              await enqueueDraft(product.id, product.platforms);
                              showToast({
                                title: "送信キューに登録しました",
                                description: `${product.title} (${renderPlatformsForToast(product.platforms)})`,
                                variant: "success",
                              });
                              appendLog({
                                type: "enqueue",
                                status: "success",
                                message: `${product.title} を送信キューに登録しました。`,
                              });
                            } catch (error) {
                              const message = extractErrorMessage(error);
                              showToast({
                                title: "送信キュー登録に失敗しました",
                                description: message,
                                variant: "error",
                              });
                              appendLog({
                                type: "enqueue",
                                status: "error",
                                message: `${product.title} の送信キュー登録に失敗しました。`,
                                detail: message,
                              });
                            }
                          })
                        }
                        className="rounded-md bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {pendingEnqueue ? "送信中..." : "送信"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-muted/50 px-4 py-2 text-sm font-semibold text-muted-foreground">
          ジョブステータス
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">ジョブID</th>
                <th className="px-4 py-3 text-left font-medium">商品</th>
                <th className="px-4 py-3 text-left font-medium">プラットフォーム</th>
                <th className="px-4 py-3 text-left font-medium">ステータス</th>
                <th className="px-4 py-3 text-left font-medium">試行</th>
                <th className="px-4 py-3 text-left font-medium">開始時刻</th>
                <th className="px-4 py-3 text-left font-medium">所要時間</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {jobs.map((job) => (
                <tr key={job.id} className="bg-card">
                  <td className="px-4 py-3 font-medium text-foreground">{job.id}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{job.productId}</td>
                  <td className="px-4 py-3"><PlatformBadges values={[job.platform]} /></td>
                  <td className="px-4 py-3"><JobStatusBadge status={job.status} /></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{job.attempt ?? "-"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(job.startedAt)}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {job.durationSeconds ? `${job.durationSeconds}s` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedProduct ? (
        <DetailSheet
          product={selectedProduct}
          onClose={() => setSelectedProductId(null)}
        />
      ) : null}

      <OperationLogSection logs={operationLogs} />
    </div>
  );
}

function PlatformBadges({ values }: { values: string[] }) {
  if (!values.length) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {values.map((value) => (
        <span
          key={value}
          className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
        >
          {renderPlatformLabel(value)}
        </span>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: ProductRow["status"] }) {
  const palette: Record<ProductRow["status"], string> = {
    new: "bg-slate-200 text-slate-700",
    ready: "bg-blue-100 text-blue-700",
    queued: "bg-amber-100 text-amber-700",
    processing: "bg-indigo-100 text-indigo-700",
    drafted: "bg-emerald-100 text-emerald-700",
    error: "bg-rose-100 text-rose-700",
    skipped: "bg-zinc-200 text-zinc-700",
  };
  const labelMap: Record<ProductRow["status"], string> = {
    new: "新規",
    ready: "下書き準備済み",
    queued: "待機中",
    processing: "処理中",
    drafted: "下書き作成済み",
    error: "エラー",
    skipped: "対象外",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${palette[status]}`}>
      {labelMap[status] ?? status}
    </span>
  );
}

function JobStatusBadge({ status }: { status: JobRow["status"] }) {
  const palette: Record<JobRow["status"], string> = {
    queued: "bg-amber-100 text-amber-700",
    processing: "bg-indigo-100 text-indigo-700",
    success: "bg-emerald-100 text-emerald-700",
    error: "bg-rose-100 text-rose-700",
    skipped: "bg-zinc-200 text-zinc-700",
  };
  const labelMap: Record<JobRow["status"], string> = {
    queued: "待機中",
    processing: "処理中",
    success: "完了",
    error: "エラー",
    skipped: "対象外",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${palette[status]}`}>
      {labelMap[status] ?? status}
    </span>
  );
}

function formatDate(value: string | null | undefined) {
  try {
    if (!value) return "-";
    return new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value ?? "-";
  }
}

function DetailSheet({ product, onClose }: { product: DetailProduct; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{product.title}</h2>
            <p className="text-sm text-muted-foreground">ID: {product.id}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground transition hover:bg-muted"
          >
            閉じる
          </button>
        </div>

        <div className="space-y-4 px-4 py-4 text-sm">
          <div>
            <h3 className="font-semibold text-foreground">基本情報</h3>
            <dl className="grid grid-cols-2 gap-2 pt-2">
              <div>
                <dt className="text-xs text-muted-foreground">価格</dt>
                <dd className="font-medium text-foreground">
                  {product.price !== null ? `¥${product.price.toLocaleString()}` : "-"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">在庫</dt>
                <dd className="font-medium text-foreground">
                  {product.inventory ?? "-"}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">タグ</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {product.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">説明</dt>
                <dd className="mt-1 whitespace-pre-wrap text-foreground">{product.description}</dd>
              </div>
            </dl>
          </div>

          <div>
            <h3 className="font-semibold text-foreground">ジョブ履歴</h3>
            <div className="mt-2 space-y-2">
              {product.jobHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground">ジョブ履歴はありません。</p>
              ) : (
                product.jobHistory.map((job) => (
                  <div key={job.id} className="rounded-md border border-border bg-background px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-foreground">{renderPlatformLabel(job.platform)}</div>
                      <JobStatusBadge status={job.status} />
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-x-3 text-muted-foreground">
                      <span>ジョブID: {job.id}</span>
                      <span>試行回数: {job.attempt ?? "-"}</span>
                      <span>開始: {formatDate(job.startedAt)}</span>
                      <span>所要: {job.durationSeconds ? `${job.durationSeconds}s` : "-"}</span>
                    </div>
                    {job.lastError ? (
                      <p className="mt-1 text-[11px] text-destructive">{job.lastError}</p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderPlatformLabel(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === "creema") return "Creema";
  if (normalized === "minne") return "minne";
  if (normalized === "base") return "BASE";
  return value;
}

function renderPlatformsForToast(platforms: string[]) {
  if (!platforms.length) return "プラットフォーム未指定";
  return platforms.map(renderPlatformLabel).join(", ");
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "不明なエラーが発生しました";
  }
}

function OperationLogSection({ logs }: { logs: OperationLogEntry[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-muted/50 px-4 py-2 text-sm font-semibold text-muted-foreground">
        操作ログ
      </div>
      {logs.length === 0 ? (
        <p className="px-4 py-4 text-xs text-muted-foreground">
          まだ操作履歴はありません。同期・送信を行うと最新20件がここに表示されます。
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">時刻</th>
                <th className="px-4 py-3 text-left font-medium">操作</th>
                <th className="px-4 py-3 text-left font-medium">結果</th>
                <th className="px-4 py-3 text-left font-medium">詳細</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log) => (
                <tr key={log.id} className="bg-card">
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(new Date(log.createdAt).toISOString())}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{renderOperationLabel(log.type)}</td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        log.status === "success"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {log.status === "success" ? "成功" : "失敗"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    <p>{log.message}</p>
                    {log.detail ? (
                      <p className="text-xs text-foreground/60">{log.detail}</p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function renderOperationLabel(type: OperationLogEntry["type"]) {
  if (type === "sync") return "シート同期";
  if (type === "enqueue") return "送信キュー登録";
  return type;
}

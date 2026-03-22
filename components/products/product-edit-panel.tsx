"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { X, ChevronDown, ChevronRight } from "lucide-react";
import { getProductDetail, updateProduct } from "@/app/dashboard/actions";
import {
  FIELD_CONFIGS,
  SECTION_LABELS,
  getExtraFields,
  type FieldConfig,
  type FieldSection,
} from "./field-config";

type Props = {
  productId: string;
  onClose: () => void;
  onSaved: () => void;
};

export function ProductEditPanel({ productId, onClose, onSaved }: Props) {
  const [raw, setRaw] = useState<Record<string, string> | null>(null);
  const [initialRaw, setInitialRaw] = useState<Record<string, string> | null>(null);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingSave, startSave] = useTransition();
  const [collapsedSections, setCollapsedSections] = useState<Set<FieldSection>>(
    new Set()
  );
  const panelRef = useRef<HTMLDivElement>(null);

  const loadProduct = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detail = await getProductDetail(productId);
      setRaw({ ...detail.raw });
      setInitialRaw({ ...detail.raw });
      setPlatforms(detail.platforms);
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const toggleSection = (section: FieldSection) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleFieldChange = (key: string, value: string) => {
    setRaw((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = () => {
    if (!raw || !initialRaw) return;

    // Diff: only send changed fields
    const changedFields: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (value !== (initialRaw[key] ?? "")) {
        changedFields[key] = value;
      }
    }

    if (Object.keys(changedFields).length === 0) {
      onClose();
      return;
    }

    startSave(async () => {
      try {
        await updateProduct({ productId, fields: changedFields });
        // Reload to get fresh data (handles concurrent edits)
        await loadProduct();
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存に失敗しました");
      }
    });
  };

  const shouldShowSection = (section: FieldSection): boolean => {
    if (section === "basic") return true;
    if (section === "base") return platforms.includes("base");
    return platforms.includes(section);
  };

  // Determine which fields to show
  const allFields = raw
    ? [...FIELD_CONFIGS, ...getExtraFields(raw)]
    : FIELD_CONFIGS;

  const sections = (
    ["basic", "creema", "minne", "iichi", "base"] as FieldSection[]
  ).filter(shouldShowSection);

  const hasChanges =
    raw &&
    initialRaw &&
    Object.entries(raw).some(([ key, value]) => value !== (initialRaw[key] ?? ""));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[520px] flex-col border-l border-border bg-card shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-foreground">
              商品編集
            </h2>
            <p className="truncate text-sm text-muted-foreground">
              ID: {productId}
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading && (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          )}

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {!loading && raw && (
            <div className="space-y-4">
              {sections.map((section) => {
                const sectionFields = allFields.filter(
                  (f) => f.section === section
                );
                if (sectionFields.length === 0 && section !== "base")
                  return null;

                const isCollapsed = collapsedSections.has(section);

                return (
                  <div key={section}>
                    <button
                      type="button"
                      onClick={() => toggleSection(section)}
                      className="flex w-full items-center gap-1 py-1 text-sm font-semibold text-foreground"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      {SECTION_LABELS[section]}
                    </button>

                    {!isCollapsed && (
                      <div className="mt-2 space-y-3">
                        {section === "base" &&
                          sectionFields.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              BASEは基本情報のみで追加フィールドはありません。
                            </p>
                          )}
                        {sectionFields.map((field) => (
                          <FieldInput
                            key={field.key}
                            field={field}
                            value={raw[field.key] ?? ""}
                            onChange={(v) => handleFieldChange(field.key, v)}
                            disabled={pendingSave}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && raw && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              disabled={pendingSave}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-60"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={pendingSave || !hasChanges}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pendingSave ? "保存中..." : "保存"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldConfig;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const isReadOnly = field.key === "product_id";

  if (field.type === "textarea") {
    return (
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          {field.label}
        </label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          readOnly={isReadOnly}
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 disabled:opacity-60 read-only:bg-muted/50 resize-y"
        />
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">
        {field.label}
      </label>
      <input
        type={field.type === "number" ? "text" : "text"}
        inputMode={field.type === "number" ? "numeric" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        disabled={disabled}
        readOnly={isReadOnly}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 disabled:opacity-60 read-only:bg-muted/50"
      />
    </div>
  );
}

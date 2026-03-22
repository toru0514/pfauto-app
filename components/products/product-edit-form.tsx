"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, ArrowLeft, ImagePlus } from "lucide-react";
import { getProductDetail, updateProduct, getFieldOptions } from "@/app/dashboard/actions";
import { ImagePickerDialog } from "./image-picker-dialog";
import {
  FIELD_CONFIGS,
  SECTION_LABELS,
  SELECT_FIELD_KEYS,
  getExtraFields,
  type FieldConfig,
  type FieldSection,
} from "./field-config";

type Props = {
  productId: string;
};

export function ProductEditForm({ productId }: Props) {
  const router = useRouter();
  const [raw, setRaw] = useState<Record<string, string> | null>(null);
  const [initialRaw, setInitialRaw] = useState<Record<string, string> | null>(null);
  const [fieldOptions, setFieldOptions] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [pendingSave, startSave] = useTransition();
  const [collapsedSections, setCollapsedSections] = useState<Set<FieldSection>>(
    new Set()
  );
  const [showImagePicker, setShowImagePicker] = useState(false);

  const loadProduct = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, options] = await Promise.all([
        getProductDetail(productId),
        getFieldOptions(SELECT_FIELD_KEYS),
      ]);
      setRaw({ ...detail.raw });
      setInitialRaw({ ...detail.raw });
      setFieldOptions(options);
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

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
    setSaveSuccess(false);
    setRaw((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = () => {
    if (!raw || !initialRaw) return;

    const changedFields: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (value !== (initialRaw[key] ?? "")) {
        changedFields[key] = value;
      }
    }

    if (Object.keys(changedFields).length === 0) {
      return;
    }

    startSave(async () => {
      try {
        await updateProduct({ productId, fields: changedFields });
        await loadProduct();
        setSaveSuccess(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存に失敗しました");
      }
    });
  };

  const allFields = raw
    ? [...FIELD_CONFIGS, ...getExtraFields(raw)]
    : FIELD_CONFIGS;

  const sections: FieldSection[] = ["basic", "creema", "minne", "iichi", "base"];

  const hasChanges =
    raw &&
    initialRaw &&
    Object.entries(raw).some(([key, value]) => value !== (initialRaw[key] ?? ""));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">商品編集</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={pendingSave || !hasChanges}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendingSave ? "保存中..." : "保存"}
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {saveSuccess && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
          保存しました。
        </div>
      )}

      {loading && (
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      )}

      {/* Sections */}
      {!loading && raw && (
        <div className="space-y-6">
          {sections.map((section) => {
            const sectionFields = allFields.filter(
              (f) => f.section === section
            );
            if (sectionFields.length === 0 && section !== "base") return null;

            const isCollapsed = collapsedSections.has(section);

            return (
              <section
                key={section}
                className="overflow-hidden rounded-lg border border-border bg-card shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => toggleSection(section)}
                  className="flex w-full items-center gap-2 border-b border-border bg-muted/50 px-4 py-3 text-sm font-semibold text-foreground"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  {SECTION_LABELS[section]}
                </button>

                {!isCollapsed && (
                  <div className="grid gap-4 p-4 sm:grid-cols-2">
                    {section === "base" && sectionFields.length === 0 && (
                      <p className="col-span-full text-xs text-muted-foreground">
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
                        options={fieldOptions[field.key]}
                        onPickImages={
                          field.key === "image_urls"
                            ? () => setShowImagePicker(true)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Image picker dialog */}
      {showImagePicker && (
        <ImagePickerDialog
          currentUrls={(raw?.["image_urls"] ?? "").split(",").map((s) => s.trim()).filter(Boolean)}
          onConfirm={(urls) => {
            handleFieldChange("image_urls", urls.join(","));
            setShowImagePicker(false);
          }}
          onClose={() => setShowImagePicker(false)}
        />
      )}

      {/* Bottom save bar */}
      {!loading && raw && hasChanges && (
        <div className="sticky bottom-0 flex items-center justify-end gap-2 rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
          <span className="mr-auto text-sm text-muted-foreground">
            未保存の変更があります
          </span>
          <button
            type="button"
            onClick={handleSave}
            disabled={pendingSave}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingSave ? "保存中..." : "保存"}
          </button>
        </div>
      )}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  disabled,
  options,
  onPickImages,
}: {
  field: FieldConfig;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  options?: string[];
  onPickImages?: () => void;
}) {
  const isWide = field.type === "textarea";

  const wrapperClass = isWide ? "col-span-full" : "";

  if (field.type === "textarea") {
    return (
      <div className={wrapperClass}>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-muted-foreground">
            {field.label}
          </label>
          {onPickImages && (
            <button
              type="button"
              onClick={onPickImages}
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-60"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              microCMSから選択
            </button>
          )}
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}

          rows={field.key === "description" ? 12 : 4}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 disabled:opacity-60 resize-y"
        />
        {field.key === "image_urls" && value && (
          <div className="mt-2 flex flex-wrap gap-2">
            {value.split(",").map((url) => url.trim()).filter(Boolean).map((url, i) => (
              <img
                key={url}
                src={`${url}?w=80&h=80&fit=crop`}
                alt=""
                className="h-16 w-16 rounded-md border border-border object-cover"
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (field.type === "platforms") {
    const PLATFORM_OPTIONS = [
      { value: "creema", label: "Creema" },
      { value: "minne", label: "minne" },
      { value: "base", label: "BASE" },
      { value: "iichi", label: "iichi" },
    ];
    const selected = value
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const toggle = (pf: string) => {
      const next = selected.includes(pf)
        ? selected.filter((s) => s !== pf)
        : [...selected, pf];
      onChange(next.join(","));
    };

    return (
      <div className="col-span-full">
        <label className="block text-xs font-medium text-muted-foreground mb-2">
          {field.label}
        </label>
        <div className="flex flex-wrap gap-3">
          {PLATFORM_OPTIONS.map((pf) => (
            <label
              key={pf.value}
              className="inline-flex cursor-pointer items-center gap-2"
            >
              <input
                type="checkbox"
                checked={selected.includes(pf.value)}
                onChange={() => toggle(pf.value)}
                disabled={disabled}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-foreground">{pf.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "select" && options) {
    // 現在の値が選択肢にない場合も選べるように追加
    const allOptions = options.includes(value) || !value
      ? options
      : [value, ...options];

    return (
      <div className={wrapperClass}>
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          {field.label}
        </label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-60"
        >
          <option value="">-- 選択してください --</option>
          {allOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <label className="block text-xs font-medium text-muted-foreground mb-1">
        {field.label}
      </label>
      <input
        type="text"
        inputMode={field.type === "number" ? "numeric" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        disabled={disabled}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 disabled:opacity-60"
      />
    </div>
  );
}

"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Upload, CheckCircle, AlertCircle, Loader2, X } from "lucide-react";
import { uploadImageToMicroCms } from "../../actions";

type FileEntry = {
  file: File;
  preview: string;
  status: "pending" | "uploading" | "done" | "error";
  url?: string;
  error?: string;
};

export default function ImageUploadPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const entries: FileEntry[] = Array.from(newFiles)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        status: "pending" as const,
      }));
    setFiles((prev) => [...prev, ...entries]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const entry = prev[index];
      URL.revokeObjectURL(entry.preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleUpload = async () => {
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      if (files[i].status !== "pending") continue;

      setFiles((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, status: "uploading" } : f))
      );

      const formData = new FormData();
      formData.append("file", files[i].file);

      try {
        const result = await uploadImageToMicroCms(formData);
        if ("error" in result) {
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === i ? { ...f, status: "error", error: result.error } : f
            )
          );
        } else {
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === i ? { ...f, status: "done", url: result.url } : f
            )
          );
        }
      } catch {
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i
              ? { ...f, status: "error", error: "アップロードに失敗しました" }
              : f
          )
        );
      }
    }
    setUploading(false);
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold">画像追加</h1>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-12 transition ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        }`}
      >
        <ImagePlus className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          ここに画像をドラッグ&ドロップ、またはクリックして選択
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {files.length}件の画像
            </p>
            <button
              onClick={handleUpload}
              disabled={uploading || pendingCount === 0}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "アップロード中..." : "アップロード"}
            </button>
          </div>

          <div className="space-y-2">
            {files.map((entry, i) => (
              <div
                key={`${entry.file.name}-${i}`}
                className="flex items-center gap-3 rounded-md border border-border bg-card p-3"
              >
                {/* Thumbnail */}
                <img
                  src={entry.preview}
                  alt={entry.file.name}
                  className="h-12 w-12 rounded object-cover"
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">
                    {entry.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(entry.file.size / 1024).toFixed(0)} KB
                  </p>
                  {entry.status === "done" && entry.url && (
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.url}
                    </p>
                  )}
                  {entry.status === "error" && entry.error && (
                    <p className="text-xs text-destructive">{entry.error}</p>
                  )}
                </div>

                {/* Status */}
                <div className="flex-shrink-0">
                  {entry.status === "pending" && (
                    <button
                      onClick={() => removeFile(i)}
                      className="rounded p-1 text-muted-foreground hover:bg-muted"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {entry.status === "uploading" && (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  )}
                  {entry.status === "done" && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  {entry.status === "error" && (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

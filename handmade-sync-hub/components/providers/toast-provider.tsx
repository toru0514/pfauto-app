"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type ToastVariant = "success" | "error" | "info";

type Toast = {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
  createdAt: number;
};

type ToastContextValue = {
  showToast: (toast: Omit<Toast, "id" | "createdAt">) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, "id" | "createdAt">) => {
    const id = Math.random();
    setToasts((prev) => {
      const next: Toast[] = [
        ...prev,
        {
          id,
          createdAt: Date.now(),
          ...toast,
        },
      ];
      return next.slice(-5); // 最新5件だけ保持
    });

    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4000);
  }, []);

  const contextValue = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {typeof window !== "undefined"
        ? createPortal(<ToastViewport toasts={toasts} />, document.body)
        : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

function ToastViewport({ toasts }: { toasts: Toast[] }) {
  if (!toasts.length) return null;

  return (
    <div className="fixed top-6 right-6 z-[9999] flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={[
            "rounded-md border px-4 py-3 shadow-lg transition",
            toast.variant === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : toast.variant === "error"
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : "border-slate-200 bg-white text-slate-900",
          ].join(" ")}
        >
          <p className="text-sm font-semibold">{toast.title}</p>
          {toast.description ? (
            <p className="mt-1 text-xs opacity-80">{toast.description}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

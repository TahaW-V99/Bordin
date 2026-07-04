"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { CheckCircle2, XCircle, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismiss = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-24 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-md",
              t.type === "success" && "border-bordin-green/30 bg-black/90 text-bordin-green",
              t.type === "error" && "border-red-500/30 bg-black/90 text-red-400",
              t.type === "info" && "border-white/10 bg-black/90 text-white",
            )}
          >
            {t.type === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : null}
            {t.type === "error" ? <XCircle className="h-5 w-5 shrink-0" /> : null}
            <p className="flex-1 text-sm font-medium">{t.message}</p>
            <button type="button" onClick={() => dismiss(t.id)} className="text-white/40">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

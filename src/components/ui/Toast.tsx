"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/cn";

type ToastKind = "success" | "error";

type ToastState = {
  message: string;
  kind: ToastKind;
} | null;

type ToastContextValue = {
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, kind: ToastKind) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, kind });
    timerRef.current = setTimeout(
      () => setToast(null),
      kind === "success" ? 2000 : 4000,
    );
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const value: ToastContextValue = {
    success: (message) => show(message, "success"),
    error: (message) => show(message, "error"),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full border px-4 py-2 text-sm font-medium shadow-lg",
            toast.kind === "success"
              ? "border-success/40 bg-surface text-success"
              : "border-danger/40 bg-surface text-danger",
          )}
        >
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

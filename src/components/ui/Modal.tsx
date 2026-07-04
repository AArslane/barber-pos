"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";

type ModalProps = {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
};

export function Modal({ onClose, children, maxWidth = "max-w-md" }: ModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={cn("w-full", maxWidth)}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}

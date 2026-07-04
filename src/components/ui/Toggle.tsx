"use client";

import { cn } from "@/lib/cn";

type ToggleProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
};

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors duration-150 disabled:opacity-40",
        checked ? "bg-gold-500" : "bg-surface-2 border border-border-strong",
      )}
    >
      <span
        className={cn(
          "block h-6 w-6 rounded-full bg-foreground shadow transition-transform duration-150",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}

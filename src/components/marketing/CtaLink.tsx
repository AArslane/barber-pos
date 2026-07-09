"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { track } from "@/lib/analytics";

type CtaLinkProps = {
  location: "header" | "hero" | "pricing" | "final";
  href?: string;
  variant?: "primary" | "secondary";
  size?: "md" | "xl";
  className?: string;
  children: React.ReactNode;
};

// CTA marketing : un <Link> stylé comme Button (ui/Button est un <button>),
// qui trace le clic avec sa position dans la page.
export function CtaLink({
  location,
  href = "/inscription",
  variant = "primary",
  size = "xl",
  className,
  children,
}: CtaLinkProps) {
  return (
    <Link
      href={href}
      onClick={() => track("cta_click", { location })}
      className={cn(
        "inline-flex items-center justify-center gap-2 transition-colors duration-150",
        variant === "primary"
          ? "bg-gold-500 text-gold-ink hover:bg-gold-400 active:bg-gold-600 font-semibold"
          : "bg-surface-2 text-foreground border border-border hover:bg-border-strong/30",
        size === "xl"
          ? "min-h-14 px-6 text-lg font-bold rounded-xl active:scale-[0.97]"
          : "min-h-11 px-4 text-sm rounded-lg",
        className,
      )}
    >
      {children}
    </Link>
  );
}

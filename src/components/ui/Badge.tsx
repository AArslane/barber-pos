import { cn } from "@/lib/cn";

type BadgeTone = "neutral" | "success" | "danger" | "info" | "gold";

const toneCls: Record<BadgeTone, string> = {
  neutral: "bg-muted/10 border-muted/40 text-muted",
  success: "bg-success/10 border-success/40 text-success",
  danger: "bg-danger/10 border-danger/40 text-danger",
  info: "bg-info/10 border-info/40 text-info",
  gold: "bg-gold-500/10 border-gold-400/40 text-gold-400",
};

type BadgeProps = {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
};

export function Badge({ tone = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneCls[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

type StatusDotProps = {
  tone?: BadgeTone;
  className?: string;
  style?: React.CSSProperties;
};

const dotCls: Record<BadgeTone, string> = {
  neutral: "bg-muted",
  success: "bg-success",
  danger: "bg-danger",
  info: "bg-info",
  gold: "bg-gold-500",
};

export function StatusDot({ tone = "neutral", className, style }: StatusDotProps) {
  return (
    <span
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", dotCls[tone], className)}
      style={style}
      aria-hidden="true"
    />
  );
}

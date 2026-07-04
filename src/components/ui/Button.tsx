import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "md" | "lg" | "xl";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantCls: Record<ButtonVariant, string> = {
  primary:
    "bg-gold-500 text-gold-ink hover:bg-gold-400 active:bg-gold-600 font-semibold",
  secondary:
    "bg-surface-2 text-foreground border border-border hover:bg-border-strong/30",
  ghost: "text-muted hover:text-foreground hover:bg-surface-2",
  danger: "bg-danger-strong text-white hover:bg-danger",
};

const sizeCls: Record<ButtonSize, string> = {
  md: "min-h-11 px-4 text-sm rounded-lg",
  lg: "min-h-12 px-5 text-sm rounded-xl",
  xl: "min-h-14 px-6 text-lg font-bold rounded-xl active:scale-[0.97]",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 transition-colors duration-150 disabled:opacity-40",
        variantCls[variant],
        sizeCls[size],
        className,
      )}
      {...props}
    />
  );
}

import { cn } from "@/lib/cn";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-lg border border-border-strong bg-surface-2 px-3 text-base text-foreground placeholder:text-faint focus:border-gold-500 focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-lg border border-border-strong bg-surface-2 px-3 text-base text-foreground focus:border-gold-500 focus:outline-none",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

type FieldProps = {
  label: string;
  children: React.ReactNode;
  className?: string;
};

export function Field({ label, children, className }: FieldProps) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}

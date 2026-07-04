import { cn } from "@/lib/cn";

type CardProps = {
  inset?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function Card({ inset, className, children }: CardProps) {
  return (
    <div
      className={cn(
        inset
          ? "bg-background/50 rounded-xl p-3"
          : "bg-surface border border-border rounded-2xl p-5 shadow-sm shadow-black/20",
        className,
      )}
    >
      {children}
    </div>
  );
}

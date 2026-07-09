import Link from "next/link";
import { cn } from "@/lib/cn";

// Bandeau "essai en cours" du dashboard. Affiché par le layout uniquement si
// Stripe est configuré, aucun abonnement actif, et trial_ends_at futur.
export function TrialBanner({ daysLeft }: { daysLeft: number }) {
  const urgent = daysLeft <= 3;
  return (
    <div
      className={cn(
        "border-b px-4 sm:px-6 py-2 text-sm flex items-center justify-between gap-4",
        urgent
          ? "border-danger/40 bg-danger/10 text-danger"
          : "border-gold-400/30 bg-gold-500/10 text-gold-400"
      )}
    >
      <span>
        Essai gratuit — {daysLeft} jour{daysLeft > 1 ? "s" : ""} restant{daysLeft > 1 ? "s" : ""}
      </span>
      <Link
        href="/dashboard/reglages"
        className="shrink-0 font-semibold underline underline-offset-4 hover:opacity-80"
      >
        S&apos;abonner
      </Link>
    </div>
  );
}

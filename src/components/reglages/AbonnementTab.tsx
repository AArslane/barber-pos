"use client";

import { useEffect, useState } from "react";
import { getSubscriptionInfo } from "@/app/dashboard/reglages/actions";
import type { SubscriptionStatus } from "@/lib/subscription";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { track } from "@/lib/analytics";

const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  trialing: "Période d'essai",
  past_due: "Paiement en retard",
  canceled: "Annulé",
  none: "Aucun abonnement",
};

export function AbonnementTab({ shopId }: { shopId: string }) {
  const [info, setInfo] = useState<{ stripeConfigured: boolean; subscription: SubscriptionStatus | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    void getSubscriptionInfo(shopId).then(setInfo);
  }, [shopId]);

  async function startCheckout() {
    setLoading(true);
    track("checkout_started", { source: "reglages" });
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Erreur Stripe");
      window.location.href = data.url;
    } catch {
      toast.error("Impossible de démarrer l'abonnement.");
      setLoading(false);
    }
  }

  async function openPortal() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Erreur Stripe");
      window.location.href = data.url;
    } catch {
      toast.error("Impossible d'ouvrir le portail d'abonnement.");
      setLoading(false);
    }
  }

  if (!info) {
    return <Skeleton className="h-32 w-full max-w-md rounded-2xl" />;
  }

  if (!info.stripeConfigured) {
    return (
      <Card className="max-w-md space-y-2">
        <p className="text-sm text-muted">
          La facturation n&apos;est pas configurée sur cette instance : la caisse et le dashboard
          fonctionnent normalement sans abonnement.
        </p>
      </Card>
    );
  }

  const status = info.subscription?.status ?? "none";
  const active = status === "active" || status === "trialing";

  return (
    <Card className="max-w-md space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">Statut</span>
        <Badge tone={active ? "success" : "danger"}>{STATUS_LABELS[status] ?? status}</Badge>
      </div>
      {info.subscription?.currentPeriodEnd && (
        <p className="text-xs text-faint">
          Renouvellement le{" "}
          {new Date(info.subscription.currentPeriodEnd).toLocaleDateString("fr-FR")}
        </p>
      )}
      {active ? (
        <Button onClick={openPortal} disabled={loading}>
          {loading ? "Redirection…" : "Gérer l'abonnement"}
        </Button>
      ) : (
        <Button variant="primary" onClick={startCheckout} disabled={loading}>
          {loading ? "Redirection…" : "S'abonner"}
        </Button>
      )}
    </Card>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LockIcon } from "@/components/icons";
import { track } from "@/lib/analytics";

// La caisse ne passe jamais par ce composant : ce gating ne concerne que le
// dashboard, et uniquement si Stripe est configuré et l'abonnement inactif.
// Remplace entièrement le contenu de la page (pas de wrapping) : les données
// du shop ne doivent pas être chargées tant que l'abonnement est inactif.
export function SubscriptionGate({ trialExpired = false }: { trialExpired?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    track("checkout_started", { source: "gate" });
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Erreur Stripe");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue");
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <Card className="max-w-md space-y-4 p-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-gold-400/40 bg-gold-500/10">
          <LockIcon className="h-6 w-6 text-gold-400" />
        </span>
        <h1 className="text-xl font-bold">
          {trialExpired ? "Votre essai gratuit est terminé" : "Abonnement requis"}
        </h1>
        <p className="text-sm text-muted">
          {trialExpired
            ? "Les 14 jours d'essai sont écoulés : abonnez-vous pour retrouver votre dashboard. La caisse continue de fonctionner normalement sur la tablette."
            : "L'accès au dashboard nécessite un abonnement actif. La caisse continue de fonctionner normalement sur la tablette."}
        </p>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button variant="primary" size="lg" className="w-full" onClick={startCheckout} disabled={loading}>
          {loading ? "Redirection…" : "S'abonner"}
        </Button>
        <Link href="/dashboard/reglages" className="block text-sm text-muted hover:text-foreground">
          Voir les réglages de facturation
        </Link>
      </Card>
    </div>
  );
}

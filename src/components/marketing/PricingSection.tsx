import Link from "next/link";
import { CtaLink } from "./CtaLink";

// Paliers du BUSINESS_PLAN.md §6 — affichage seul : tous les CTA mènent à
// l'essai gratuit, le choix du palier se fait dans le dashboard (Abonnement).
const tiers = [
  {
    name: "Solo",
    price: "29,99",
    target: "Le patron au fauteuil",
    features: ["1 boutique", "3 coiffeurs actifs", "Toutes les fonctionnalités", "Support WhatsApp"],
    highlighted: false,
  },
  {
    name: "Équipe",
    price: "49,99",
    target: "Le salon d'équipe",
    features: ["1 boutique", "Coiffeurs illimités", "Toutes les fonctionnalités", "Support WhatsApp"],
    highlighted: true,
  },
  {
    name: "Multi",
    price: "99,99",
    target: "Le patron multi-boutiques",
    features: [
      "Jusqu'à 3 boutiques (+19,99 €/boutique supp.)",
      "Coiffeurs illimités",
      "Toutes les fonctionnalités",
      "Support prioritaire + installation sur site",
    ],
    highlighted: false,
  },
];

export function PricingSection({ detailed = false }: { detailed?: boolean }) {
  return (
    <section className="px-4 sm:px-6 py-16 border-t border-border" id="tarifs">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-display text-3xl sm:text-4xl tracking-wide text-center">
          Un prix simple, sans surprise
        </h2>
        <p className="mt-3 text-center text-muted">
          14 jours d&apos;essai gratuit, sans carte bancaire. Sans engagement. 0 commission
          sur vos encaissements, 0 matériel à acheter.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-2xl border p-6 flex flex-col gap-4 ${
                tier.highlighted
                  ? "border-gold-400/60 bg-gold-500/5"
                  : "border-border bg-surface"
              }`}
            >
              <div>
                <h3 className="font-display text-2xl tracking-wide">{tier.name}</h3>
                <p className="text-xs text-muted">{tier.target}</p>
              </div>
              <p>
                <span className="font-display text-4xl tracking-wide text-gold-400">
                  {tier.price} €
                </span>
                <span className="text-sm text-muted"> HT/mois</span>
              </p>
              <ul className="space-y-2 text-sm text-muted flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-gold-400">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <CtaLink
                location="pricing"
                size="md"
                variant={tier.highlighted ? "primary" : "secondary"}
                className="w-full"
              >
                Essayer gratuitement
              </CtaLink>
            </div>
          ))}
        </div>
        {detailed ? (
          <div className="mt-10 mx-auto max-w-2xl space-y-3 text-sm text-muted">
            <p>
              <strong className="text-foreground">Toutes les fonctionnalités pour tout le monde</strong>{" "}
              : caisse offline, dashboard temps réel, historique, statistiques et
              commissions automatiques sont inclus dans chaque palier. Seules les
              limites (boutiques, coiffeurs) changent.
            </p>
            <p>
              <strong className="text-foreground">Annuel : 2 mois offerts</strong> (299 / 499 /
              999 € HT par an).
            </p>
            <p>
              Prix affichés hors taxes, facturation mensuelle par carte, résiliable à
              tout moment.
            </p>
          </div>
        ) : (
          <p className="mt-6 text-center text-sm text-muted">
            Détails et facturation annuelle sur la page{" "}
            <Link href="/tarifs" className="text-gold-400 underline underline-offset-4">
              tarifs
            </Link>
            .
          </p>
        )}
      </div>
    </section>
  );
}

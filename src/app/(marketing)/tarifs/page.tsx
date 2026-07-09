import type { Metadata } from "next";
import { PricingSection } from "@/components/marketing/PricingSection";
import { FinalCta } from "@/components/marketing/FinalCta";

export const metadata: Metadata = {
  title: "Tarifs",
  description:
    "Tarifs simples et sans engagement : Solo 29,99 €, Équipe 49,99 €, Multi 99,99 € HT/mois. Toutes les fonctionnalités dans chaque palier. Essai gratuit 14 jours sans carte bancaire.",
  alternates: { canonical: "/tarifs" },
};

export default function TarifsPage() {
  return (
    <>
      <div className="px-4 sm:px-6 pt-14 text-center">
        <h1 className="font-display text-4xl sm:text-5xl tracking-wide">Tarifs</h1>
      </div>
      <PricingSection detailed />
      <FinalCta />
    </>
  );
}

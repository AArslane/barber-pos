import type { Metadata } from "next";
import { BRAND_NAME, SITE_URL } from "@/lib/brand";
import { Header } from "@/components/marketing/Header";
import { Footer } from "@/components/marketing/Footer";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND_NAME} — Caisse et commissions pour barbershops et salons de coiffure`,
    template: `%s — ${BRAND_NAME}`,
  },
  description: `${BRAND_NAME} est un logiciel caisse barbershop sur tablette : encaissements en 3 secondes, commissions des coiffeurs calculées automatiquement, chiffre d'affaires en temps réel. Essai gratuit 14 jours, sans carte bancaire.`,
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: BRAND_NAME,
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

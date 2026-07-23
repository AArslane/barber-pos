import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicShop } from "@/lib/booking";
import { BookingWidget } from "@/components/booking/BookingWidget";
import { ScissorsIcon } from "@/components/icons";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ embed?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getPublicShop(slug);
  return {
    title: shop ? `Réserver — ${shop.name}` : "Réserver",
    robots: { index: false },
  };
}

// Page de réservation publique d'un salon. En ?embed=1 (iframe sur le site du
// salon), seul le widget est rendu — c'est le produit vendu avec la caisse.
export default async function ReserverPage({ params, searchParams }: Props) {
  const [{ slug }, { embed }] = await Promise.all([params, searchParams]);
  const shop = await getPublicShop(slug);
  if (!shop || !shop.settings.booking.enabled) notFound();

  const isEmbed = embed === "1";

  return (
    <div className={isEmbed ? "p-4" : "min-h-screen px-4 py-10"}>
      <div className="mx-auto w-full max-w-lg space-y-6">
        {!isEmbed && (
          <header className="text-center space-y-2">
            <p className="flex items-center justify-center gap-2 font-display text-sm tracking-widest text-muted">
              <ScissorsIcon className="w-4 h-4 text-gold-500" />
              {shop.name.toUpperCase()}
            </p>
            <h1 className="font-display text-3xl tracking-wide">Réserver un rendez-vous</h1>
          </header>
        )}
        <BookingWidget
          shop={{ name: shop.name, slug: shop.slug, services: shop.services, barbers: shop.barbers }}
        />
      </div>
    </div>
  );
}

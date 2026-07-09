import { CtaLink } from "./CtaLink";
import { MockCaisse } from "./mockups/MockCaisse";
import { MockDashboard } from "./mockups/MockDashboard";

export function Hero() {
  return (
    <section className="px-4 sm:px-6 pt-14 pb-16 sm:pt-20 sm:pb-24">
      <div className="mx-auto max-w-6xl grid items-center gap-12 lg:grid-cols-2">
        <div className="space-y-6">
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-tight tracking-wide">
            Tu sais enfin combien chaque coiffeur t&apos;a rapporté —{" "}
            <span className="text-gold-400">sans carnet, sans Excel, sans dispute.</span>
          </h1>
          <p className="text-lg text-muted max-w-xl">
            Caisse tablette + commissions automatiques pour barbershops et salons.
            Essai gratuit, sans carte bancaire.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <CtaLink location="hero">Essayer gratuitement</CtaLink>
            <span className="text-sm text-muted">
              14 jours gratuits · sans CB · sans engagement
            </span>
          </div>
        </div>
        {/* Emplacement de la future vidéo démo : mockups caisse + dashboard superposés */}
        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <MockCaisse className="w-[85%]" />
          <MockDashboard className="absolute -bottom-8 right-0 w-[70%]" />
        </div>
      </div>
    </section>
  );
}

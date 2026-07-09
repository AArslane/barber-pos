import { CtaLink } from "./CtaLink";

export function FinalCta() {
  return (
    <section className="px-4 sm:px-6 py-20 border-t border-border">
      <div className="mx-auto max-w-2xl text-center space-y-6">
        <h2 className="font-display text-3xl sm:text-4xl tracking-wide">
          Ce soir, tu sauras ce que ton salon a encaissé aujourd&apos;hui.
        </h2>
        <CtaLink location="final">Essayer gratuitement</CtaLink>
        <p className="text-sm text-muted">
          14 jours gratuits, sans carte bancaire, sans engagement — installé en 10 minutes
          sur ta tablette.
        </p>
      </div>
    </section>
  );
}

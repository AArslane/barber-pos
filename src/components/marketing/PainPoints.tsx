const pains = [
  {
    title: "Le carnet",
    text: "Les ventes notées à la main (ou de tête), les pages qui se perdent, les fins de journée à recompter. Ici chaque coupe est tapée en 3 secondes sur la tablette.",
  },
  {
    title: "Le calcul des commissions le 30 du mois",
    text: "La calculatrice, les tickets, les discussions qui s'enveniment. Chaque coiffeur a son profil : ses ventes et sa commission se calculent toutes seules, au centime.",
  },
  {
    title: "Aucune idée de ton CA quand t'es pas là",
    text: "Le chiffre de chaque boutique en direct sur ton téléphone, où que tu sois. Fini de piloter à l'aveugle ou d'appeler le salon pour savoir.",
  },
];

export function PainPoints() {
  return (
    <section className="px-4 sm:px-6 py-16 border-t border-border">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-display text-3xl sm:text-4xl tracking-wide text-center">
          Tu gères encore ton salon comme ça ?
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {pains.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-border bg-surface p-6 space-y-3"
            >
              <h3 className="font-display text-xl tracking-wide text-gold-400">{p.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{p.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

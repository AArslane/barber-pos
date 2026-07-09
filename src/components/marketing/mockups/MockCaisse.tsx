// Mockup statique de l'écran caisse (données fictives) — remplacé plus tard
// par la vidéo tournée chez les salons pilotes.
const services = [
  { name: "Dégradé", price: "18 €", active: true },
  { name: "Coupe + barbe", price: "28 €", active: false },
  { name: "Barbe", price: "12 €", active: false },
  { name: "Coupe enfant", price: "14 €", active: false },
  { name: "Contours", price: "8 €", active: false },
  { name: "Traçage", price: "10 €", active: false },
];

export function MockCaisse({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-2xl border border-border bg-surface p-4 shadow-xl shadow-black/40 ${className ?? ""}`}
    >
      <div className="flex items-center justify-between pb-3">
        <span className="font-display tracking-widest text-sm text-muted">CAISSE</span>
        <span className="flex items-center gap-2 text-xs text-muted">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gold-500/20 text-gold-400 font-bold">
            S
          </span>
          Sofiane
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {services.map((s) => (
          <div
            key={s.name}
            className={`rounded-lg border p-2 text-center ${
              s.active
                ? "border-gold-400/60 bg-gold-500/15"
                : "border-border bg-surface-2"
            }`}
          >
            <p className="text-xs font-medium truncate">{s.name}</p>
            <p className={`text-sm font-bold ${s.active ? "text-gold-400" : "text-muted"}`}>
              {s.price}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
        <span className="text-sm text-muted">Total</span>
        <span className="font-display text-2xl tracking-wide text-gold-400">18 €</span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs font-semibold">
        <div className="rounded-lg bg-gold-500 px-2 py-2 text-gold-ink">Espèces</div>
        <div className="rounded-lg bg-surface-2 px-2 py-2 text-muted">Carte</div>
        <div className="rounded-lg bg-surface-2 px-2 py-2 text-muted">Autre</div>
      </div>
    </div>
  );
}

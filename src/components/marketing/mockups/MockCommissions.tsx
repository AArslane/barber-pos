// Mockup statique de l'écran commissions du mois (données fictives).
const rows = [
  { name: "Sofiane", ca: "4 210 €", pct: "50 %", due: "2 105 €" },
  { name: "Mehdi", ca: "3 380 €", pct: "40 %", due: "1 352 €" },
  { name: "Yanis", ca: "2 140 €", pct: "50 %", due: "1 070 €" },
];

export function MockCommissions({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-2xl border border-border bg-surface p-4 shadow-xl shadow-black/40 ${className ?? ""}`}
    >
      <div className="flex items-center justify-between pb-3">
        <span className="font-display tracking-widest text-sm text-muted">
          COMMISSIONS — MARS
        </span>
        <span className="rounded-full border border-gold-400/40 bg-gold-500/10 px-2 py-0.5 text-xs text-gold-400">
          Calcul auto
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-4 bg-surface-2 px-3 py-2 text-xs text-muted">
          <span>Coiffeur</span>
          <span className="text-right">CA</span>
          <span className="text-right">Taux</span>
          <span className="text-right">À verser</span>
        </div>
        {rows.map((r) => (
          <div
            key={r.name}
            className="grid grid-cols-4 border-t border-border px-3 py-2 text-sm"
          >
            <span className="font-medium">{r.name}</span>
            <span className="text-right text-muted">{r.ca}</span>
            <span className="text-right text-muted">{r.pct}</span>
            <span className="text-right font-bold text-gold-400">{r.due}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-muted">
        Zéro calculatrice le 30 du mois.
      </p>
    </div>
  );
}

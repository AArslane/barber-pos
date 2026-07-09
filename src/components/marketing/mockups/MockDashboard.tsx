// Mockup statique du dashboard patron (données fictives).
const barbers = [
  { name: "Sofiane", amount: "612 €", pct: 85 },
  { name: "Mehdi", amount: "487 €", pct: 68 },
  { name: "Yanis", amount: "341 €", pct: 47 },
];

export function MockDashboard({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-2xl border border-border bg-surface p-4 shadow-xl shadow-black/40 ${className ?? ""}`}
    >
      <div className="flex items-center justify-between pb-3">
        <span className="font-display tracking-widest text-sm text-muted">
          AUJOURD&apos;HUI
        </span>
        <span className="flex items-center gap-1.5 text-xs text-success">
          <span className="inline-block h-2 w-2 rounded-full bg-success" />
          En direct
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-xs text-muted">Chiffre d&apos;affaires</p>
          <p className="font-display text-3xl tracking-wide text-gold-400">1 440 €</p>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-xs text-muted">Ventes</p>
          <p className="font-display text-3xl tracking-wide">52</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {barbers.map((b) => (
          <div key={b.name} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs text-muted">{b.name}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
              <span
                className="block h-full rounded-full bg-gold-500"
                style={{ width: `${b.pct}%` }}
              />
            </span>
            <span className="w-14 shrink-0 text-right text-xs font-semibold">{b.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

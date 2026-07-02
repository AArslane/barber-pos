"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatEUR, type Barber, type Sale, type SaleItem } from "@/lib/types";

type SaleWithItems = Sale & { sale_items: SaleItem[] };
type Range = 7 | 30 | 90;

const ACCENT = "#6366f1"; // validé (contraste + bande de luminosité) sur zinc-950

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function StatsPage() {
  const [range, setRange] = useState<Range>(30);
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);

  const load = useCallback(async () => {
    const supabase = createClient();
    const start = new Date();
    start.setDate(start.getDate() - (range - 1));
    start.setHours(0, 0, 0, 0);

    const [salesRes, barbersRes] = await Promise.all([
      supabase
        .from("sales")
        .select("*, sale_items(*)")
        .eq("status", "completed")
        .gte("created_at", start.toISOString()),
      supabase.from("barbers").select("*"),
    ]);
    setSales((salesRes.data as SaleWithItems[]) ?? []);
    setBarbers((barbersRes.data as Barber[]) ?? []);
  }, [range]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch async, setState après await (faux positif)
    void load();
  }, [load]);

  // CA par jour (jours vides inclus)
  const days: { key: string; label: string; amount: number }[] = [];
  for (let i = range - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      key: dayKey(d),
      label: d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
      amount: 0,
    });
  }
  const byDay = new Map(days.map((d) => [d.key, d]));
  for (const s of sales) {
    const entry = byDay.get(dayKey(new Date(s.created_at)));
    if (entry) entry.amount += Number(s.total);
  }
  const maxDay = Math.max(...days.map((d) => d.amount), 1);
  const tickEvery = range === 7 ? 1 : range === 30 ? 5 : 15;

  // Top prestations
  const byService = new Map<string, { amount: number; count: number }>();
  for (const s of sales) {
    for (const item of s.sale_items) {
      const cur = byService.get(item.name_snapshot) ?? { amount: 0, count: 0 };
      cur.amount += Number(item.price_snapshot) * item.qty;
      cur.count += item.qty;
      byService.set(item.name_snapshot, cur);
    }
  }
  const topServices = [...byService.entries()]
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 8);
  const maxService = Math.max(...topServices.map(([, v]) => v.amount), 1);

  // Comparatif coiffeurs
  const byBarber = barbers
    .map((b) => ({
      barber: b,
      amount: sales
        .filter((s) => s.barber_id === b.id)
        .reduce((sum, s) => sum + Number(s.total), 0),
    }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const maxBarber = Math.max(...byBarber.map((r) => r.amount), 1);

  const total = sales.reduce((sum, s) => sum + Number(s.total), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">Stats</h1>
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          {([7, 30, 90] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${
                range === r ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {r} j
            </button>
          ))}
        </div>
      </div>

      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-sm uppercase tracking-wide text-zinc-500">
            CA par jour
          </h2>
          <span className="text-sm text-zinc-400">
            Total : <span className="text-zinc-100 font-semibold">{formatEUR(total)}</span>
          </span>
        </div>
        <div className="flex items-end gap-[2px] h-40">
          {days.map((d) => (
            <div key={d.key} className="group relative flex-1 flex flex-col justify-end h-full">
              <div
                className="rounded-t"
                style={{
                  backgroundColor: d.amount > 0 ? ACCENT : "#27272a",
                  height: d.amount > 0 ? `${Math.max((d.amount / maxDay) * 100, 3)}%` : "2px",
                }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap z-10">
                <span className="text-zinc-400">{d.label}</span>{" "}
                <span className="font-semibold">{formatEUR(d.amount)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-[2px] mt-1">
          {days.map((d, i) => (
            <span key={d.key} className="flex-1 text-[10px] text-zinc-500 text-center overflow-visible whitespace-nowrap">
              {i % tickEvery === 0 ? d.label : ""}
            </span>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h2 className="text-sm uppercase tracking-wide text-zinc-500 mb-4">
            Top prestations
          </h2>
          {topServices.length === 0 ? (
            <p className="text-zinc-500 text-sm">Aucune vente sur la période.</p>
          ) : (
            <div className="space-y-3">
              {topServices.map(([name, v]) => (
                <div key={name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="truncate">{name}</span>
                    <span className="text-zinc-400 shrink-0 ml-2">
                      {v.count} · <span className="text-zinc-100">{formatEUR(v.amount)}</span>
                    </span>
                  </div>
                  <div className="h-2.5 rounded bg-zinc-800">
                    <div
                      className="h-full rounded"
                      style={{ width: `${(v.amount / maxService) * 100}%`, backgroundColor: ACCENT }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h2 className="text-sm uppercase tracking-wide text-zinc-500 mb-4">
            Comparatif coiffeurs
          </h2>
          {byBarber.length === 0 ? (
            <p className="text-zinc-500 text-sm">Aucune vente sur la période.</p>
          ) : (
            <div className="space-y-3">
              {byBarber.map(({ barber, amount }) => (
                <div key={barber.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="flex items-center gap-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: barber.color }} />
                      {barber.display_name}
                    </span>
                    <span className="text-zinc-100 shrink-0 ml-2">{formatEUR(amount)}</span>
                  </div>
                  <div className="h-2.5 rounded bg-zinc-800">
                    <div
                      className="h-full rounded"
                      style={{ width: `${(amount / maxBarber) * 100}%`, backgroundColor: ACCENT }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

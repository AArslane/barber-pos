"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatEUR, type Barber, type Sale, type SaleItem } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusDot } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

type SaleWithItems = Sale & { sale_items: SaleItem[] };
type Range = 7 | 30 | 90;

const ACCENT = "var(--color-gold-500)";
const BAR_EMPTY = "var(--color-surface-2)";

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function StatsPage() {
  const [range, setRange] = useState<Range>(30);
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = useCallback(async () => {
    const supabase = createClient("owner");
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
    if (salesRes.error || barbersRes.error) {
      toast.error("Impossible de charger les statistiques.");
    }
    setSales((salesRes.data as SaleWithItems[]) ?? []);
    setBarbers((barbersRes.data as Barber[]) ?? []);
    setLoading(false);
  }, [range, toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch async, setState après await (faux positif)
    void load();
  }, [load]);

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

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">Stats</h1>
        <Skeleton className="h-56 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">Stats</h1>
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          {([7, 30, 90] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150",
                range === r
                  ? "bg-surface-2 text-gold-400"
                  : "text-muted hover:text-foreground",
              )}
            >
              {r} j
            </button>
          ))}
        </div>
      </div>

      <Card>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-sm uppercase tracking-wide text-muted">CA par jour</h2>
          <span className="text-sm text-muted">
            Total : <span className="text-foreground font-semibold">{formatEUR(total)}</span>
          </span>
        </div>
        <div className="flex items-end gap-[2px] h-40">
          {days.map((d) => (
            <div key={d.key} className="group relative flex-1 flex flex-col justify-end h-full">
              <div
                className="rounded-t"
                style={{
                  backgroundColor: d.amount > 0 ? ACCENT : BAR_EMPTY,
                  height: d.amount > 0 ? `${Math.max((d.amount / maxDay) * 100, 3)}%` : "2px",
                }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-surface-2 border border-border rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap z-10">
                <span className="text-muted">{d.label}</span>{" "}
                <span className="font-semibold">{formatEUR(d.amount)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-[2px] mt-1">
          {days.map((d, i) => (
            <span
              key={d.key}
              className="flex-1 text-[10px] text-muted text-center overflow-visible whitespace-nowrap"
            >
              {i % tickEvery === 0 ? d.label : ""}
            </span>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-sm uppercase tracking-wide text-muted mb-4">
            Top prestations
          </h2>
          {topServices.length === 0 ? (
            <EmptyState title="Aucune vente sur la période." />
          ) : (
            <div className="space-y-3">
              {topServices.map(([name, v]) => (
                <div key={name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="truncate">{name}</span>
                    <span className="text-muted shrink-0 ml-2">
                      {v.count} · <span className="text-foreground">{formatEUR(v.amount)}</span>
                    </span>
                  </div>
                  <div className="h-2.5 rounded bg-surface-2">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${(v.amount / maxService) * 100}%`,
                        backgroundColor: ACCENT,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-sm uppercase tracking-wide text-muted mb-4">
            Comparatif coiffeurs
          </h2>
          {byBarber.length === 0 ? (
            <EmptyState title="Aucune vente sur la période." />
          ) : (
            <div className="space-y-3">
              {byBarber.map(({ barber, amount }) => (
                <div key={barber.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="flex items-center gap-2 truncate">
                      <StatusDot style={{ backgroundColor: barber.color }} />
                      {barber.display_name}
                    </span>
                    <span className="text-foreground shrink-0 ml-2">{formatEUR(amount)}</span>
                  </div>
                  <div className="h-2.5 rounded bg-surface-2">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${(amount / maxBarber) * 100}%`,
                        backgroundColor: ACCENT,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

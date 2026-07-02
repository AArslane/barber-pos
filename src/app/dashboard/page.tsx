"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatEUR, PAYMENT_LABELS, type Barber, type PaymentMethod, type Sale } from "@/lib/types";

export default function TodayPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);

  const load = useCallback(async () => {
    const supabase = createClient();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [salesRes, barbersRes] = await Promise.all([
      supabase
        .from("sales")
        .select("*")
        .gte("created_at", startOfDay.toISOString())
        .order("created_at", { ascending: false }),
      supabase.from("barbers").select("*"),
    ]);
    if (salesRes.data) setSales(salesRes.data as Sale[]);
    if (barbersRes.data) setBarbers(barbersRes.data as Barber[]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch async, setState après await (faux positif)
    void load();
    const supabase = createClient();
    const channel = supabase
      .channel("sales-today")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales" },
        () => void load()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const completed = sales.filter((s) => s.status === "completed");
  const total = completed.reduce((sum, s) => sum + Number(s.total), 0);
  const avg = completed.length > 0 ? total / completed.length : 0;

  const byMethod = (Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => ({
    method: m,
    amount: completed
      .filter((s) => s.payment_method === m)
      .reduce((sum, s) => sum + Number(s.total), 0),
  }));

  const byBarber = barbers
    .map((b) => {
      const own = completed.filter((s) => s.barber_id === b.id);
      return {
        barber: b,
        count: own.length,
        amount: own.reduce((sum, s) => sum + Number(s.total), 0),
      };
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Aujourd&apos;hui</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Chiffre d'affaires" value={formatEUR(total)} />
        <StatCard label="Ventes" value={String(completed.length)} />
        <StatCard label="Panier moyen" value={formatEUR(avg)} />
      </div>

      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm uppercase tracking-wide text-zinc-500 mb-3">
          Par mode de paiement
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {byMethod.map(({ method, amount }) => (
            <div key={method}>
              <p className="text-sm text-zinc-400">{PAYMENT_LABELS[method]}</p>
              <p className="text-lg font-semibold">{formatEUR(amount)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm uppercase tracking-wide text-zinc-500 mb-3">
          Par coiffeur
        </h2>
        {byBarber.length === 0 ? (
          <p className="text-zinc-500 text-sm">Aucune vente pour l&apos;instant.</p>
        ) : (
          <div className="space-y-2">
            {byBarber.map(({ barber, count, amount }) => (
              <div
                key={barber.id}
                className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0"
              >
                <span className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: barber.color }}
                  />
                  <span className="font-medium">{barber.display_name}</span>
                  <span className="text-sm text-zinc-500">
                    {count} vente{count > 1 ? "s" : ""}
                  </span>
                </span>
                <span className="font-semibold">{formatEUR(amount)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

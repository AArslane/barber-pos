"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatEUR, type Barber, type BarberPrivate, type Sale } from "@/lib/types";

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthStart(offset = 0): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offset, 1);
}

export default function CommissionsPage() {
  const [from, setFrom] = useState(() => toDateInput(monthStart()));
  const [to, setTo] = useState(() => toDateInput(new Date()));
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [commissions, setCommissions] = useState<BarberPrivate[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  const load = useCallback(async () => {
    const supabase = createClient();
    const fromDate = new Date(from + "T00:00:00");
    const toDate = new Date(to + "T23:59:59.999");

    const [barbersRes, privateRes, salesRes] = await Promise.all([
      supabase.from("barbers").select("*"),
      supabase.from("barber_private").select("*"),
      supabase
        .from("sales")
        .select("*")
        .eq("status", "completed")
        .gte("created_at", fromDate.toISOString())
        .lte("created_at", toDate.toISOString()),
    ]);
    setBarbers((barbersRes.data as Barber[]) ?? []);
    setCommissions((privateRes.data as BarberPrivate[]) ?? []);
    setSales((salesRes.data as Sale[]) ?? []);
  }, [from, to]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch async, setState après await (faux positif)
    void load();
  }, [load]);

  function setPreset(preset: "month" | "lastMonth" | "7d") {
    if (preset === "month") {
      setFrom(toDateInput(monthStart()));
      setTo(toDateInput(new Date()));
    } else if (preset === "lastMonth") {
      setFrom(toDateInput(monthStart(-1)));
      const end = monthStart();
      end.setDate(0);
      setTo(toDateInput(end));
    } else {
      const start = new Date();
      start.setDate(start.getDate() - 6);
      setFrom(toDateInput(start));
      setTo(toDateInput(new Date()));
    }
  }

  const rows = barbers
    .map((b) => {
      const own = sales.filter((s) => s.barber_id === b.id);
      const ca = own.reduce((sum, s) => sum + Number(s.total), 0);
      const pct = Number(commissions.find((c) => c.barber_id === b.id)?.commission_pct ?? 0);
      return {
        barber: b,
        count: own.length,
        ca,
        pct,
        commission: (ca * pct) / 100,
      };
    })
    .filter((r) => r.count > 0 || r.barber.active)
    .sort((a, b) => b.ca - a.ca);

  const totalCA = rows.reduce((sum, r) => sum + r.ca, 0);
  const totalCommission = rows.reduce((sum, r) => sum + r.commission, 0);

  const inputCls =
    "rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-indigo-500";
  const presetCls =
    "px-3 py-2 rounded-lg text-sm bg-zinc-800 hover:bg-zinc-700 transition-colors duration-150";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Commissions</h1>

      <div className="flex flex-wrap gap-3 items-end">
        <button onClick={() => setPreset("month")} className={presetCls}>Ce mois-ci</button>
        <button onClick={() => setPreset("lastMonth")} className={presetCls}>Mois dernier</button>
        <button onClick={() => setPreset("7d")} className={presetCls}>7 derniers jours</button>
        <label className="text-sm text-zinc-400">
          Du
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} block mt-1`} />
        </label>
        <label className="text-sm text-zinc-400">
          Au
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} block mt-1`} />
        </label>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500 border-b border-zinc-800">
              <th className="p-4 font-medium">Coiffeur</th>
              <th className="p-4 font-medium text-right">Ventes</th>
              <th className="p-4 font-medium text-right">CA</th>
              <th className="p-4 font-medium text-right">%</th>
              <th className="p-4 font-medium text-right">À reverser</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ barber, count, ca, pct, commission }) => (
              <tr key={barber.id} className="border-b border-zinc-800 last:border-0">
                <td className="p-4">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: barber.color }} />
                    {barber.display_name}
                  </span>
                </td>
                <td className="p-4 text-right text-zinc-400">{count}</td>
                <td className="p-4 text-right">{formatEUR(ca)}</td>
                <td className="p-4 text-right text-zinc-400">{pct} %</td>
                <td className="p-4 text-right font-semibold">{formatEUR(commission)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-zinc-950/50 font-semibold">
              <td className="p-4">Total</td>
              <td className="p-4" />
              <td className="p-4 text-right">{formatEUR(totalCA)}</td>
              <td className="p-4" />
              <td className="p-4 text-right">{formatEUR(totalCommission)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatEUR, type Barber, type BarberPrivate, type Sale } from "@/lib/types";
import { StatusDot } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/fields";

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
    const supabase = createClient("owner");
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

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Commissions</h1>

      <div className="flex flex-wrap gap-3 items-end">
        <Button onClick={() => setPreset("month")}>Ce mois-ci</Button>
        <Button onClick={() => setPreset("lastMonth")}>Mois dernier</Button>
        <Button onClick={() => setPreset("7d")}>7 derniers jours</Button>
        <Field label="Du">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Au">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm shadow-black/20">
        {rows.length === 0 ? (
          <EmptyState title="Aucune vente sur la période" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="p-4 font-medium">Coiffeur</th>
                <th className="p-4 font-medium text-right">Ventes</th>
                <th className="p-4 font-medium text-right">CA</th>
                <th className="p-4 font-medium text-right">%</th>
                <th className="p-4 font-medium text-right">À reverser</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ barber, count, ca, pct, commission }) => (
                <tr key={barber.id} className="border-b border-border last:border-0">
                  <td className="p-4">
                    <span className="flex items-center gap-2">
                      <StatusDot style={{ backgroundColor: barber.color }} />
                      {barber.display_name}
                    </span>
                  </td>
                  <td className="p-4 text-right text-muted">{count}</td>
                  <td className="p-4 text-right">{formatEUR(ca)}</td>
                  <td className="p-4 text-right text-muted">{pct} %</td>
                  <td className="p-4 text-right font-semibold text-gold-400">
                    {formatEUR(commission)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-background/50 font-semibold">
                <td className="p-4">Total</td>
                <td className="p-4" />
                <td className="p-4 text-right">{formatEUR(totalCA)}</td>
                <td className="p-4" />
                <td className="p-4 text-right text-gold-400">{formatEUR(totalCommission)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}

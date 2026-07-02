"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatEUR, PAYMENT_LABELS, type Barber, type PaymentMethod, type Sale, type SaleItem } from "@/lib/types";

type SaleWithItems = Sale & { sale_items: SaleItem[] };

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function HistoriquePage() {
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [from, setFrom] = useState(() => toDateInput(new Date()));
  const [to, setTo] = useState(() => toDateInput(new Date()));
  const [barberId, setBarberId] = useState("");
  const [method, setMethod] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const fromDate = new Date(from + "T00:00:00");
    const toDate = new Date(to + "T23:59:59.999");

    let query = supabase
      .from("sales")
      .select("*, sale_items(*)")
      .gte("created_at", fromDate.toISOString())
      .lte("created_at", toDate.toISOString())
      .order("created_at", { ascending: false })
      .limit(200);
    if (barberId) query = query.eq("barber_id", barberId);
    if (method) query = query.eq("payment_method", method);

    const { data } = await query;
    setSales((data as SaleWithItems[]) ?? []);
    setLoading(false);
  }, [from, to, barberId, method]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch async, setState après await (faux positif)
    void load();
  }, [load]);

  useEffect(() => {
    void createClient()
      .from("barbers")
      .select("*")
      .then(({ data }: { data: Barber[] | null }) => setBarbers(data ?? []));
  }, []);

  async function refund(sale: SaleWithItems) {
    if (!window.confirm(`Rembourser le ticket de ${formatEUR(Number(sale.total))} ?`)) return;
    const { error } = await createClient()
      .from("sales")
      .update({ status: "refunded" })
      .eq("id", sale.id);
    if (!error) void load();
  }

  const barberName = (id: string) =>
    barbers.find((b) => b.id === id)?.display_name ?? "?";

  const inputCls =
    "rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-indigo-500";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Historique</h1>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm text-zinc-400">
          Du
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} block mt-1`} />
        </label>
        <label className="text-sm text-zinc-400">
          Au
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} block mt-1`} />
        </label>
        <label className="text-sm text-zinc-400">
          Coiffeur
          <select value={barberId} onChange={(e) => setBarberId(e.target.value)} className={`${inputCls} block mt-1`}>
            <option value="">Tous</option>
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>{b.display_name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-zinc-400">
          Paiement
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={`${inputCls} block mt-1`}>
            <option value="">Tous</option>
            {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <p className="text-zinc-500">Chargement…</p>
      ) : sales.length === 0 ? (
        <p className="text-zinc-500">Aucun ticket sur cette période.</p>
      ) : (
        <div className="space-y-2">
          {sales.map((sale) => (
            <div
              key={sale.id}
              className={`bg-zinc-900 border border-zinc-800 rounded-xl p-4 ${
                sale.status === "refunded" ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">
                    {formatEUR(Number(sale.total))}
                    <span className="ml-2 text-sm font-normal text-zinc-400">
                      {PAYMENT_LABELS[sale.payment_method as PaymentMethod]} · {barberName(sale.barber_id)}
                    </span>
                    {sale.status === "refunded" && (
                      <span className="ml-2 text-xs text-red-400 border border-red-400/40 rounded px-1.5 py-0.5">
                        Remboursé
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {new Date(sale.created_at).toLocaleString("fr-FR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                    {" · "}
                    {sale.sale_items
                      .map((i) => (i.qty > 1 ? `${i.qty}× ` : "") + i.name_snapshot)
                      .join(", ")}
                  </p>
                </div>
                {sale.status === "completed" && (
                  <button
                    onClick={() => refund(sale)}
                    className="text-sm text-zinc-400 hover:text-red-400 transition-colors duration-150 shrink-0"
                  >
                    Rembourser
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

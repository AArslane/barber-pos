"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  formatEUR,
  PAYMENT_LABELS,
  type Barber,
  type PaymentMethod,
  type Sale,
  type SaleItem,
} from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/fields";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

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
  const [toRefund, setToRefund] = useState<SaleWithItems | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient("owner");
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

    const { data, error } = await query;
    if (error) toast.error("Impossible de charger l'historique.");
    setSales((data as SaleWithItems[]) ?? []);
    setLoading(false);
  }, [from, to, barberId, method, toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch async, setState après await (faux positif)
    void load();
  }, [load]);

  useEffect(() => {
    void createClient("owner")
      .from("barbers")
      .select("*")
      .then(({ data }: { data: Barber[] | null }) => setBarbers(data ?? []));
  }, []);

  async function confirmRefund() {
    if (!toRefund) return;
    const { error } = await createClient("owner")
      .from("sales")
      .update({ status: "refunded" })
      .eq("id", toRefund.id);
    setToRefund(null);
    if (!error) void load();
    else toast.error("Le remboursement a échoué.");
  }

  const barberName = (id: string) =>
    barbers.find((b) => b.id === id)?.display_name ?? "?";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Historique</h1>

      <div className="flex flex-wrap gap-3 items-end">
        <Field label="Du">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Au">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Coiffeur">
          <Select value={barberId} onChange={(e) => setBarberId(e.target.value)}>
            <option value="">Tous</option>
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.display_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Paiement">
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="">Tous</option>
            {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : sales.length === 0 ? (
        <EmptyState title="Aucun ticket sur cette période." />
      ) : (
        <div className="space-y-2">
          {sales.map((sale) => (
            <Card
              key={sale.id}
              inset
              className={`p-4 ${sale.status === "refunded" ? "opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">
                    {formatEUR(Number(sale.total))}
                    <span className="ml-2 text-sm font-normal text-muted">
                      {PAYMENT_LABELS[sale.payment_method as PaymentMethod]} ·{" "}
                      {barberName(sale.barber_id)}
                    </span>
                    {sale.status === "refunded" && (
                      <Badge tone="danger" className="ml-2">
                        Remboursé
                      </Badge>
                    )}
                  </p>
                  <p className="text-sm text-muted">
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
                  <Button
                    variant="ghost"
                    className="text-danger hover:text-danger shrink-0"
                    onClick={() => setToRefund(sale)}
                  >
                    Rembourser
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!toRefund}
        title="Rembourser ce ticket ?"
        message={
          toRefund
            ? `Rembourser le ticket de ${formatEUR(Number(toRefund.total))} ?`
            : undefined
        }
        confirmLabel="Rembourser"
        danger
        onConfirm={() => void confirmRefund()}
        onCancel={() => setToRefund(null)}
      />
    </div>
  );
}

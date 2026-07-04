"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { hash } from "bcryptjs";
import { createClient } from "@/lib/supabase/client";
import type { Barber, BarberPrivate } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/fields";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

export function EquipeTab({ shopId }: { shopId: string }) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [commissions, setCommissions] = useState<Record<string, number>>({});
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient("owner");
    const [barbersRes, privateRes] = await Promise.all([
      supabase.from("barbers").select("*").order("created_at"),
      supabase.from("barber_private").select("*"),
    ]);
    setBarbers((barbersRes.data as Barber[]) ?? []);
    setCommissions(
      Object.fromEntries(
        ((privateRes.data as BarberPrivate[]) ?? []).map((c) => [c.barber_id, Number(c.commission_pct)])
      )
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch async, setState après await (faux positif)
    void load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const supabase = createClient("owner");
    const { data } = await supabase
      .from("barbers")
      .insert({ shop_id: shopId, display_name: newName.trim() })
      .select("id")
      .single();
    if (data) {
      await supabase.from("barber_private").insert({ barber_id: data.id, shop_id: shopId });
    }
    setNewName("");
    void load();
  }

  async function saveBarber(b: Barber, changes: Partial<Barber>) {
    await createClient("owner").from("barbers").update(changes).eq("id", b.id);
    setBarbers((prev) => prev.map((x) => (x.id === b.id ? { ...x, ...changes } : x)));
  }

  async function savePin(b: Barber, pin: string) {
    const pin_hash = await hash(pin, 10);
    await saveBarber(b, { pin_hash });
  }

  async function saveCommission(barberId: string, pct: number) {
    await createClient("owner").from("barber_private").update({ commission_pct: pct }).eq("barber_id", barberId);
    setCommissions((prev) => ({ ...prev, [barberId]: pct }));
  }

  return (
    <Card className="space-y-4">
      <div className="space-y-3">
        {barbers.map((b) => (
          <BarberRow
            key={b.id}
            barber={b}
            commission={commissions[b.id] ?? 0}
            onSaveBarber={(changes) => saveBarber(b, changes)}
            onSavePin={(pin) => savePin(b, pin)}
            onSaveCommission={(pct) => saveCommission(b.id, pct)}
          />
        ))}
      </div>
      <form onSubmit={add} className="flex gap-3">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nom du nouveau coiffeur"
          className="max-w-xs flex-1"
        />
        <Button type="submit">+ Ajouter</Button>
      </form>
    </Card>
  );
}

// Ligne isolée avec état local (nom, couleur, PIN, commission) : la frappe ne dépend
// jamais du re-render de la liste parente.
const BarberRow = memo(function BarberRow({
  barber,
  commission,
  onSaveBarber,
  onSavePin,
  onSaveCommission,
}: {
  barber: Barber;
  commission: number;
  onSaveBarber: (changes: Partial<Barber>) => void;
  onSavePin: (pin: string) => void;
  onSaveCommission: (pct: number) => void;
}) {
  const [name, setName] = useState(barber.display_name);
  const [color, setColor] = useState(barber.color);
  const [pinDraft, setPinDraft] = useState("");
  const [commissionDraft, setCommissionDraft] = useState(String(commission));
  const toast = useToast();

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background/50 p-3",
        !barber.active && "opacity-50",
      )}
    >
      <input
        type="color"
        value={color}
        onChange={(e) => {
          setColor(e.target.value);
          onSaveBarber({ color: e.target.value });
          toast.success("Enregistré");
        }}
        className="h-11 w-11 cursor-pointer rounded-lg border border-border-strong bg-transparent"
        aria-label="Couleur du coiffeur"
      />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name.trim() && name !== barber.display_name) {
            onSaveBarber({ display_name: name.trim() });
            toast.success("Enregistré");
          }
        }}
        className="w-36"
        placeholder="Nom"
      />
      <label className="flex items-center gap-2 text-sm text-muted">
        PIN
        <Input
          value={pinDraft}
          onChange={(e) => setPinDraft(e.target.value)}
          onBlur={() => {
            if (/^\d{6}$/.test(pinDraft)) {
              onSavePin(pinDraft);
              setPinDraft("");
              toast.success("PIN mis à jour");
            }
          }}
          maxLength={6}
          inputMode="numeric"
          placeholder={barber.pin_hash ? "Réinitialiser" : "Définir"}
          className="w-32"
        />
      </label>
      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2 text-sm text-muted">
          Commission
          <Input
            type="number"
            min={0}
            max={100}
            value={commissionDraft}
            onChange={(e) => setCommissionDraft(e.target.value)}
            onBlur={() => {
              const pct = Number(commissionDraft);
              if (pct !== commission) {
                onSaveCommission(pct);
                toast.success("Enregistré");
              }
            }}
            className="w-20"
          />
          %
        </label>
        <p className="text-xs text-faint">
          Sur 100 € encaissés → {(100 * Number(commissionDraft || 0)) / 100} € reversés
        </p>
      </div>
      <div className="ml-auto">
        <Button
          variant="ghost"
          onClick={() => {
            onSaveBarber({ active: !barber.active });
            toast.success(barber.active ? "Coiffeur archivé" : "Coiffeur réactivé");
          }}
        >
          {barber.active ? "Archiver" : "Réactiver"}
        </Button>
      </div>
    </div>
  );
});

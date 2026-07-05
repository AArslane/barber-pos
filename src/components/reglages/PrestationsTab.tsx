"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Service } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/fields";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { ChevronDownIcon, ChevronUpIcon } from "@/components/icons";

export function PrestationsTab({ shopId }: { shopId: string }) {
  const [services, setServices] = useState<Service[]>([]);
  const [draft, setDraft] = useState({ name: "", price: "", category: "" });
  const [toDelete, setToDelete] = useState<Service | null>(null);

  const load = useCallback(async () => {
    const { data } = await createClient("owner")
      .from("services")
      .select("*")
      .eq("shop_id", shopId)
      .order("category")
      .order("sort_order");
    setServices((data as Service[]) ?? []);
  }, [shopId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch async, setState après await (faux positif)
    void load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim() || !draft.price) return;
    await createClient("owner").from("services").insert({
      shop_id: shopId,
      name: draft.name.trim(),
      price: Number(draft.price),
      category: draft.category.trim() || "Autre",
    });
    setDraft({ name: "", price: "", category: "" });
    void load();
  }

  async function duplicate(s: Service) {
    await createClient("owner").from("services").insert({
      shop_id: shopId,
      name: `${s.name} (copie)`,
      price: s.price,
      category: s.category,
      sort_order: s.sort_order,
    });
    void load();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    await createClient("owner").from("services").delete().eq("id", toDelete.id);
    setToDelete(null);
    void load();
  }

  async function save(s: Service, changes: Partial<Service>) {
    await createClient("owner")
      .from("services")
      .update(changes)
      .eq("id", s.id);
    setServices((prev) => prev.map((x) => (x.id === s.id ? { ...x, ...changes } : x)));
  }

  async function move(s: Service, direction: -1 | 1) {
    const siblings = services
      .filter((x) => x.category === s.category)
      .sort((a, b) => a.sort_order - b.sort_order);
    const idx = siblings.findIndex((x) => x.id === s.id);
    const swapWith = siblings[idx + direction];
    if (!swapWith) return;
    await Promise.all([
      save(s, { sort_order: swapWith.sort_order }),
      save(swapWith, { sort_order: s.sort_order }),
    ]);
  }

  const categories = [...new Set(services.map((s) => s.category))];

  return (
    <Card className="space-y-6">
      <p className="text-xs text-faint">Les tickets déjà encaissés ne changent pas.</p>
      {categories.map((cat) => (
        <div key={cat} className="space-y-3">
          <h3 className="text-sm uppercase tracking-wide text-faint">{cat}</h3>
          {services
            .filter((s) => s.category === cat)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((s) => (
              <ServiceRow
                key={s.id}
                service={s}
                onSave={(changes) => save(s, changes)}
                onMove={(dir) => move(s, dir)}
                onDuplicate={() => duplicate(s)}
                onDelete={() => setToDelete(s)}
              />
            ))}
        </div>
      ))}
      <form onSubmit={add} className="flex flex-wrap gap-3">
        <Input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Nouvelle prestation"
          className="w-44"
        />
        <Input
          type="number"
          min={0}
          step="0.5"
          value={draft.price}
          onChange={(e) => setDraft({ ...draft, price: e.target.value })}
          placeholder="Prix €"
          className="w-24"
        />
        <Input
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          placeholder="Catégorie"
          className="w-32"
        />
        <Button type="submit">+ Ajouter</Button>
      </form>
      <ConfirmDialog
        open={toDelete !== null}
        title={`Supprimer « ${toDelete?.name ?? ""} » ?`}
        message="Suppression définitive. Les tickets déjà encaissés ne changent pas."
        confirmLabel="Supprimer"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </Card>
  );
}

// Ligne isolée avec état local : la frappe ne dépend jamais du re-render de la liste
// parente (source du bug de perte de focus quand le champ était contrôlé par le parent).
const ServiceRow = memo(function ServiceRow({
  service,
  onSave,
  onMove,
  onDuplicate,
  onDelete,
}: {
  service: Service;
  onSave: (changes: Partial<Service>) => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(service.name);
  const [price, setPrice] = useState(String(service.price));
  const [category, setCategory] = useState(service.category);
  const toast = useToast();

  function commit(changes: Partial<Service>) {
    onSave(changes);
    toast.success("Enregistré");
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background/50 p-3",
        !service.active && "opacity-50",
      )}
    >
      <div className="flex flex-col">
        <button
          onClick={() => onMove(-1)}
          className="flex h-5 w-6 items-center justify-center text-muted hover:text-foreground"
          aria-label="Monter"
        >
          <ChevronUpIcon className="h-4 w-4" />
        </button>
        <button
          onClick={() => onMove(1)}
          className="flex h-5 w-6 items-center justify-center text-muted hover:text-foreground"
          aria-label="Descendre"
        >
          <ChevronDownIcon className="h-4 w-4" />
        </button>
      </div>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== service.name && commit({ name: name.trim() })}
        className="w-44"
        placeholder="Nom"
      />
      <label className="flex items-center gap-2 text-sm text-muted">
        Prix
        <Input
          type="number"
          min={0}
          step="0.5"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={() => Number(price) !== service.price && commit({ price: Number(price) })}
          className="w-24"
        />
        €
      </label>
      <Input
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        onBlur={() => category.trim() && category !== service.category && commit({ category: category.trim() })}
        className="w-32"
        placeholder="Catégorie"
      />
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" onClick={onDuplicate}>
          Dupliquer
        </Button>
        <Button variant="ghost" onClick={() => commit({ active: !service.active })}>
          {service.active ? "Désactiver" : "Activer"}
        </Button>
        <Button variant="ghost" className="text-danger hover:text-danger" onClick={onDelete}>
          Supprimer
        </Button>
      </div>
    </div>
  );
});

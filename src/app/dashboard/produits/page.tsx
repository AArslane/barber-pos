"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { STOCK_REASON_LABELS, type Product, type StockMovement } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/fields";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useActiveShopId } from "@/components/dashboard/ActiveShopContext";
import { cn } from "@/lib/cn";
import { PackageIcon } from "@/components/icons";
import { adjustStock } from "./actions";

export default function ProduitsPage() {
  const shopId = useActiveShopId();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({ name: "", price: "", stock: "" });
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [toAdjust, setToAdjust] = useState<Product | null>(null);
  const [history, setHistory] = useState<Product | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    const { data, error } = await createClient("owner")
      .from("products")
      .select("*")
      .eq("shop_id", shopId)
      .order("sort_order")
      .order("name");
    if (error) toast.error("Impossible de charger les produits.");
    setProducts((data as Product[]) ?? []);
    setLoading(false);
  }, [shopId, toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch async, setState après await (faux positif)
    void load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim() || !draft.price) return;
    const { error } = await createClient("owner").from("products").insert({
      shop_id: shopId,
      name: draft.name.trim(),
      price: Number(draft.price),
      stock: Number(draft.stock) || 0,
    });
    if (error) {
      toast.error("Ajout impossible — réessayez.");
      return;
    }
    setDraft({ name: "", price: "", stock: "" });
    toast.success("Produit ajouté");
    void load();
  }

  async function save(product: Product, changes: Partial<Product>) {
    const previous = products;
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, ...changes } : p)));
    const { error } = await createClient("owner")
      .from("products")
      .update(changes)
      .eq("id", product.id);
    if (error) {
      setProducts(previous);
      toast.error("Échec de l'enregistrement — réessayez.");
      return;
    }
    toast.success("Enregistré");
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const { error } = await createClient("owner").from("products").delete().eq("id", toDelete.id);
    setToDelete(null);
    if (error) {
      toast.error("Suppression impossible — réessayez.");
      return;
    }
    void load();
  }

  // Le stock ne s'édite jamais à la main : il passe par adjust_stock pour que
  // chaque écart laisse une trace dans stock_movements.
  async function applyAdjustment(product: Product, delta: number, reason: "restock" | "correction", note: string) {
    try {
      const stock = await adjustStock(product.id, delta, reason, note);
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, stock } : p)));
      setToAdjust(null);
      toast.success("Stock mis à jour");
    } catch {
      toast.error("Échec de la mise à jour du stock — réessayez.");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Produits</h1>
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Produits</h1>

      <Card className="space-y-4">
        <p className="text-xs text-faint">
          Le stock se met à jour tout seul à chaque vente encaissée. Les tickets déjà encaissés ne
          changent pas.
        </p>

        {products.length === 0 ? (
          <EmptyState
            icon={<PackageIcon className="h-8 w-8" />}
            title="Aucun produit"
            hint="Ajoutez vos cires, shampooings et accessoires pour les vendre depuis la caisse."
          />
        ) : (
          <div className="space-y-3">
            {products.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                onSave={(changes) => save(p, changes)}
                onAdjust={() => setToAdjust(p)}
                onHistory={() => setHistory(p)}
                onDelete={() => setToDelete(p)}
              />
            ))}
          </div>
        )}

        <form onSubmit={add} className="flex flex-wrap gap-3">
          <Input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Nouveau produit"
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
            type="number"
            min={0}
            step="1"
            value={draft.stock}
            onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
            placeholder="Stock"
            className="w-24"
          />
          <Button type="submit">+ Ajouter</Button>
        </form>
      </Card>

      <ConfirmDialog
        open={toDelete !== null}
        title={`Supprimer « ${toDelete?.name ?? ""} » ?`}
        message="Suppression définitive. Les tickets déjà encaissés ne changent pas."
        confirmLabel="Supprimer"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />

      {toAdjust && (
        <AdjustStockModal
          product={toAdjust}
          onApply={(delta, reason, note) => applyAdjustment(toAdjust, delta, reason, note)}
          onClose={() => setToAdjust(null)}
        />
      )}

      {history && <HistoryModal product={history} onClose={() => setHistory(null)} />}
    </div>
  );
}

function stockBadge(product: Product) {
  if (product.stock <= 0) return <Badge tone="danger">Rupture</Badge>;
  if (product.stock <= product.low_stock_threshold)
    return <Badge tone="gold">{product.stock} restant</Badge>;
  return <Badge tone="neutral">{product.stock} en stock</Badge>;
}

// Ligne isolée avec état local : la frappe ne dépend jamais du re-render de la
// liste parente (même raison que ServiceRow dans les Réglages).
const ProductRow = memo(function ProductRow({
  product,
  onSave,
  onAdjust,
  onHistory,
  onDelete,
}: {
  product: Product;
  onSave: (changes: Partial<Product>) => void;
  onAdjust: () => void;
  onHistory: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(product.price));
  const [threshold, setThreshold] = useState(String(product.low_stock_threshold));

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background/50 p-3",
        !product.active && "opacity-50",
      )}
    >
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== product.name && onSave({ name: name.trim() })}
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
          onBlur={() => Number(price) !== product.price && onSave({ price: Number(price) })}
          className="w-24"
        />
        €
      </label>
      <label className="flex items-center gap-2 text-sm text-muted">
        Alerte sous
        <Input
          type="number"
          min={0}
          step="1"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          onBlur={() =>
            Number(threshold) !== product.low_stock_threshold &&
            onSave({ low_stock_threshold: Number(threshold) })
          }
          className="w-20"
        />
      </label>
      {stockBadge(product)}
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" onClick={onAdjust}>
          Réappro
        </Button>
        <Button variant="ghost" onClick={onHistory}>
          Mouvements
        </Button>
        <Button variant="ghost" onClick={() => onSave({ active: !product.active })}>
          {product.active ? "Désactiver" : "Activer"}
        </Button>
        <Button variant="ghost" className="text-danger hover:text-danger" onClick={onDelete}>
          Supprimer
        </Button>
      </div>
    </div>
  );
});

function AdjustStockModal({
  product,
  onApply,
  onClose,
}: {
  product: Product;
  onApply: (delta: number, reason: "restock" | "correction", note: string) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"add" | "set">("add");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const parsed = Number(value);
  const delta = mode === "add" ? parsed : parsed - product.stock;
  const valid = value !== "" && Number.isFinite(parsed) && delta !== 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    onApply(delta, mode === "add" ? "restock" : "correction", note);
  }

  return (
    <Modal onClose={onClose}>
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{product.name}</h2>
            <p className="text-sm text-muted">Stock actuel : {product.stock}</p>
          </div>

          <div className="flex gap-2">
            <Button
              variant={mode === "add" ? "primary" : "secondary"}
              onClick={() => setMode("add")}
            >
              Ajouter au stock
            </Button>
            <Button
              variant={mode === "set" ? "primary" : "secondary"}
              onClick={() => setMode("set")}
            >
              Corriger le stock
            </Button>
          </div>

          <Field label={mode === "add" ? "Quantité reçue" : "Stock réel compté"}>
            <Input
              type="number"
              step="1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </Field>

          <Field label="Note (facultatif)">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={mode === "add" ? "Livraison fournisseur" : "Inventaire du mois"}
            />
          </Field>

          {valid && (
            <p className="text-sm text-muted">
              Nouveau stock : <span className="font-semibold text-foreground">{product.stock + delta}</span>
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button onClick={onClose}>Annuler</Button>
            <Button type="submit" variant="primary" disabled={!valid || busy}>
              Valider
            </Button>
          </div>
        </form>
      </Card>
    </Modal>
  );
}

function HistoryModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [movements, setMovements] = useState<StockMovement[] | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await createClient("owner")
        .from("stock_movements")
        .select("*")
        .eq("product_id", product.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setMovements((data as StockMovement[]) ?? []);
    })();
  }, [product.id]);

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg">
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Mouvements — {product.name}</h2>
        {movements === null ? (
          <Skeleton className="h-32 w-full" />
        ) : movements.length === 0 ? (
          <EmptyState title="Aucun mouvement" />
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {movements.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-background/50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{STOCK_REASON_LABELS[m.reason]}</p>
                  <p className="text-xs text-muted">
                    {new Date(m.created_at).toLocaleString("fr-FR")}
                    {m.note && ` · ${m.note}`}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 font-semibold",
                    m.delta > 0 ? "text-success" : "text-danger",
                  )}
                >
                  {m.delta > 0 ? `+${m.delta}` : m.delta}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={onClose}>Fermer</Button>
        </div>
      </Card>
    </Modal>
  );
}

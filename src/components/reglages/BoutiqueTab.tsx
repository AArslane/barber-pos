"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateShopIdentity } from "@/app/dashboard/reglages/actions";
import { createAdditionalShop, switchActiveShop } from "@/app/dashboard/shop-actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/fields";
import { useToast } from "@/components/ui/Toast";

export function BoutiqueTab({
  shopId,
  name,
  currency,
  onSaved,
}: {
  shopId: string;
  name: string;
  currency: string;
  onSaved: (name: string, currency: string) => void;
}) {
  const router = useRouter();
  const [draftName, setDraftName] = useState(name);
  const [draftCurrency, setDraftCurrency] = useState(currency);
  const [newShopName, setNewShopName] = useState("");
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  async function save() {
    if (!draftName.trim() || !draftCurrency.trim()) return;
    try {
      await updateShopIdentity(shopId, draftName.trim(), draftCurrency.trim());
      onSaved(draftName.trim(), draftCurrency.trim());
      toast.success("Enregistré");
    } catch {
      toast.error("Échec de l'enregistrement — réessayez.");
    }
  }

  async function createShop(e: React.FormEvent) {
    e.preventDefault();
    if (!newShopName.trim()) return;
    setCreating(true);
    try {
      const id = await createAdditionalShop(newShopName.trim(), "EUR");
      await switchActiveShop(id);
      setNewShopName("");
      toast.success("Boutique créée");
      router.refresh();
    } catch {
      toast.error("Échec de la création de la boutique.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="max-w-md space-y-4">
        <Field label="Nom de la boutique">
          <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} onBlur={save} />
        </Field>
        <Field label="Devise">
          <Input
            value={draftCurrency}
            onChange={(e) => setDraftCurrency(e.target.value)}
            onBlur={save}
            className="w-24"
          />
        </Field>
      </Card>

      <Card className="max-w-md space-y-3">
        <h3 className="text-sm uppercase tracking-wide text-faint">Nouvelle boutique</h3>
        <p className="text-xs text-faint">
          Un même compte propriétaire peut gérer plusieurs boutiques, sélectionnables en haut du
          dashboard.
        </p>
        <form onSubmit={createShop} className="flex gap-2">
          <Input
            value={newShopName}
            onChange={(e) => setNewShopName(e.target.value)}
            placeholder="Nom de la nouvelle boutique"
            className="flex-1"
          />
          <Button type="submit" disabled={creating}>
            {creating ? "Création…" : "Créer"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

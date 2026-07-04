"use client";

import { useState } from "react";
import { updateShopIdentity } from "@/app/dashboard/reglages/actions";
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
  const [draftName, setDraftName] = useState(name);
  const [draftCurrency, setDraftCurrency] = useState(currency);
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

  return (
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
  );
}

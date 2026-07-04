"use client";

import { useEffect, useState } from "react";
import { updateShopSettings } from "@/app/dashboard/reglages/actions";
import type { PaymentMethod, ShopSettings } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/fields";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

const METHODS: { key: PaymentMethod; defaultLabel: string; editable: boolean }[] = [
  { key: "cash", defaultLabel: "Espèces", editable: false },
  { key: "card", defaultLabel: "Carte", editable: false },
  { key: "other", defaultLabel: "Autre", editable: true },
];

export function PaiementsTab({
  shopId,
  settings,
  onSaved,
}: {
  shopId: string;
  settings: ShopSettings;
  onSaved: (s: ShopSettings) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const toast = useToast();

  // Resynchronise l'état local si le parent recharge les réglages (retour de navigation).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resync volontaire sur nouvelle prop
    setDraft(settings);
  }, [settings]);

  // Optimiste : l'UI bascule tout de suite, puis revert + erreur visible si l'écriture échoue.
  async function save(next: ShopSettings) {
    const previous = draft;
    setDraft(next);
    try {
      await updateShopSettings(shopId, next);
      onSaved(next);
      toast.success("Enregistré");
    } catch {
      setDraft(previous);
      toast.error("Échec de l'enregistrement — réessayez.");
    }
  }

  return (
    <Card className="space-y-4">
      <p className="text-xs text-faint">La caisse n&apos;affiche que les modes actifs.</p>
      <div className="space-y-3">
        {METHODS.map(({ key, editable }) => {
          const m = draft.payment_methods[key];
          return (
            <div
              key={key}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background/50 p-3",
                !m.enabled && "opacity-60",
              )}
            >
              <Toggle
                checked={m.enabled}
                label={m.label}
                onChange={(enabled) =>
                  save({
                    ...draft,
                    payment_methods: {
                      ...draft.payment_methods,
                      [key]: { ...m, enabled },
                    },
                  })
                }
              />
              {editable ? (
                <Input
                  value={m.label}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      payment_methods: {
                        ...draft.payment_methods,
                        [key]: { ...m, label: e.target.value },
                      },
                    })
                  }
                  onBlur={() => save(draft)}
                  className="w-44"
                  placeholder="Libellé (ex. Virement)"
                />
              ) : (
                <span className="font-medium">{m.label}</span>
              )}
              <span className={cn("ml-auto text-sm font-medium", m.enabled ? "text-success" : "text-faint")}>
                {m.enabled ? "Actif" : "Inactif"}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

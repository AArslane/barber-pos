"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateShopIdentity, updateShopSettings } from "@/app/dashboard/reglages/actions";
import { createAdditionalShop, switchActiveShop } from "@/app/dashboard/shop-actions";
import { WEEKDAYS, WEEKDAY_LABELS, type ShopSettings } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/fields";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";

export function BoutiqueTab({
  shopId,
  name,
  currency,
  slug,
  settings,
  onSaved,
  onSavedSettings,
}: {
  shopId: string;
  name: string;
  currency: string;
  slug: string;
  settings: ShopSettings;
  onSaved: (name: string, currency: string) => void;
  onSavedSettings: (s: ShopSettings) => void;
}) {
  const router = useRouter();
  const [draftName, setDraftName] = useState(name);
  const [draftCurrency, setDraftCurrency] = useState(currency);
  const [newShopName, setNewShopName] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(settings);
  const toast = useToast();

  // Resynchronise l'état local si le parent recharge les réglages (retour de navigation).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resync volontaire sur nouvelle prop
    setDraft(settings);
  }, [settings]);

  // Optimiste : l'UI bascule tout de suite, puis revert + erreur visible si l'écriture échoue.
  async function saveSettings(next: ShopSettings) {
    const previous = draft;
    setDraft(next);
    try {
      await updateShopSettings(shopId, next);
      onSavedSettings(next);
      toast.success("Enregistré");
    } catch {
      setDraft(previous);
      toast.error("Échec de l'enregistrement — réessayez.");
    }
  }

  const bookingUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/reserver/${slug}`;

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

      <Card className="max-w-xl space-y-4">
        <h3 className="text-sm uppercase tracking-wide text-faint">Réservation en ligne</h3>
        <Toggle
          checked={draft.booking.enabled}
          label="Page de réservation publique"
          onChange={(enabled) =>
            saveSettings({ ...draft, booking: { ...draft.booking, enabled } })
          }
        />
        {draft.booking.enabled && (
          <>
            <p className="text-xs text-faint break-all">
              Vos clients réservent sur{" "}
              <a href={bookingUrl} target="_blank" rel="noreferrer" className="text-gold-400 underline">
                {bookingUrl}
              </a>
              {" "}— intégrable sur votre site avec :{" "}
              <code className="text-foreground">{`<iframe src="${bookingUrl}?embed=1" style="width:100%;height:640px;border:0"></iframe>`}</code>
            </p>
            <div className="space-y-2">
              {WEEKDAYS.map((d) => {
                const hours = draft.booking.hours[d];
                return (
                  <div key={d} className="flex flex-wrap items-center gap-3">
                    <Toggle
                      checked={hours !== null}
                      label={WEEKDAY_LABELS[d]}
                      onChange={(open) =>
                        saveSettings({
                          ...draft,
                          booking: {
                            ...draft.booking,
                            hours: {
                              ...draft.booking.hours,
                              [d]: open ? { open: "09:00", close: "19:00" } : null,
                            },
                          },
                        })
                      }
                    />
                    {hours !== null && (
                      <span className="flex items-center gap-2 text-sm">
                        <Input
                          type="time"
                          value={hours.open}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              booking: {
                                ...draft.booking,
                                hours: { ...draft.booking.hours, [d]: { ...hours, open: e.target.value } },
                              },
                            })
                          }
                          onBlur={() => void saveSettings(draft)}
                          className="w-28"
                        />
                        →
                        <Input
                          type="time"
                          value={hours.close}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              booking: {
                                ...draft.booking,
                                hours: { ...draft.booking.hours, [d]: { ...hours, close: e.target.value } },
                              },
                            })
                          }
                          onBlur={() => void saveSettings(draft)}
                          className="w-28"
                        />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
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

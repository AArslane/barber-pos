"use client";

import { useEffect, useState } from "react";
import {
  updateShopSettings,
  listConnectedDevices,
  type ConnectedDevice,
} from "@/app/dashboard/reglages/actions";
import { generatePairingCode, disconnectDevice, type PairingCode } from "@/lib/pairing";
import { BRAND_NAME } from "@/lib/brand";
import type { ShopSettings } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/fields";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";

export function SecuriteTab({
  shopId,
  settings,
  onSaved,
}: {
  shopId: string;
  settings: ShopSettings;
  onSaved: (s: ShopSettings) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [pairing, setPairing] = useState<PairingCode | null>(null);
  const [generating, setGenerating] = useState(false);
  const [toDisconnect, setToDisconnect] = useState<ConnectedDevice | null>(null);
  const toast = useToast();

  // Resynchronise l'état local si le parent recharge les réglages (retour de navigation).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resync volontaire sur nouvelle prop
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    void listConnectedDevices(shopId).then(setDevices);
  }, [shopId]);

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

  async function generate() {
    setGenerating(true);
    try {
      setPairing(await generatePairingCode(shopId));
    } catch {
      toast.error("Échec de la génération du code.");
    } finally {
      setGenerating(false);
    }
  }

  async function confirmDisconnect() {
    if (!toDisconnect) return;
    const device = toDisconnect;
    setToDisconnect(null);
    try {
      await disconnectDevice(shopId, device.userId);
      setDevices((prev) => prev.filter((d) => d.userId !== device.userId));
      toast.success("Tablette déconnectée");
    } catch {
      toast.error("Échec de la déconnexion de la tablette.");
    }
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/50 p-3">
          <div>
            <p className="font-medium">Exiger un PIN par coiffeur</p>
            <p className="text-xs text-faint">
              Un coiffeur sans PIN peut encaisser sans saisir de code.
            </p>
          </div>
          <Toggle
            checked={draft.security.require_pin}
            label="Exiger un PIN par coiffeur"
            onChange={(require_pin) =>
              save({ ...draft, security: { ...draft.security, require_pin } })
            }
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/50 p-3">
          <div>
            <p className="font-medium">Durée de session admin sur tablette</p>
            <p className="text-xs text-faint">
              Déconnexion automatique de l&apos;espace propriétaire après inactivité.
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm text-muted">
            <Input
              type="number"
              min={1}
              max={120}
              value={draft.security.admin_session_minutes}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  security: { ...draft.security, admin_session_minutes: Number(e.target.value) },
                })
              }
              onBlur={() => save(draft)}
              className="w-20"
            />
            min
          </label>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm uppercase tracking-wide text-faint">Tablettes connectées</h3>
          <Button onClick={generate} disabled={generating}>
            {generating ? "Génération…" : "Connecter une tablette"}
          </Button>
        </div>
        {pairing && (
          <div className="space-y-1 rounded-xl border border-gold-400/40 bg-gold-500/5 p-3">
            <p className="text-sm text-muted">
              Sur la tablette : ouvrez {BRAND_NAME} et saisissez ce code — valable 10 minutes :
            </p>
            <p className="text-center font-mono text-3xl tracking-[0.3em] text-gold-400">
              {pairing.code}
            </p>
          </div>
        )}
        {devices.length === 0 && <p className="text-sm text-muted">Aucune tablette configurée.</p>}
        {devices.map((d) => (
          <div
            key={d.userId}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background/50 p-3"
          >
            <span className="font-mono text-sm text-foreground">{d.email}</span>
            <Button onClick={() => setToDisconnect(d)} className="ml-auto">
              Déconnecter
            </Button>
          </div>
        ))}
      </Card>

      <ConfirmDialog
        open={toDisconnect !== null}
        title="Déconnecter cette tablette ?"
        message="La caisse de cette tablette sera déconnectée définitivement. Pour la reconnecter, générez un nouveau code d'appairage."
        confirmLabel="Déconnecter"
        danger
        onConfirm={confirmDisconnect}
        onCancel={() => setToDisconnect(null)}
      />
    </div>
  );
}

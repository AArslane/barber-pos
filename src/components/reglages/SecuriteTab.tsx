"use client";

import { useEffect, useState } from "react";
import {
  updateShopSettings,
  listConnectedDevices,
  resetDeviceCredentials,
  type ConnectedDevice,
} from "@/app/dashboard/reglages/actions";
import type { ShopSettings } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
  const [newPassword, setNewPassword] = useState<{ email: string; password: string } | null>(null);
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

  async function reset(device: ConnectedDevice) {
    try {
      const { password } = await resetDeviceCredentials(device.userId);
      setNewPassword({ email: device.email, password });
    } catch {
      toast.error("Échec de la régénération des identifiants.");
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
        <h3 className="text-sm uppercase tracking-wide text-faint">Tablettes connectées</h3>
        {devices.length === 0 && <p className="text-sm text-muted">Aucune tablette configurée.</p>}
        {devices.map((d) => (
          <div
            key={d.userId}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background/50 p-3"
          >
            <span className="font-mono text-sm text-foreground">{d.email}</span>
            <Button onClick={() => reset(d)} className="ml-auto">
              Déconnecter
            </Button>
          </div>
        ))}
        {newPassword && (
          <div className="space-y-1 rounded-xl border border-gold-400/40 bg-gold-500/5 p-3">
            <p className="text-sm">
              Nouveaux identifiants pour <strong>{newPassword.email}</strong> — à ressaisir sur la
              tablette, affichés une seule fois :
            </p>
            <p className="font-mono text-lg text-gold-400">{newPassword.password}</p>
          </div>
        )}
      </Card>
    </div>
  );
}

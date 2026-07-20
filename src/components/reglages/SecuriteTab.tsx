"use client";

import { useEffect, useState } from "react";
import {
  updateShopSettings,
  listConnectedDevices,
  type ConnectedDevice,
} from "@/app/dashboard/reglages/actions";
import {
  generatePairingCode,
  getActivePairingCode,
  renameDevice,
  disconnectDevice,
  type PairingCode,
} from "@/lib/pairing";
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
  const [newLabel, setNewLabel] = useState("");
  const [toDisconnect, setToDisconnect] = useState<ConnectedDevice | null>(null);
  const toast = useToast();

  // Resynchronise l'état local si le parent recharge les réglages (retour de navigation).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resync volontaire sur nouvelle prop
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    void listConnectedDevices(shopId).then(setDevices);
    // Un code encore valide doit se réafficher : quitter la page ne le perd plus.
    void getActivePairingCode(shopId).then(setPairing);
  }, [shopId]);

  // Fait expirer l'affichage en même temps que le code en base.
  useEffect(() => {
    if (!pairing) return;
    const remaining = new Date(pairing.expiresAt).getTime() - Date.now();
    // max(0) : si le code a expiré entre la lecture et cet effet, on l'efface au
    // tick suivant plutôt que par un setState synchrone (cascade de rendus).
    const timer = setTimeout(() => setPairing(null), Math.max(remaining, 0));
    return () => clearTimeout(timer);
  }, [pairing]);

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

  async function generate(label: string) {
    setGenerating(true);
    try {
      setPairing(await generatePairingCode(shopId, label));
      setNewLabel("");
    } catch {
      toast.error("Échec de la génération du code.");
    } finally {
      setGenerating(false);
    }
  }

  async function rename(device: ConnectedDevice, label: string) {
    const previous = devices;
    setDevices((prev) =>
      prev.map((d) => (d.userId === device.userId ? { ...d, label: label.trim() || null } : d)),
    );
    try {
      await renameDevice(shopId, device.userId, label);
      toast.success("Enregistré");
    } catch {
      setDevices(previous);
      toast.error("Échec du renommage — réessayez.");
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
        <h3 className="text-sm uppercase tracking-wide text-faint">Tablettes connectées</h3>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void generate(newLabel);
          }}
          className="flex flex-wrap items-center gap-3"
        >
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Nom de la tablette (ex. iPad comptoir)"
            maxLength={40}
            className="w-64"
          />
          <Button type="submit" disabled={generating}>
            {generating ? "Génération…" : "Connecter une tablette"}
          </Button>
        </form>

        {pairing && <PairingCodeCard pairing={pairing} />}

        {devices.length === 0 && <p className="text-sm text-muted">Aucune tablette configurée.</p>}
        {devices.map((d) => (
          <DeviceRow
            key={d.userId}
            device={d}
            onRename={(label) => rename(d, label)}
            onNewCode={() => generate(d.label ?? "")}
            onDisconnect={() => setToDisconnect(d)}
          />
        ))}
      </Card>

      <ConfirmDialog
        open={toDisconnect !== null}
        title={`Déconnecter « ${toDisconnect?.label ?? toDisconnect?.email ?? ""} » ?`}
        message="La caisse de cette tablette sera déconnectée définitivement. Pour la reconnecter, générez un nouveau code d'appairage."
        confirmLabel="Déconnecter"
        danger
        onConfirm={confirmDisconnect}
        onCancel={() => setToDisconnect(null)}
      />
    </div>
  );
}

function remainingLabel(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expiré";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return minutes > 0 ? `${minutes} min ${seconds}s` : `${seconds}s`;
}

// Le compte à rebours rend visible la fenêtre restante : le code est délibérément
// éphémère, l'afficher sans échéance donnerait l'illusion d'un identifiant permanent.
function PairingCodeCard({ pairing }: { pairing: PairingCode }) {
  const [left, setLeft] = useState(() => remainingLabel(pairing.expiresAt));

  useEffect(() => {
    const timer = setInterval(() => setLeft(remainingLabel(pairing.expiresAt)), 1000);
    return () => clearInterval(timer);
  }, [pairing.expiresAt]);

  return (
    <div className="space-y-1 rounded-xl border border-gold-400/40 bg-gold-500/5 p-3">
      <p className="text-sm text-muted">
        {pairing.label ? `Pour « ${pairing.label} » : ` : ""}
        sur la tablette, ouvrez {BRAND_NAME} et saisissez ce code :
      </p>
      <p className="text-center font-mono text-3xl tracking-[0.3em] text-gold-400">
        {pairing.code}
      </p>
      <p className="text-center text-xs text-faint">Expire dans {left}</p>
    </div>
  );
}

function DeviceRow({
  device,
  onRename,
  onNewCode,
  onDisconnect,
}: {
  device: ConnectedDevice;
  onRename: (label: string) => void;
  onNewCode: () => void;
  onDisconnect: () => void;
}) {
  const [label, setLabel] = useState(device.label ?? "");

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background/50 p-3">
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => label !== (device.label ?? "") && onRename(label)}
        placeholder="Sans nom"
        maxLength={40}
        className="w-56"
      />
      <span className="font-mono text-xs text-faint">{device.email}</span>
      <div className="ml-auto flex items-center gap-1">
        <Button onClick={onNewCode}>Nouveau code</Button>
        <Button onClick={onDisconnect}>Déconnecter</Button>
      </div>
    </div>
  );
}

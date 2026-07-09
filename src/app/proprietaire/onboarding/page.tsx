"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  bootstrapShop,
  addBarber,
  seedServices,
  type ServiceTemplateItem,
} from "./actions";
import { generatePairingCode, type PairingCode } from "@/lib/pairing";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/fields";
import { cn } from "@/lib/cn";
import { CheckIcon } from "@/components/icons";

const TEMPLATE_SERVICES: ServiceTemplateItem[] = [
  { name: "Coupe homme", price: 18, category: "Coupe", sort_order: 1 },
  { name: "Coupe + barbe", price: 28, category: "Coupe", sort_order: 2 },
  { name: "Coupe enfant", price: 12, category: "Coupe", sort_order: 3 },
  { name: "Barbe", price: 12, category: "Barbe", sort_order: 1 },
  { name: "Contours", price: 8, category: "Barbe", sort_order: 2 },
  { name: "Soin visage", price: 15, category: "Soins", sort_order: 1 },
  { name: "Coloration", price: 25, category: "Soins", sort_order: 2 },
];

const BARBER_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899"];

type BarberDraft = { name: string; commission: string };

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [shopId, setShopId] = useState<string | null>(null);
  const [shopName, setShopName] = useState("");
  const [currency, setCurrency] = useState("EUR");

  const [barbers, setBarbers] = useState<BarberDraft[]>([{ name: "", commission: "" }]);

  const [servicesChoice, setServicesChoice] = useState<"template" | "empty">("template");

  const [pairing, setPairing] = useState<PairingCode | null>(null);

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Une erreur est survenue");
      }
    });
  }

  function submitShop(e: React.FormEvent) {
    e.preventDefault();
    if (!shopName.trim()) return;
    run(async () => {
      const id = await bootstrapShop(shopName.trim(), currency);
      setShopId(id);
      setStep(2);
    });
  }

  function submitTeam() {
    if (!shopId) return;
    run(async () => {
      for (const [i, b] of barbers.entries()) {
        if (!b.name.trim()) continue;
        const pct = b.commission ? Number(b.commission) : 0;
        await addBarber(shopId, b.name.trim(), BARBER_COLORS[i % BARBER_COLORS.length], pct);
      }
      setStep(3);
    });
  }

  function submitServices() {
    if (!shopId) return;
    run(async () => {
      if (servicesChoice === "template") {
        await seedServices(shopId, TEMPLATE_SERVICES);
      }
      setStep(4);
    });
  }

  function generateCode() {
    if (!shopId) return;
    run(async () => {
      const code = await generatePairingCode(shopId);
      setPairing(code);
      setStep(5);
    });
  }

  const steps = ["Ma boutique", "Mon équipe", "Mes prestations", "Ma tablette", "Récap"];

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <Card className="w-full max-w-lg space-y-6 p-8">
        <div className="space-y-4">
          <h1 className="font-display text-2xl tracking-widest text-center">
            BIENVENUE SUR BARBER <span className="text-gold-400">POS</span>
          </h1>
          <ol className="flex justify-between text-xs text-faint">
            {steps.map((label, i) => (
              <li
                key={label}
                className={cn(
                  "flex-1 text-center",
                  i + 1 === step && "text-gold-400 font-semibold",
                  i + 1 < step && "text-muted",
                )}
              >
                {label}
              </li>
            ))}
          </ol>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        {step === 1 && (
          <form onSubmit={submitShop} className="space-y-4">
            <p className="text-sm text-muted">Le nom et la devise de votre salon.</p>
            <Field label="Nom du salon">
              <Input
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Ex. MB 31"
                required
              />
            </Field>
            <Field label="Devise">
              <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="EUR">Euro (EUR)</option>
              </Select>
            </Field>
            <Button type="submit" variant="primary" size="lg" disabled={pending} className="w-full">
              {pending ? "Création…" : "Continuer"}
            </Button>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Ajoutez vos coiffeurs. Commission et PIN se règlent plus tard, depuis Réglages.
            </p>
            <div className="space-y-2">
              {barbers.map((b, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={b.name}
                    onChange={(e) =>
                      setBarbers((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x))
                      )
                    }
                    placeholder="Nom"
                    className="flex-1"
                  />
                  <Input
                    value={b.commission}
                    onChange={(e) =>
                      setBarbers((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, commission: e.target.value } : x))
                      )
                    }
                    placeholder="% commission"
                    type="number"
                    min={0}
                    max={100}
                    className="w-32"
                  />
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              onClick={() => setBarbers((prev) => [...prev, { name: "", commission: "" }])}
            >
              + Ajouter un coiffeur
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={submitTeam}
              disabled={pending}
              className="w-full"
            >
              {pending ? "Enregistrement…" : "Continuer"}
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted">Choisissez vos prestations de départ.</p>
            <div className="space-y-2">
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors duration-150",
                  servicesChoice === "template"
                    ? "border-gold-400/60 bg-gold-500/5"
                    : "border-border bg-background/50",
                )}
              >
                <input
                  type="radio"
                  className="accent-[var(--color-gold-500)]"
                  checked={servicesChoice === "template"}
                  onChange={() => setServicesChoice("template")}
                />
                <span>
                  <span className="block font-medium">Modèle barbershop classique</span>
                  <span className="block text-sm text-muted">
                    {TEMPLATE_SERVICES.length} prestations pré-remplies, modifiables ensuite
                  </span>
                </span>
              </label>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors duration-150",
                  servicesChoice === "empty"
                    ? "border-gold-400/60 bg-gold-500/5"
                    : "border-border bg-background/50",
                )}
              >
                <input
                  type="radio"
                  className="accent-[var(--color-gold-500)]"
                  checked={servicesChoice === "empty"}
                  onChange={() => setServicesChoice("empty")}
                />
                <span className="font-medium">Partir de zéro</span>
              </label>
            </div>
            <Button
              variant="primary"
              size="lg"
              onClick={submitServices}
              disabled={pending}
              className="w-full"
            >
              {pending ? "Enregistrement…" : "Continuer"}
            </Button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Générez un code d&apos;appairage pour connecter la tablette du salon : sur la
              tablette, ouvrez Barber POS et saisissez ce code. Valable 10 minutes,
              régénérable à tout moment depuis Réglages → Sécurité.
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={generateCode}
              disabled={pending}
              className="w-full"
            >
              {pending ? "Génération…" : "Générer le code d'appairage"}
            </Button>
            <Button variant="ghost" onClick={() => setStep(5)} disabled={pending} className="w-full">
              Plus tard
            </Button>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 py-2">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-strong">
                <CheckIcon className="h-7 w-7 text-white" />
              </span>
              <p className="font-semibold">Votre salon est prêt</p>
            </div>
            {pairing && (
              <Card inset className="space-y-2 border border-gold-400/40 p-4 text-sm">
                <p className="text-muted">
                  Code d&apos;appairage de la tablette — valable 10 minutes :
                </p>
                <p className="text-center font-mono text-3xl tracking-[0.3em] text-gold-400">
                  {pairing.code}
                </p>
                <p className="text-muted">
                  Sur la tablette : ouvrez Barber POS et saisissez ce code. Un nouveau code peut
                  être généré depuis Réglages → Sécurité.
                </p>
              </Card>
            )}
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => {
                track("onboarding_completed");
                router.replace("/dashboard");
                router.refresh();
              }}
            >
              Ouvrir l&apos;espace propriétaire
            </Button>
          </div>
        )}
      </Card>
    </main>
  );
}

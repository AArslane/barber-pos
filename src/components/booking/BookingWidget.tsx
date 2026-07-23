"use client";

import { useCallback, useEffect, useState } from "react";
import { formatEUR } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/fields";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { ArrowLeftIcon, CheckIcon } from "@/components/icons";

// Sous-ensemble sérialisable de PublicShop (la lib booking est server-only).
type WidgetShop = {
  name: string;
  slug: string;
  services: { id: string; name: string; price: number; duration_min: number; category: string; sort_order: number }[];
  barbers: { id: string; display_name: string; color: string }[];
};

type Step = "service" | "barber" | "slot" | "form" | "done";

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function BookingWidget({ shop }: { shop: WidgetShop }) {
  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [dateStr, setDateStr] = useState(() => toDateInputValue(new Date()));
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  // honeypot : jamais rempli par un humain (champ caché)
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const service = shop.services.find((s) => s.id === serviceId) ?? null;
  const barber = shop.barbers.find((b) => b.id === barberId) ?? null;

  const [maxDate] = useState(() => toDateInputValue(new Date(Date.now() + 60 * 24 * 3600_000)));
  const [minDate] = useState(() => toDateInputValue(new Date()));

  const loadSlots = useCallback(async () => {
    if (!serviceId) return;
    setSlots(null);
    setSlot(null);
    setError(null);
    try {
      const params = new URLSearchParams({ shop: shop.slug, service: serviceId, date: dateStr });
      if (barberId) params.set("barber", barberId);
      const res = await fetch(`/api/booking/slots?${params}`);
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { slots: string[] };
      setSlots(json.slots);
    } catch {
      setSlots([]);
      setError("Impossible de charger les créneaux. Réessayez.");
    }
  }, [shop.slug, serviceId, barberId, dateStr]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch async, setState après await (faux positif)
    if (step === "slot") void loadSlots();
  }, [step, loadSlots]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!service || !slot || name.trim() === "" || phone.trim() === "") return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: shop.slug,
          service: service.id,
          barber: barberId,
          date: dateStr,
          time: slot,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          website,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Réservation impossible. Réessayez.");
        if (res.status === 409) {
          setStep("slot");
          void loadSlots();
        }
        return;
      }
      setStep("done");
    } catch {
      setError("Réservation impossible. Vérifiez votre connexion.");
    } finally {
      setSubmitting(false);
    }
  }

  function back(to: Step) {
    setError(null);
    setStep(to);
  }

  const categories = [...new Set(shop.services.map((s) => s.category))];

  return (
    <Card className="space-y-5">
      {step === "service" && (
        <>
          <h2 className="font-semibold">Choisissez une prestation</h2>
          {shop.services.length === 0 ? (
            <p className="text-sm text-muted">Aucune prestation disponible.</p>
          ) : (
            categories.map((cat) => (
              <div key={cat} className="space-y-2">
                {categories.length > 1 && (
                  <h3 className="text-xs uppercase tracking-wide text-faint">{cat}</h3>
                )}
                {shop.services
                  .filter((s) => s.category === cat)
                  .map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setServiceId(s.id);
                        setStep(shop.barbers.length > 1 ? "barber" : "slot");
                      }}
                      className="w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-surface-2 border border-border hover:border-gold-500/60 transition-all duration-150 text-left"
                    >
                      <span>
                        <span className="block font-semibold">{s.name}</span>
                        <span className="text-sm text-muted">{s.duration_min} min</span>
                      </span>
                      <span className="font-semibold shrink-0">{formatEUR(s.price)}</span>
                    </button>
                  ))}
              </div>
            ))
          )}
        </>
      )}

      {step === "barber" && (
        <>
          <h2 className="font-semibold">Avec qui ?</h2>
          <div className="space-y-2">
            <button
              onClick={() => {
                setBarberId(null);
                setStep("slot");
              }}
              className="w-full p-4 rounded-xl bg-surface-2 border border-border hover:border-gold-500/60 transition-all duration-150 text-left font-semibold"
            >
              Sans préférence
            </button>
            {shop.barbers.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setBarberId(b.id);
                  setStep("slot");
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-surface-2 border border-border hover:border-gold-500/60 transition-all duration-150 text-left"
              >
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ backgroundColor: b.color }}
                >
                  {b.display_name.charAt(0).toUpperCase()}
                </span>
                <span className="font-semibold">{b.display_name}</span>
              </button>
            ))}
          </div>
          <BackLink onClick={() => back("service")} label="Prestation" />
        </>
      )}

      {step === "slot" && service && (
        <>
          <h2 className="font-semibold">
            {service.name}
            {barber ? ` · ${barber.display_name}` : ""}
          </h2>
          <Field label="Date">
            <Input
              type="date"
              value={dateStr}
              min={minDate}
              max={maxDate}
              onChange={(e) => e.target.value && setDateStr(e.target.value)}
            />
          </Field>
          {slots === null ? (
            <div className="grid grid-cols-4 gap-2">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted py-4 text-center">
              Aucun créneau disponible ce jour — essayez une autre date.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {slots.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSlot(s);
                    setStep("form");
                  }}
                  className={cn(
                    "min-h-11 rounded-lg border font-semibold text-sm transition-all duration-150",
                    "bg-surface-2 border-border hover:border-gold-500/60",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
          <BackLink
            onClick={() => back(shop.barbers.length > 1 ? "barber" : "service")}
            label={shop.barbers.length > 1 ? "Coiffeur" : "Prestation"}
          />
        </>
      )}

      {step === "form" && service && slot && (
        <form onSubmit={submit} className="space-y-4">
          <h2 className="font-semibold">Vos coordonnées</h2>
          <p className="text-sm text-muted">
            {service.name}
            {barber ? ` avec ${barber.display_name}` : ""} —{" "}
            {new Date(`${dateStr}T12:00:00`).toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}{" "}
            à {slot}
          </p>
          <Field label="Nom *">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
          </Field>
          <Field label="Téléphone *">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              maxLength={30}
              required
            />
          </Field>
          <Field label="E-mail (confirmation)">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
              placeholder="Optionnel"
            />
          </Field>
          {/* Honeypot anti-bots : caché aux humains, les bots le remplissent */}
          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={submitting || name.trim() === "" || phone.trim() === ""}
          >
            {submitting ? "Réservation…" : "Confirmer le rendez-vous"}
          </Button>
          <BackLink onClick={() => back("slot")} label="Créneaux" />
        </form>
      )}

      {step === "done" && service && slot && (
        <div className="text-center space-y-3 py-6">
          <span className="mx-auto w-16 h-16 rounded-full bg-success-strong flex items-center justify-center">
            <CheckIcon className="w-8 h-8 text-white" />
          </span>
          <h2 className="font-display text-2xl tracking-wide">Rendez-vous confirmé</h2>
          <p className="text-muted">
            {service.name} —{" "}
            {new Date(`${dateStr}T12:00:00`).toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}{" "}
            à {slot}
          </p>
          <p className="text-sm text-faint">À très vite chez {shop.name} !</p>
        </div>
      )}
    </Card>
  );
}

function BackLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors duration-150 min-h-11"
    >
      <ArrowLeftIcon className="w-4 h-4" />
      {label}
    </button>
  );
}

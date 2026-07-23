"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getDeviceId } from "@/lib/db";
import { BRAND_NAME } from "@/lib/brand";
import { recordSale, refreshCatalog, startSyncLoop } from "@/lib/sync";
import {
  formatEUR,
  withShopSettingsDefaults,
  type Barber,
  type PaymentMethod,
  type Product,
  type SalePayment,
  type Service,
} from "@/lib/types";
import { SyncBadge } from "@/components/caisse/SyncBadge";
import { PinModal } from "@/components/caisse/PinModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import {
  ArrowLeftIcon,
  BanknoteIcon,
  CalendarIcon,
  CheckIcon,
  CreditCardIcon,
  LockIcon,
  MinusIcon,
  ScissorsIcon,
  WalletIcon,
  XIcon,
} from "@/components/icons";
import { CAISSE_PREFILL_KEY, type CaissePrefill } from "@/components/agenda/AgendaDay";
import { createClient } from "@/lib/supabase/client";

// Un ticket mélange librement prestations et produits ; `kind` décide de la
// colonne remplie côté sale_items et de ce qui compte dans services_total.
type CartLine =
  | { kind: "service"; item: Service; qty: number }
  | { kind: "product"; item: Product; qty: number };
type Step = "barber" | "catalog" | "payment" | "done";
type CatalogTab = "services" | "products";

export default function CaissePage() {
  const barbers = useLiveQuery(() => db.barbers.toArray(), [], undefined);
  const services = useLiveQuery(() => db.services.toArray(), [], undefined);
  const products = useLiveQuery(() => db.products.toArray(), [], undefined);
  const settingsMeta = useLiveQuery(() => db.meta.get("shop_settings"), [], undefined);
  const paymentMethods = withShopSettingsDefaults(
    settingsMeta ? JSON.parse(settingsMeta.value) : null,
  ).payment_methods;

  const [step, setStep] = useState<Step>("barber");
  const [barber, setBarber] = useState<Barber | null>(null);
  const [pinTarget, setPinTarget] = useState<Barber | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [catalogTab, setCatalogTab] = useState<CatalogTab>("services");
  const [lastTotal, setLastTotal] = useState(0);
  // Éditeur de paiement mixte (null = choix classique d'un seul mode).
  // Montants saisis en texte, un champ par mode actif.
  const [split, setSplit] = useState<Partial<Record<PaymentMethod, string>> | null>(null);
  // RDV en cours d'encaissement (venu de l'agenda) : marqué "Honoré" après la vente.
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const prefillDone = useRef(false);

  useEffect(() => {
    startSyncLoop();
    void refreshCatalog();
  }, []);

  // Pré-remplissage depuis l'agenda : coiffeur sélectionné (PIN respecté) et
  // prestation au ticket. Appliqué une seule fois, quand le catalogue est prêt.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- synchronisation ponctuelle depuis sessionStorage (système externe) */
    if (prefillDone.current || !barbers || !services) return;
    const raw = sessionStorage.getItem(CAISSE_PREFILL_KEY);
    if (!raw) return;
    prefillDone.current = true;
    sessionStorage.removeItem(CAISSE_PREFILL_KEY);
    try {
      const prefill = JSON.parse(raw) as CaissePrefill;
      setAppointmentId(prefill.appointment_id);
      const svc = services.find((s) => s.id === prefill.service_id);
      if (svc) setCart([{ kind: "service", item: svc, qty: 1 }]);
      const b = barbers.find((x) => x.id === prefill.barber_id);
      if (b) {
        if (b.pin_hash) {
          setPinTarget(b);
        } else {
          setBarber(b);
          setStep("catalog");
        }
      }
    } catch {
      // prefill corrompu : on repart sur une caisse vierge
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [barbers, services]);

  const total = cart.reduce((sum, l) => sum + l.item.price * l.qty, 0);
  const servicesTotal = cart.reduce(
    (sum, l) => (l.kind === "service" ? sum + l.item.price * l.qty : sum),
    0,
  );

  function selectBarber(b: Barber) {
    if (b.pin_hash) {
      setPinTarget(b);
    } else {
      setBarber(b);
      setStep("catalog");
    }
  }

  function addLine(line: CartLine) {
    setCart((prev) => {
      const existing = prev.find((l) => l.kind === line.kind && l.item.id === line.item.id);
      if (existing) {
        return prev.map((l) =>
          l.kind === line.kind && l.item.id === line.item.id ? { ...l, qty: l.qty + 1 } : l,
        );
      }
      return [...prev, line];
    });
  }

  function removeLine(kind: CartLine["kind"], itemId: string) {
    setCart((prev) =>
      prev
        .map((l) => (l.kind === kind && l.item.id === itemId ? { ...l, qty: l.qty - 1 } : l))
        .filter((l) => l.qty > 0),
    );
  }

  async function confirmPayment(payments: SalePayment[]) {
    if (!barber || cart.length === 0 || payments.length === 0) return;
    const saleId = crypto.randomUUID();
    await recordSale({
      id: saleId,
      shop_id: barber.shop_id,
      barber_id: barber.id,
      payment_method: payments.length === 1 ? payments[0].method : "mixed",
      payments,
      total,
      services_total: servicesTotal,
      status: "completed",
      created_at: new Date().toISOString(),
      device_id: getDeviceId(),
      items: cart.map((l) => ({
        id: crypto.randomUUID(),
        sale_id: saleId,
        shop_id: barber.shop_id,
        item_type: l.kind,
        service_id: l.kind === "service" ? l.item.id : null,
        product_id: l.kind === "product" ? l.item.id : null,
        name_snapshot: l.item.name,
        price_snapshot: l.item.price,
        qty: l.qty,
      })),
    });
    // Vente issue d'un RDV : le RDV passe "Honoré". Best effort en ligne —
    // hors connexion, il reste "Réservé", sans bloquer l'encaissement.
    if (appointmentId) {
      const id = appointmentId;
      setAppointmentId(null);
      void createClient()
        .from("appointments")
        .update({ status: "done" })
        .eq("id", id)
        .then(() => {});
    }
    setLastTotal(total);
    setSplit(null);
    setStep("done");
    setTimeout(reset, 2000);
  }

  function reset() {
    setCart([]);
    setBarber(null);
    setCatalogTab("services");
    setSplit(null);
    setAppointmentId(null);
    setStep("barber");
  }

  // Paiement mixte : tout est calculé en centimes pour éviter les flottants.
  const enabledMethods = (Object.keys(paymentMethods) as PaymentMethod[]).filter(
    (m) => paymentMethods[m].enabled,
  );
  const parseCents = (s: string | undefined): number => {
    if (!s || s.trim() === "") return 0;
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
  };
  const totalCents = Math.round(total * 100);
  const splitCents = split
    ? enabledMethods.map((m) => ({ method: m, cents: parseCents(split[m]) }))
    : [];
  const splitSum = splitCents.reduce((sum, p) => sum + (Number.isNaN(p.cents) ? 0 : p.cents), 0);
  const splitRemainder = totalCents - splitSum;
  const splitValid =
    splitCents.every((p) => !Number.isNaN(p.cents)) &&
    splitRemainder === 0 &&
    splitCents.some((p) => p.cents > 0);

  function confirmSplit() {
    if (!splitValid) return;
    void confirmPayment(
      splitCents
        .filter((p) => p.cents > 0)
        .map((p) => ({ method: p.method, amount: p.cents / 100 })),
    );
  }

  const sortedServices = services
    ? [...services].sort((a, b) => a.sort_order - b.sort_order)
    : [];
  const categories = [...new Set(sortedServices.map((s) => s.category))];
  const sortedProducts = products
    ? [...products].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    : [];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 font-display text-sm tracking-widest">
            <ScissorsIcon className="w-4 h-4 text-gold-500" />
            {BRAND_NAME.toUpperCase()}
          </span>
          {barber && step !== "barber" && (
            <button
              onClick={reset}
              className="flex items-center gap-2 text-sm min-h-11 px-3 rounded-lg bg-surface-2 hover:bg-border-strong/30 transition-colors duration-150"
              aria-label={`Changer de coiffeur (actuellement ${barber.display_name})`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: barber.color }}
              />
              {barber.display_name}
              <XIcon className="w-3.5 h-3.5 text-muted" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <SyncBadge />
          <Link
            href="/caisse/agenda"
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors duration-150 min-h-11 px-2"
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            Agenda
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors duration-150 min-h-11 px-2"
          >
            <LockIcon className="w-3.5 h-3.5" />
            Espace propriétaire
          </Link>
        </div>
      </header>

      {step === "barber" && (
        <main className="flex-1 flex flex-col items-center justify-center gap-8 p-6 overflow-y-auto">
          <h1 className="font-display text-4xl tracking-wide">Qui encaisse ?</h1>
          {barbers === undefined ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40 w-36 rounded-2xl" />
              ))}
            </div>
          ) : barbers.length === 0 ? (
            <EmptyState title="Aucun coiffeur. Ajoutez-en depuis le dashboard → Réglages." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              {barbers.map((b) => (
                <button
                  key={b.id}
                  onClick={() => selectBarber(b)}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-surface border border-border hover:border-gold-500/60 hover:bg-surface-2/60 active:scale-[0.97] transition-all duration-150"
                >
                  <span
                    className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white"
                    style={{ backgroundColor: b.color }}
                  >
                    {b.display_name.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-semibold text-lg">{b.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </main>
      )}

      {step === "catalog" && (
        <main className="flex-1 flex min-h-0">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex gap-2 px-4 pt-4 shrink-0">
              {(
                [
                  { tab: "services", label: "Prestations" },
                  { tab: "products", label: "Produits" },
                ] as { tab: CatalogTab; label: string }[]
              ).map(({ tab, label }) => (
                <button
                  key={tab}
                  onClick={() => setCatalogTab(tab)}
                  className={cn(
                    "min-h-11 px-5 rounded-xl font-semibold transition-colors duration-150",
                    catalogTab === tab
                      ? "bg-gold-500 text-black"
                      : "bg-surface border border-border text-muted hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {catalogTab === "services" &&
                categories.map((cat) => (
                  <section key={cat}>
                    <h2 className="text-sm uppercase tracking-wide text-muted mb-2">
                      {cat}
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {sortedServices
                        .filter((s) => s.category === cat)
                        .map((s) => (
                          <button
                            key={s.id}
                            onClick={() => addLine({ kind: "service", item: s, qty: 1 })}
                            className="min-h-[72px] p-4 rounded-xl bg-surface border border-border hover:border-gold-500/60 hover:bg-surface-2/60 active:scale-[0.97] transition-all duration-150 text-left"
                          >
                            <span className="block font-semibold">{s.name}</span>
                            <span className="text-muted">{formatEUR(s.price)}</span>
                          </button>
                        ))}
                    </div>
                  </section>
                ))}

              {catalogTab === "products" &&
                (sortedProducts.length === 0 ? (
                  <EmptyState title="Aucun produit. Ajoutez-en depuis le dashboard → Produits." />
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {sortedProducts.map((p) => {
                      // Le stock affiché tient compte de ce qui est déjà au ticket.
                      const inCart =
                        cart.find((l) => l.kind === "product" && l.item.id === p.id)?.qty ?? 0;
                      const left = p.stock - inCart;
                      return (
                        <button
                          key={p.id}
                          // Volontairement jamais désactivé : une caisse n'empêche pas
                          // d'encaisser un produit physiquement présent mais mal compté.
                          onClick={() => addLine({ kind: "product", item: p, qty: 1 })}
                          className="min-h-[72px] p-4 rounded-xl bg-surface border border-border hover:border-gold-500/60 hover:bg-surface-2/60 active:scale-[0.97] transition-all duration-150 text-left"
                        >
                          <span className="block font-semibold">{p.name}</span>
                          <span className="flex items-center gap-2">
                            <span className="text-muted">{formatEUR(p.price)}</span>
                            {left <= 0 ? (
                              <Badge tone="danger">Rupture</Badge>
                            ) : left <= p.low_stock_threshold ? (
                              <Badge tone="gold">{left} restant</Badge>
                            ) : (
                              <span className="text-xs text-faint">{left} en stock</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
            </div>
          </div>
          <aside className="w-72 border-l border-border flex flex-col shrink-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <h2 className="text-sm uppercase tracking-wide text-muted">Ticket</h2>
              {cart.length === 0 && (
                <p className="text-muted text-sm">Sélectionnez une prestation ou un produit</p>
              )}
              {cart.map((l) => (
                <div
                  key={`${l.kind}-${l.item.id}`}
                  className="flex items-center justify-between gap-2 bg-surface rounded-lg px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{l.item.name}</p>
                    <p className="text-xs text-muted">
                      {l.qty} × {formatEUR(l.item.price)}
                      {l.kind === "product" && " · produit"}
                    </p>
                  </div>
                  <button
                    onClick={() => removeLine(l.kind, l.item.id)}
                    className="w-11 h-11 flex items-center justify-center rounded-lg bg-surface-2 hover:bg-border-strong/30 transition-colors duration-150 shrink-0"
                    aria-label={`Retirer ${l.item.name}`}
                  >
                    <MinusIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-border space-y-3">
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatEUR(total)}</span>
              </div>
              <Button
                variant="primary"
                size="xl"
                className="w-full"
                onClick={() => setStep("payment")}
                disabled={cart.length === 0}
              >
                Encaisser
              </Button>
            </div>
          </aside>
        </main>
      )}

      {step === "payment" && (
        <main className="flex-1 flex flex-col items-center justify-center gap-8 p-6">
          <p className="text-muted">Total à encaisser</p>
          <p className="font-display text-7xl tracking-wide">
            {formatEUR(total)}
          </p>
          {split === null ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
                {(
                  [
                    { method: "cash", icon: BanknoteIcon },
                    { method: "card", icon: CreditCardIcon },
                    { method: "other", icon: WalletIcon },
                  ] as { method: PaymentMethod; icon: typeof BanknoteIcon }[]
                )
                  .filter(({ method }) => paymentMethods[method].enabled)
                  .map(({ method, icon: PayIcon }) => (
                    <button
                      key={method}
                      onClick={() => confirmPayment([{ method, amount: total }])}
                      className="flex flex-col items-center gap-3 py-10 rounded-2xl bg-surface border border-border hover:border-gold-500/60 hover:bg-surface-2/60 active:scale-[0.97] transition-all duration-150 text-xl font-bold"
                    >
                      <PayIcon className="w-8 h-8 text-gold-400" />
                      {paymentMethods[method].label}
                    </button>
                  ))}
              </div>
              {enabledMethods.length >= 2 && (
                <button
                  onClick={() => setSplit({})}
                  className="flex items-center gap-2 min-h-11 px-4 rounded-xl bg-surface border border-border text-muted hover:text-foreground hover:border-gold-500/60 transition-all duration-150 font-semibold"
                >
                  <BanknoteIcon className="w-4 h-4 text-gold-400" />
                  <CreditCardIcon className="w-4 h-4 text-gold-400" />
                  Paiement mixte
                </button>
              )}
            </>
          ) : (
            <div className="w-full max-w-md space-y-3">
              {enabledMethods.map((m) => {
                const cents = parseCents(split[m]);
                return (
                  <div key={m} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 font-semibold">
                      {paymentMethods[m].label}
                    </span>
                    <input
                      inputMode="decimal"
                      placeholder="0"
                      value={split[m] ?? ""}
                      onChange={(e) => setSplit({ ...split, [m]: e.target.value })}
                      className={cn(
                        "flex-1 min-h-12 px-4 rounded-xl bg-surface border text-right text-lg font-semibold outline-none transition-colors duration-150",
                        Number.isNaN(cents)
                          ? "border-danger"
                          : "border-border focus:border-gold-500/60",
                      )}
                    />
                    <button
                      // Complète ce mode avec ce qui reste à payer.
                      onClick={() => {
                        const others = splitCents
                          .filter((p) => p.method !== m && !Number.isNaN(p.cents))
                          .reduce((sum, p) => sum + p.cents, 0);
                        const rest = Math.max(totalCents - others, 0);
                        setSplit({ ...split, [m]: (rest / 100).toString().replace(".", ",") });
                      }}
                      className="min-h-12 px-3 rounded-xl bg-surface-2 text-sm text-muted hover:text-foreground transition-colors duration-150 shrink-0"
                    >
                      Reste
                    </button>
                  </div>
                );
              })}
              <p
                className={cn(
                  "text-center text-sm",
                  splitRemainder === 0 ? "text-success" : "text-muted",
                )}
              >
                {splitRemainder === 0
                  ? "Compte bon ✓"
                  : splitRemainder > 0
                    ? `Reste à répartir : ${formatEUR(splitRemainder / 100)}`
                    : `Excédent : ${formatEUR(-splitRemainder / 100)}`}
              </p>
              <Button
                variant="primary"
                size="xl"
                className="w-full"
                disabled={!splitValid}
                onClick={confirmSplit}
              >
                Encaisser {formatEUR(total)}
              </Button>
              <button
                onClick={() => setSplit(null)}
                className="w-full flex items-center justify-center gap-2 min-h-11 text-muted hover:text-foreground transition-colors duration-150"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                Un seul mode de paiement
              </button>
            </div>
          )}
          <button
            onClick={() => {
              setSplit(null);
              setStep("catalog");
            }}
            className="flex items-center gap-2 min-h-11 px-3 text-muted hover:text-foreground transition-colors duration-150"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Retour au catalogue
          </button>
        </main>
      )}

      {step === "done" && (
        <main className="flex-1 flex flex-col items-center justify-center gap-4">
          <span className="w-20 h-20 rounded-full bg-success-strong flex items-center justify-center">
            <CheckIcon className="w-10 h-10 text-white" />
          </span>
          <p className="font-display text-4xl tracking-wide">
            {formatEUR(lastTotal)} encaissé
          </p>
        </main>
      )}

      {pinTarget && (
        <PinModal
          barber={pinTarget}
          onSuccess={() => {
            setBarber(pinTarget);
            setPinTarget(null);
            setStep("catalog");
          }}
          onCancel={() => setPinTarget(null)}
        />
      )}
    </div>
  );
}

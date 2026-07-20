"use client";

import { useEffect, useState } from "react";
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
  CheckIcon,
  CreditCardIcon,
  LockIcon,
  MinusIcon,
  ScissorsIcon,
  WalletIcon,
  XIcon,
} from "@/components/icons";

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

  useEffect(() => {
    startSyncLoop();
    void refreshCatalog();
  }, []);

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

  async function confirmPayment(method: PaymentMethod) {
    if (!barber || cart.length === 0) return;
    const saleId = crypto.randomUUID();
    await recordSale({
      id: saleId,
      shop_id: barber.shop_id,
      barber_id: barber.id,
      payment_method: method,
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
    setLastTotal(total);
    setStep("done");
    setTimeout(reset, 2000);
  }

  function reset() {
    setCart([]);
    setBarber(null);
    setCatalogTab("services");
    setStep("barber");
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
                  onClick={() => confirmPayment(method)}
                  className="flex flex-col items-center gap-3 py-10 rounded-2xl bg-surface border border-border hover:border-gold-500/60 hover:bg-surface-2/60 active:scale-[0.97] transition-all duration-150 text-xl font-bold"
                >
                  <PayIcon className="w-8 h-8 text-gold-400" />
                  {paymentMethods[method].label}
                </button>
              ))}
          </div>
          <button
            onClick={() => setStep("catalog")}
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

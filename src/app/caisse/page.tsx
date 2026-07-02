"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getDeviceId } from "@/lib/db";
import { recordSale, refreshCatalog, startSyncLoop } from "@/lib/sync";
import { seedPreviewData } from "@/lib/preview";
import { formatEUR, type Barber, type PaymentMethod, type Service, PAYMENT_LABELS } from "@/lib/types";
import { SyncBadge } from "@/components/caisse/SyncBadge";
import { PinModal } from "@/components/caisse/PinModal";
import {
  ArrowLeftIcon,
  BanknoteIcon,
  CheckIcon,
  CreditCardIcon,
  MinusIcon,
  ScissorsIcon,
  WalletIcon,
  XIcon,
} from "@/components/icons";

type CartLine = { service: Service; qty: number };
type Step = "barber" | "services" | "payment" | "done";

export default function CaissePage() {
  const barbers = useLiveQuery(() => db.barbers.toArray(), [], undefined);
  const services = useLiveQuery(() => db.services.toArray(), [], undefined);

  const [step, setStep] = useState<Step>("barber");
  const [barber, setBarber] = useState<Barber | null>(null);
  const [pinTarget, setPinTarget] = useState<Barber | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [lastTotal, setLastTotal] = useState(0);

  useEffect(() => {
    startSyncLoop();
    void seedPreviewData().then(() => refreshCatalog());
  }, []);

  const total = cart.reduce((sum, l) => sum + l.service.price * l.qty, 0);

  function selectBarber(b: Barber) {
    if (b.pin_hash) {
      setPinTarget(b);
    } else {
      setBarber(b);
      setStep("services");
    }
  }

  function addService(s: Service) {
    setCart((prev) => {
      const line = prev.find((l) => l.service.id === s.id);
      if (line) {
        return prev.map((l) =>
          l.service.id === s.id ? { ...l, qty: l.qty + 1 } : l
        );
      }
      return [...prev, { service: s, qty: 1 }];
    });
  }

  function removeService(serviceId: string) {
    setCart((prev) =>
      prev
        .map((l) =>
          l.service.id === serviceId ? { ...l, qty: l.qty - 1 } : l
        )
        .filter((l) => l.qty > 0)
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
      status: "completed",
      created_at: new Date().toISOString(),
      device_id: getDeviceId(),
      items: cart.map((l) => ({
        id: crypto.randomUUID(),
        sale_id: saleId,
        service_id: l.service.id,
        name_snapshot: l.service.name,
        price_snapshot: l.service.price,
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
    setStep("barber");
  }

  const sortedServices = services
    ? [...services].sort((a, b) => a.sort_order - b.sort_order)
    : [];
  const categories = [...new Set(sortedServices.map((s) => s.category))];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 font-bold text-sm">
            <ScissorsIcon className="w-4 h-4 text-indigo-400" />
            Barber POS
          </span>
          {barber && step !== "barber" && (
            <button
              onClick={reset}
              className="flex items-center gap-2 text-sm min-h-11 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors duration-150"
              aria-label={`Changer de coiffeur (actuellement ${barber.display_name})`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: barber.color }}
              />
              {barber.display_name}
              <XIcon className="w-3.5 h-3.5 text-zinc-400" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <SyncBadge />
          <Link
            href="/dashboard"
            className="text-xs text-zinc-400 hover:text-zinc-100 transition-colors duration-150 min-h-11 flex items-center px-2"
          >
            Dashboard
          </Link>
        </div>
      </header>

      {/* Étape 1 : sélection coiffeur */}
      {step === "barber" && (
        <main className="flex-1 flex flex-col items-center justify-center gap-8 p-6 overflow-y-auto">
          <h1 className="text-2xl font-bold">Qui encaisse ?</h1>
          {barbers === undefined || barbers.length === 0 ? (
            <p className="text-zinc-400 text-center">
              {barbers === undefined
                ? "Chargement…"
                : "Aucun coiffeur. Ajoutez-en depuis le dashboard → Réglages."}
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              {barbers.map((b) => (
                <button
                  key={b.id}
                  onClick={() => selectBarber(b)}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-indigo-500/60 hover:bg-zinc-800/60 active:scale-[0.97] transition-all duration-150"
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

      {/* Étape 2 : prestations + panier */}
      {step === "services" && (
        <main className="flex-1 flex min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {categories.map((cat) => (
              <section key={cat}>
                <h2 className="text-sm uppercase tracking-wide text-zinc-500 mb-2">
                  {cat}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {sortedServices
                    .filter((s) => s.category === cat)
                    .map((s) => (
                      <button
                        key={s.id}
                        onClick={() => addService(s)}
                        className="min-h-[72px] p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-indigo-500/60 hover:bg-zinc-800/60 active:scale-[0.97] transition-all duration-150 text-left"
                      >
                        <span className="block font-semibold">{s.name}</span>
                        <span className="text-zinc-400">{formatEUR(s.price)}</span>
                      </button>
                    ))}
                </div>
              </section>
            ))}
          </div>
          <aside className="w-72 border-l border-zinc-800 flex flex-col shrink-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <h2 className="text-sm uppercase tracking-wide text-zinc-500">Ticket</h2>
              {cart.length === 0 && (
                <p className="text-zinc-500 text-sm">Sélectionnez une prestation</p>
              )}
              {cart.map((l) => (
                <div
                  key={l.service.id}
                  className="flex items-center justify-between gap-2 bg-zinc-900 rounded-lg px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{l.service.name}</p>
                    <p className="text-xs text-zinc-400">
                      {l.qty} × {formatEUR(l.service.price)}
                    </p>
                  </div>
                  <button
                    onClick={() => removeService(l.service.id)}
                    className="w-11 h-11 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors duration-150 shrink-0"
                    aria-label={`Retirer ${l.service.name}`}
                  >
                    <MinusIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-zinc-800 space-y-3">
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatEUR(total)}</span>
              </div>
              <button
                onClick={() => setStep("payment")}
                disabled={cart.length === 0}
                className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 font-bold text-lg"
              >
                Encaisser
              </button>
            </div>
          </aside>
        </main>
      )}

      {/* Étape 3 : mode de paiement */}
      {step === "payment" && (
        <main className="flex-1 flex flex-col items-center justify-center gap-8 p-6">
          <p className="text-zinc-400">Total à encaisser</p>
          <p className="text-5xl font-bold">{formatEUR(total)}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
            {(
              [
                { method: "cash", icon: BanknoteIcon },
                { method: "card", icon: CreditCardIcon },
                { method: "other", icon: WalletIcon },
              ] as { method: PaymentMethod; icon: typeof BanknoteIcon }[]
            ).map(({ method, icon: PayIcon }) => (
              <button
                key={method}
                onClick={() => confirmPayment(method)}
                className="flex flex-col items-center gap-3 py-10 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-indigo-500/60 hover:bg-zinc-800/60 active:scale-[0.97] transition-all duration-150 text-xl font-bold"
              >
                <PayIcon className="w-8 h-8 text-indigo-400" />
                {PAYMENT_LABELS[method]}
              </button>
            ))}
          </div>
          <button
            onClick={() => setStep("services")}
            className="flex items-center gap-2 min-h-11 px-3 text-zinc-400 hover:text-zinc-100 transition-colors duration-150"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Retour aux prestations
          </button>
        </main>
      )}

      {/* Étape 4 : confirmation */}
      {step === "done" && (
        <main className="flex-1 flex flex-col items-center justify-center gap-4">
          <span className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center">
            <CheckIcon className="w-10 h-10 text-white" />
          </span>
          <p className="text-2xl font-bold">{formatEUR(lastTotal)} encaissé</p>
        </main>
      )}

      {pinTarget && (
        <PinModal
          barber={pinTarget}
          onSuccess={() => {
            setBarber(pinTarget);
            setPinTarget(null);
            setStep("services");
          }}
          onCancel={() => setPinTarget(null)}
        />
      )}
    </div>
  );
}

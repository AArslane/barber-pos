"use client";

import { useEffect, useState } from "react";
import { getShopSettings } from "./actions";
import type { ShopSettings } from "@/lib/types";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { EquipeTab } from "@/components/reglages/EquipeTab";
import { PrestationsTab } from "@/components/reglages/PrestationsTab";
import { PaiementsTab } from "@/components/reglages/PaiementsTab";
import { SecuriteTab } from "@/components/reglages/SecuriteTab";
import { BoutiqueTab } from "@/components/reglages/BoutiqueTab";

const TABS = ["Équipe", "Prestations", "Paiements", "Sécurité", "Boutique"] as const;
type Tab = (typeof TABS)[number];

export default function ReglagesPage() {
  const [shop, setShop] = useState<{ shopId: string; name: string; currency: string; settings: ShopSettings } | null>(null);
  const [tab, setTab] = useState<Tab>("Équipe");

  useEffect(() => {
    void getShopSettings().then(setShop);
  }, []);

  if (!shop) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">Réglages</h1>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Réglages</h1>
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors duration-150",
              tab === t
                ? "border-gold-500 text-foreground"
                : "border-transparent text-faint hover:text-muted",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Équipe" && <EquipeTab shopId={shop.shopId} />}
      {tab === "Prestations" && <PrestationsTab shopId={shop.shopId} />}
      {tab === "Paiements" && (
        <PaiementsTab shopId={shop.shopId} settings={shop.settings} onSaved={(s) => setShop({ ...shop, settings: s })} />
      )}
      {tab === "Sécurité" && (
        <SecuriteTab shopId={shop.shopId} settings={shop.settings} onSaved={(s) => setShop({ ...shop, settings: s })} />
      )}
      {tab === "Boutique" && (
        <BoutiqueTab
          shopId={shop.shopId}
          name={shop.name}
          currency={shop.currency}
          onSaved={(name, currency) => setShop({ ...shop, name, currency })}
        />
      )}
    </div>
  );
}

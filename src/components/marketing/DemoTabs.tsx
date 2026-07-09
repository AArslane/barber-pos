"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { MockCaisse } from "./mockups/MockCaisse";
import { MockCommissions } from "./mockups/MockCommissions";
import { MockDashboard } from "./mockups/MockDashboard";

// Emplacement des futurs GIFs démo (10s chacun) : en attendant, mockups statiques.
const tabs = [
  {
    id: "caisse",
    label: "Encaisser une coupe",
    caption: "Le coiffeur choisit son profil, tape la prestation, encaisse. 3 secondes.",
  },
  {
    id: "commissions",
    label: "Les commissions du mois",
    caption: "CA et commission de chaque coiffeur, calculés en continu. Zéro dispute.",
  },
  {
    id: "dashboard",
    label: "Le CA depuis ton canapé",
    caption: "Le dashboard se met à jour en direct, sur ton téléphone, où que tu sois.",
  },
] as const;

export function DemoTabs() {
  const [active, setActive] = useState<(typeof tabs)[number]["id"]>("caisse");
  const current = tabs.find((t) => t.id === active)!;

  return (
    <section className="px-4 sm:px-6 py-16 border-t border-border">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="font-display text-3xl sm:text-4xl tracking-wide">
          Vois-le en action
        </h2>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                t.id === active
                  ? "border-gold-400/60 bg-gold-500/15 text-gold-400"
                  : "border-border bg-surface text-muted hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="mt-8 mx-auto max-w-md">
          {active === "caisse" && <MockCaisse />}
          {active === "commissions" && <MockCommissions />}
          {active === "dashboard" && <MockDashboard />}
        </div>
        <p className="mt-4 text-sm text-muted">{current.caption}</p>
      </div>
    </section>
  );
}

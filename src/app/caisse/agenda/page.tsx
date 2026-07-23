"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { BRAND_NAME } from "@/lib/brand";
import { AgendaDay } from "@/components/agenda/AgendaDay";
import { SyncBadge } from "@/components/caisse/SyncBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ArrowLeftIcon, ScissorsIcon } from "@/components/icons";

// Agenda côté tablette : consultation et gestion des RDV du salon.
// Online-only par design — l'offline-first (Dexie) reste réservé aux ventes.
export default function CaisseAgendaPage() {
  const shopMeta = useLiveQuery(() => db.meta.get("shop_id"), [], undefined);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 font-display text-sm tracking-widest">
            <ScissorsIcon className="w-4 h-4 text-gold-500" />
            {BRAND_NAME.toUpperCase()}
          </span>
          <Link
            href="/caisse"
            className="flex items-center gap-2 text-sm min-h-11 px-3 rounded-lg bg-surface-2 hover:bg-border-strong/30 transition-colors duration-150"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Caisse
          </Link>
        </div>
        <SyncBadge />
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        {shopMeta === undefined ? (
          <Skeleton className="h-96 w-full rounded-2xl" />
        ) : shopMeta === null ? (
          <p className="text-muted text-center py-10">
            Boutique inconnue — ouvrez d&apos;abord la caisse pour synchroniser le catalogue.
          </p>
        ) : (
          <AgendaDay scope="caisse" shopId={shopMeta.value} />
        )}
      </main>
    </div>
  );
}

"use client";

import { useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function SyncBadge() {
  const pending = useLiveQuery(() => db.pending_sales.count(), [], 0);
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true
  );

  if (!online) {
    return (
      <span className="flex items-center gap-2 text-xs text-zinc-400">
        <span className="w-2 h-2 rounded-full bg-zinc-500" />
        Hors ligne{pending > 0 && ` · ${pending} en attente`}
      </span>
    );
  }
  if (pending > 0) {
    return (
      <span className="flex items-center gap-2 text-xs text-amber-400">
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        {pending} vente{pending > 1 ? "s" : ""} en attente
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2 text-xs text-emerald-400">
      <span className="w-2 h-2 rounded-full bg-emerald-400" />
      Synchronisé
    </span>
  );
}

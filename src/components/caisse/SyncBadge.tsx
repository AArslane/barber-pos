"use client";

import { useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Badge, StatusDot } from "@/components/ui/Badge";

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
    () => true,
  );

  if (!online) {
    return (
      <Badge tone="neutral">
        <StatusDot tone="neutral" />
        Hors ligne{pending > 0 && ` · ${pending} en attente`}
      </Badge>
    );
  }
  if (pending > 0) {
    return (
      <Badge tone="info">
        <StatusDot tone="info" />
        {pending} vente{pending > 1 ? "s" : ""} en attente
      </Badge>
    );
  }
  return (
    <Badge tone="success">
      <StatusDot tone="success" />
      Synchronisé
    </Badge>
  );
}

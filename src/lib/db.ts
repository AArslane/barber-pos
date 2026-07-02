import Dexie, { type EntityTable } from "dexie";
import type { Barber, Sale, SaleItem, Service } from "@/lib/types";

// Vente en attente de sync : la vente + ses lignes, en un seul enregistrement.
export type PendingSale = Sale & { items: SaleItem[] };

export const db = new Dexie("barber-pos") as Dexie & {
  barbers: EntityTable<Barber, "id">;
  services: EntityTable<Service, "id">;
  pending_sales: EntityTable<PendingSale, "id">;
  meta: EntityTable<{ key: string; value: string }, "key">;
};

db.version(1).stores({
  barbers: "id, shop_id",
  services: "id, shop_id",
  pending_sales: "id, created_at",
  meta: "key",
});

export function getDeviceId(): string {
  const KEY = "barber-pos-device-id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

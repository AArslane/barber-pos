import Dexie, { type EntityTable } from "dexie";
import type { Barber, Sale, SaleItem, Service } from "@/lib/types";

// Vente en attente de sync : la vente + ses lignes, en un seul enregistrement.
export type PendingSale = Sale & { items: SaleItem[] };

// Vente rejetée définitivement par le serveur (pas une erreur réseau) :
// mise de côté pour ne pas bloquer la file de sync, visible dans le badge.
export type RejectedSale = PendingSale & { rejected_reason: string; rejected_at: string };

export const db = new Dexie("barber-pos") as Dexie & {
  barbers: EntityTable<Barber, "id">;
  services: EntityTable<Service, "id">;
  pending_sales: EntityTable<PendingSale, "id">;
  rejected_sales: EntityTable<RejectedSale, "id">;
  meta: EntityTable<{ key: string; value: string }, "key">;
};

db.version(1).stores({
  barbers: "id, shop_id",
  services: "id, shop_id",
  pending_sales: "id, created_at",
  meta: "key",
});

db.version(2).stores({
  barbers: "id, shop_id",
  services: "id, shop_id",
  pending_sales: "id, created_at",
  rejected_sales: "id, created_at",
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

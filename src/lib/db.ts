import Dexie, { type EntityTable } from "dexie";
import type { Barber, Product, Sale, SaleItem, Service } from "@/lib/types";

// Vente en attente de sync : la vente + ses lignes, en un seul enregistrement.
export type PendingSale = Sale & { items: SaleItem[] };

// Vente rejetée définitivement par le serveur (pas une erreur réseau) :
// mise de côté pour ne pas bloquer la file de sync, visible dans le badge.
export type RejectedSale = PendingSale & { rejected_reason: string; rejected_at: string };

export const db = new Dexie("barber-pos") as Dexie & {
  barbers: EntityTable<Barber, "id">;
  services: EntityTable<Service, "id">;
  products: EntityTable<Product, "id">;
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

db.version(3).stores({
  barbers: "id, shop_id",
  services: "id, shop_id",
  products: "id, shop_id",
  pending_sales: "id, created_at",
  rejected_sales: "id, created_at",
  meta: "key",
});

// À appeler quand la tablette change d'identité (nouvel appairage) : le
// catalogue, les réglages et les ventes rejetées appartiennent à l'ancienne
// boutique. Les ventes en attente sont conservées : si elles viennent du même
// shop elles restent valides, sinon la garde de sync les écartera avec une
// raison claire.
export async function resetLocalCache(): Promise<void> {
  await db.transaction("rw", db.barbers, db.services, db.products, db.rejected_sales, db.meta, async () => {
    await db.barbers.clear();
    await db.services.clear();
    await db.products.clear();
    await db.rejected_sales.clear();
    await db.meta.clear();
  });
}

export function getDeviceId(): string {
  const KEY = "barber-pos-device-id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

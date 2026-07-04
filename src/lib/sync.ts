import { createClient } from "@/lib/supabase/client";
import { db, type PendingSale } from "@/lib/db";
import { withShopSettingsDefaults, type Barber, type Service } from "@/lib/types";

// Rafraîchit le catalogue local depuis Supabase (silencieux si offline).
export async function refreshCatalog(): Promise<void> {
  const supabase = createClient();
  const [barbersRes, servicesRes, shopRes] = await Promise.all([
    supabase
      .from("barbers")
      .select("id, shop_id, display_name, color, pin_hash, active")
      .eq("active", true),
    supabase.from("services").select("*").eq("active", true),
    supabase.from("shops").select("settings").single(),
  ]);
  if (barbersRes.error || servicesRes.error) return;

  await db.transaction("rw", db.barbers, db.services, db.meta, async () => {
    await db.barbers.clear();
    await db.barbers.bulkPut(barbersRes.data as Barber[]);
    await db.services.clear();
    await db.services.bulkPut(servicesRes.data as Service[]);
    const shopId = (barbersRes.data as Barber[])[0]?.shop_id;
    if (shopId) await db.meta.put({ key: "shop_id", value: shopId });
    if (!shopRes.error && shopRes.data) {
      await db.meta.put({
        key: "shop_settings",
        value: JSON.stringify(withShopSettingsDefaults(shopRes.data.settings)),
      });
    }
  });
}

// Pousse les ventes en attente. Upsert par UUID : rejouable sans doublon.
export async function syncPending(): Promise<number> {
  const pending = await db.pending_sales.orderBy("created_at").toArray();
  if (pending.length === 0) return 0;

  const supabase = createClient();
  let synced = 0;

  for (const sale of pending) {
    const { items, ...saleRow } = sale;
    const { error: saleError } = await supabase
      .from("sales")
      .upsert(saleRow, { onConflict: "id" });
    if (saleError) break; // offline ou erreur : on retentera

    const { error: itemsError } = await supabase
      .from("sale_items")
      .upsert(items, { onConflict: "id" });
    if (itemsError) break;

    await db.pending_sales.delete(sale.id);
    synced++;
  }
  return synced;
}

// Enregistre la vente localement puis tente la sync en arrière-plan.
export async function recordSale(sale: PendingSale): Promise<void> {
  await db.pending_sales.put(sale);
  void syncPending().catch(() => {});
}

let syncLoopStarted = false;

// À appeler une fois côté caisse : re-sync au retour du réseau + toutes les 30s.
export function startSyncLoop(): void {
  if (syncLoopStarted || typeof window === "undefined") return;
  syncLoopStarted = true;
  window.addEventListener("online", () => void syncPending().catch(() => {}));
  setInterval(() => {
    if (navigator.onLine) void syncPending().catch(() => {});
  }, 30_000);
}

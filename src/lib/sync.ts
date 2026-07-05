import { createClient } from "@/lib/supabase/client";
import { db, type PendingSale } from "@/lib/db";
import { withShopSettingsDefaults, type Barber, type Service } from "@/lib/types";

// Codes Postgres (via PostgREST) qui signalent un rejet définitif du serveur
// (contrainte violée, RLS refusée...) plutôt qu'un problème réseau : inutile
// de retenter indéfiniment, la vente est mise de côté dans `rejected_sales`.
const PERMANENT_ERROR_CODES = new Set([
  "23502", // not_null_violation
  "23503", // foreign_key_violation
  "23505", // unique_violation
  "23514", // check_violation
  "42501", // insufficient_privilege (RLS)
]);

function isPermanentRejection(error: { code?: string } | null): boolean {
  return !!error?.code && PERMANENT_ERROR_CODES.has(error.code);
}

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
// Une erreur réseau interrompt la boucle (on retentera au prochain passage) ;
// un rejet définitif du serveur ne bloque pas les ventes suivantes : la vente
// fautive est déplacée vers `rejected_sales`.
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
    if (saleError) {
      if (isPermanentRejection(saleError)) {
        await rejectSale(sale, saleError.message);
        continue;
      }
      break; // offline ou erreur réseau : on retentera
    }

    const { error: itemsError } = await supabase
      .from("sale_items")
      .upsert(items, { onConflict: "id" });
    if (itemsError) {
      if (isPermanentRejection(itemsError)) {
        await rejectSale(sale, itemsError.message);
        continue;
      }
      break;
    }

    await db.pending_sales.delete(sale.id);
    synced++;
  }
  return synced;
}

async function rejectSale(sale: PendingSale, reason: string): Promise<void> {
  await db.transaction("rw", db.pending_sales, db.rejected_sales, async () => {
    await db.rejected_sales.put({ ...sale, rejected_reason: reason, rejected_at: new Date().toISOString() });
    await db.pending_sales.delete(sale.id);
  });
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

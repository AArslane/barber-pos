import { createClient } from "@/lib/supabase/client";
import { db, type PendingSale } from "@/lib/db";
import { withShopSettingsDefaults, type Barber, type Product, type Service } from "@/lib/types";

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

// Dernière erreur de sync, persistée pour être affichée dans le badge caisse.
// Effacée dès qu'une passe de sync se termine sans erreur.
async function setSyncError(message: string | null): Promise<void> {
  if (message === null) {
    await db.meta.delete("last_sync_error");
  } else {
    console.error("[sync]", message);
    await db.meta.put({ key: "last_sync_error", value: message });
  }
}

// Rafraîchit le catalogue local depuis Supabase (silencieux si offline).
export async function refreshCatalog(): Promise<void> {
  const supabase = createClient();
  const [barbersRes, servicesRes, productsRes, shopRes] = await Promise.all([
    supabase
      .from("barbers")
      .select("id, shop_id, display_name, color, pin_hash, active")
      .eq("active", true),
    supabase.from("services").select("*").eq("active", true),
    supabase.from("products").select("*").eq("active", true),
    supabase.from("shops").select("settings").single(),
  ]);
  if (barbersRes.error || servicesRes.error || productsRes.error) return;

  await db.transaction("rw", db.barbers, db.services, db.products, db.meta, async () => {
    await db.barbers.clear();
    await db.barbers.bulkPut(barbersRes.data as Barber[]);
    await db.services.clear();
    await db.services.bulkPut(servicesRes.data as Service[]);
    // Le serveur fait autorité sur le stock : il écrase le décrément local optimiste.
    await db.products.clear();
    await db.products.bulkPut(productsRes.data as Product[]);
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

  // Sans session caisse, PostgREST refusera tout : inutile d'essayer, et
  // l'erreur serait cryptique. On la nomme clairement pour le badge.
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    await setSyncError("Caisse non connectée (session expirée ou tablette non appairée)");
    return 0;
  }

  let synced = 0;

  for (const sale of pending) {
    const { items, ...saleRow } = sale;
    // ignoreDuplicates (ON CONFLICT DO NOTHING) : rejouable sans doublon, et ne
    // requiert que la policy INSERT — le rôle device n'a pas de policy UPDATE.
    const { error: saleError } = await supabase
      .from("sales")
      .upsert(saleRow, { onConflict: "id", ignoreDuplicates: true });
    if (saleError) {
      if (isPermanentRejection(saleError)) {
        await rejectSale(sale, saleError.message);
        continue;
      }
      await setSyncError(`${saleError.code ?? "réseau"} : ${saleError.message}`);
      return synced; // offline ou erreur réseau : on retentera
    }

    const { error: itemsError } = await supabase
      .from("sale_items")
      .upsert(items, { onConflict: "id", ignoreDuplicates: true });
    if (itemsError) {
      if (isPermanentRejection(itemsError)) {
        await rejectSale(sale, itemsError.message);
        continue;
      }
      await setSyncError(`${itemsError.code ?? "réseau"} : ${itemsError.message}`);
      return synced;
    }

    await db.pending_sales.delete(sale.id);
    synced++;
  }
  await setSyncError(null);
  return synced;
}

async function rejectSale(sale: PendingSale, reason: string): Promise<void> {
  await db.transaction("rw", db.pending_sales, db.rejected_sales, async () => {
    await db.rejected_sales.put({ ...sale, rejected_reason: reason, rejected_at: new Date().toISOString() });
    await db.pending_sales.delete(sale.id);
  });
}

// Enregistre la vente localement puis tente la sync en arrière-plan.
// Le stock des produits vendus est décrémenté localement pour rester juste
// hors-ligne ; le serveur (trigger sale_items_apply_stock) reste l'autorité et
// le prochain refreshCatalog écrase la valeur locale.
export async function recordSale(sale: PendingSale): Promise<void> {
  const soldProducts = sale.items.filter((i) => i.item_type === "product" && i.product_id);

  await db.transaction("rw", db.pending_sales, db.products, async () => {
    await db.pending_sales.put(sale);
    for (const item of soldProducts) {
      const product = await db.products.get(item.product_id!);
      if (product) {
        await db.products.update(product.id, { stock: product.stock - item.qty });
      }
    }
  });

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

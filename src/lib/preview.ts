/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORAIRE — mode préview sans Supabase (NEXT_PUBLIC_PREVIEW=1).
// Contient : le seed Dexie de la caisse + un faux client Supabase en mémoire
// pour le dashboard (~120 ventes générées sur 30 jours, déterministes).
// À supprimer avec les flags dans proxy.ts, shop.ts, supabase/client.ts et .env.local.
import { db } from "@/lib/db";
import type { Barber, BarberPrivate, Sale, SaleItem, Service } from "@/lib/types";

export const PREVIEW_SHOP_ID = "11111111-1111-1111-1111-111111111111";

const DEMO_BARBERS: Barber[] = [
  { id: "b1000000-0000-0000-0000-000000000001", shop_id: PREVIEW_SHOP_ID, display_name: "Karim", color: "#ef4444", pin_hash: null, active: true },
  { id: "b1000000-0000-0000-0000-000000000002", shop_id: PREVIEW_SHOP_ID, display_name: "Sofiane", color: "#3b82f6", pin_hash: null, active: true },
  { id: "b1000000-0000-0000-0000-000000000003", shop_id: PREVIEW_SHOP_ID, display_name: "Mehdi", color: "#22c55e", pin_hash: null, active: true },
];

const DEMO_BARBER_PRIVATE: BarberPrivate[] = [
  { barber_id: "b1000000-0000-0000-0000-000000000001", shop_id: PREVIEW_SHOP_ID, commission_pct: 40 },
  { barber_id: "b1000000-0000-0000-0000-000000000002", shop_id: PREVIEW_SHOP_ID, commission_pct: 40 },
  { barber_id: "b1000000-0000-0000-0000-000000000003", shop_id: PREVIEW_SHOP_ID, commission_pct: 50 },
];

const DEMO_SERVICES: Service[] = [
  { id: "51000000-0000-0000-0000-000000000001", shop_id: PREVIEW_SHOP_ID, name: "Coupe homme", price: 18, category: "Coupe", sort_order: 1, active: true },
  { id: "51000000-0000-0000-0000-000000000002", shop_id: PREVIEW_SHOP_ID, name: "Coupe + barbe", price: 28, category: "Coupe", sort_order: 2, active: true },
  { id: "51000000-0000-0000-0000-000000000003", shop_id: PREVIEW_SHOP_ID, name: "Coupe enfant", price: 12, category: "Coupe", sort_order: 3, active: true },
  { id: "51000000-0000-0000-0000-000000000004", shop_id: PREVIEW_SHOP_ID, name: "Barbe", price: 12, category: "Barbe", sort_order: 1, active: true },
  { id: "51000000-0000-0000-0000-000000000005", shop_id: PREVIEW_SHOP_ID, name: "Contours", price: 8, category: "Barbe", sort_order: 2, active: true },
  { id: "51000000-0000-0000-0000-000000000006", shop_id: PREVIEW_SHOP_ID, name: "Soin visage", price: 15, category: "Soins", sort_order: 1, active: true },
  { id: "51000000-0000-0000-0000-000000000007", shop_id: PREVIEW_SHOP_ID, name: "Coloration", price: 25, category: "Soins", sort_order: 2, active: true },
];

export async function seedPreviewData(): Promise<void> {
  if (process.env.NEXT_PUBLIC_PREVIEW !== "1") return;
  if ((await db.barbers.count()) > 0) return;
  await db.barbers.bulkPut(DEMO_BARBERS);
  await db.services.bulkPut(DEMO_SERVICES);
}

// --- Ventes fictives déterministes (30 jours) -------------------------------

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MOCK_SALES: Sale[] = [];
const MOCK_ITEMS: SaleItem[] = [];

(function generateSales() {
  const rand = mulberry32(42);
  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const day = new Date();
    day.setDate(day.getDate() - daysAgo);
    if (day.getDay() === 0) continue; // fermé le dimanche
    const count = 2 + Math.floor(rand() * 6);
    for (let i = 0; i < count; i++) {
      const saleId = `mock-sale-${daysAgo}-${i}`;
      const barber = DEMO_BARBERS[Math.floor(rand() * DEMO_BARBERS.length)];
      const nItems = rand() < 0.3 ? 2 : 1;
      let total = 0;
      const picked = new Set<number>();
      for (let j = 0; j < nItems; j++) {
        let idx = Math.floor(rand() * DEMO_SERVICES.length);
        while (picked.has(idx)) idx = (idx + 1) % DEMO_SERVICES.length;
        picked.add(idx);
        const svc = DEMO_SERVICES[idx];
        total += svc.price;
        MOCK_ITEMS.push({
          id: `${saleId}-item-${j}`,
          sale_id: saleId,
          service_id: svc.id,
          name_snapshot: svc.name,
          price_snapshot: svc.price,
          qty: 1,
        });
      }
      const at = new Date(day);
      at.setHours(9 + Math.floor(rand() * 10), Math.floor(rand() * 60), 0, 0);
      const r = rand();
      MOCK_SALES.push({
        id: saleId,
        shop_id: PREVIEW_SHOP_ID,
        barber_id: barber.id,
        payment_method: r < 0.5 ? "card" : r < 0.9 ? "cash" : "other",
        total,
        status: rand() < 0.03 ? "refunded" : "completed",
        created_at: at.toISOString(),
        device_id: "preview",
      });
    }
  }
})();

// --- Faux client Supabase (surface utilisée par l'app uniquement) -----------

export function createPreviewClient(): any {
  const tables: Record<string, any[]> = {
    barbers: DEMO_BARBERS,
    barber_private: DEMO_BARBER_PRIVATE,
    services: DEMO_SERVICES,
    sales: MOCK_SALES,
    sale_items: MOCK_ITEMS,
    members: [{ user_id: "preview", shop_id: PREVIEW_SHOP_ID }],
  };

  function from(table: string) {
    const filters: ((r: any) => boolean)[] = [];
    const orders: { col: string; asc: boolean }[] = [];
    let limitN: number | undefined;
    let single = false;
    let withItems = false;
    let op: "select" | "update" | "insert" | "upsert" = "select";
    let values: any = null;

    function run() {
      const arr = tables[table] ?? [];
      if (op === "insert") {
        const defaults =
          table === "barbers"
            ? { color: "#6366f1", pin_hash: null, active: true }
            : table === "services"
              ? { sort_order: 0, active: true }
              : {};
        arr.push({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...defaults, ...values });
        return { data: null, error: null };
      }
      if (op === "upsert") {
        for (const v of Array.isArray(values) ? values : [values]) {
          const i = arr.findIndex((r) => r.id === v.id);
          if (i >= 0) arr[i] = { ...arr[i], ...v };
          else arr.push({ ...v });
        }
        return { data: null, error: null };
      }
      if (op === "update") {
        arr.filter((r) => filters.every((f) => f(r))).forEach((r) => Object.assign(r, values));
        return { data: null, error: null };
      }
      let rows = arr.filter((r) => filters.every((f) => f(r)));
      for (const o of [...orders].reverse()) {
        rows = [...rows].sort(
          (a, b) => (a[o.col] < b[o.col] ? -1 : a[o.col] > b[o.col] ? 1 : 0) * (o.asc ? 1 : -1)
        );
      }
      if (limitN !== undefined) rows = rows.slice(0, limitN);
      if (withItems && table === "sales") {
        rows = rows.map((s) => ({ ...s, sale_items: MOCK_ITEMS.filter((i) => i.sale_id === s.id) }));
      }
      if (single) return { data: rows[0] ?? null, error: rows[0] ? null : { message: "no rows" } };
      return { data: rows, error: null };
    }

    const api: any = {
      select(cols = "*") { withItems = cols.includes("sale_items"); return api; },
      eq(col: string, val: any) { filters.push((r) => r[col] === val); return api; },
      gte(col: string, val: any) { filters.push((r) => r[col] >= val); return api; },
      lte(col: string, val: any) { filters.push((r) => r[col] <= val); return api; },
      order(col: string, opts?: { ascending?: boolean }) { orders.push({ col, asc: opts?.ascending !== false }); return api; },
      limit(n: number) { limitN = n; return api; },
      single() { single = true; return api; },
      update(v: any) { op = "update"; values = v; return api; },
      insert(v: any) { op = "insert"; values = v; return api; },
      upsert(v: any) { op = "upsert"; values = v; return api; },
      then(resolve: (res: any) => void) { resolve(run()); },
    };
    return api;
  }

  return {
    from,
    channel: () => {
      const ch: any = { on: () => ch, subscribe: () => ch };
      return ch;
    },
    removeChannel: () => {},
    auth: {
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({ error: null }),
    },
  };
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  WEEKDAYS,
  withShopSettingsDefaults,
  type Appointment,
  type ShopSettings,
} from "@/lib/types";

// Réservation publique : tout le calcul de créneaux vit côté serveur (les
// visiteurs n'ont pas de compte, l'API ne renvoie que des heures libres —
// jamais les RDV existants ni les données clients).

export const BOOKING_STEP_MIN = 15;
// Préavis minimum avant réservation (même esprit que le réglage Cal.com du site MB).
export const BOOKING_LEAD_MIN = 120;
// Fenêtre de réservation ouverte : aujourd'hui + 60 jours.
export const BOOKING_MAX_DAYS = 60;
// v1 : fuseau unique — les salons cibles sont français. Par-shop en Phase 2.
const SHOP_TZ = "Europe/Paris";

export type PublicShop = {
  id: string;
  name: string;
  slug: string;
  settings: ShopSettings;
  services: { id: string; name: string; price: number; duration_min: number; category: string; sort_order: number }[];
  barbers: { id: string; display_name: string; color: string }[];
};

export async function getPublicShop(slug: string): Promise<PublicShop | null> {
  const admin = createAdminClient();
  const { data: shop } = await admin
    .from("shops")
    .select("id, name, slug, settings")
    .eq("slug", slug)
    .single();
  if (!shop) return null;

  const [servicesRes, barbersRes] = await Promise.all([
    admin
      .from("services")
      .select("id, name, price, duration_min, category, sort_order")
      .eq("shop_id", shop.id)
      .eq("active", true)
      .order("sort_order"),
    admin
      .from("barbers")
      .select("id, display_name, color")
      .eq("shop_id", shop.id)
      .eq("active", true),
  ]);

  return {
    id: shop.id,
    name: shop.name,
    slug: shop.slug,
    settings: withShopSettingsDefaults(shop.settings),
    services: servicesRes.data ?? [],
    barbers: barbersRes.data ?? [],
  };
}

// Décalage (ms) entre UTC et le fuseau du salon à un instant donné.
function tzOffsetMs(utcDate: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: SHOP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(utcDate)) parts[p.type] = p.value;
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUTC - utcDate.getTime();
}

// "2026-07-24" + "10:00" heure salon → instant UTC. Le serveur (Vercel) tourne
// en UTC : new Date("...T10:00") y serait faux d'une à deux heures.
export function shopTimeToUtc(dateStr: string, timeStr: string): Date {
  const guess = new Date(`${dateStr}T${timeStr}:00Z`);
  const refined = new Date(guess.getTime() - tzOffsetMs(guess));
  return new Date(guess.getTime() - tzOffsetMs(refined));
}

// Jour de semaine (clé settings) d'une date calendaire côté salon.
function weekdayOf(dateStr: string): (typeof WEEKDAYS)[number] {
  // Midi UTC : le jour calendaire est le même à Paris quelle que soit la saison.
  const idx = new Date(`${dateStr}T12:00:00Z`).getUTCDay(); // 0 = dimanche
  return WEEKDAYS[(idx + 6) % 7];
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export type SlotQuery = {
  shop: PublicShop;
  serviceDurationMin: number;
  // null = "sans préférence"
  barberId: string | null;
  dateStr: string; // YYYY-MM-DD côté salon
};

// Créneaux libres d'un jour, en "HH:MM" heure salon.
export async function computeFreeSlots({ shop, serviceDurationMin, barberId, dateStr }: SlotQuery): Promise<string[]> {
  const hours = shop.settings.booking.hours[weekdayOf(dateStr)];
  if (!hours || shop.barbers.length === 0) return [];

  const dayStartUtc = shopTimeToUtc(dateStr, "00:00");
  const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 3600_000);

  const admin = createAdminClient();
  const { data } = await admin
    .from("appointments")
    .select("barber_id, starts_at, ends_at, status")
    .eq("shop_id", shop.id)
    .in("status", ["booked", "done"])
    .lt("starts_at", dayEndUtc.toISOString())
    .gt("ends_at", dayStartUtc.toISOString());
  const appts = (data ?? []) as Pick<Appointment, "barber_id" | "starts_at" | "ends_at" | "status">[];

  const openUtc = shopTimeToUtc(dateStr, hours.open).getTime();
  const closeUtc = shopTimeToUtc(dateStr, hours.close).getTime();
  const notBefore = Date.now() + BOOKING_LEAD_MIN * 60_000;
  const durationMs = serviceDurationMin * 60_000;

  const slots: string[] = [];
  for (let t = openUtc; t + durationMs <= closeUtc; t += BOOKING_STEP_MIN * 60_000) {
    if (t < notBefore) continue;
    const slotEnd = t + durationMs;

    if (barberId !== null) {
      const busy = appts.some(
        (a) =>
          a.barber_id === barberId &&
          overlaps(t, slotEnd, new Date(a.starts_at).getTime(), new Date(a.ends_at).getTime()),
      );
      if (busy) continue;
    } else {
      // "Sans préférence" : il faut qu'il reste au moins un coiffeur libre après
      // avoir compté les résas non assignées qui chevauchent ce créneau.
      const freeBarbers = shop.barbers.filter(
        (b) =>
          !appts.some(
            (a) =>
              a.barber_id === b.id &&
              overlaps(t, slotEnd, new Date(a.starts_at).getTime(), new Date(a.ends_at).getTime()),
          ),
      ).length;
      const unassigned = appts.filter(
        (a) =>
          a.barber_id === null &&
          overlaps(t, slotEnd, new Date(a.starts_at).getTime(), new Date(a.ends_at).getTime()),
      ).length;
      if (freeBarbers - unassigned <= 0) continue;
    }

    // Ré-exprime le créneau en heure salon pour l'affichage.
    const local = new Date(t + tzOffsetMs(new Date(t)));
    slots.push(
      `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`,
    );
  }
  return slots;
}

export function isValidDateStr(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const max = new Date(today.getTime() + BOOKING_MAX_DAYS * 24 * 3600_000);
  return d.getTime() >= today.getTime() - 24 * 3600_000 && d.getTime() <= max.getTime() + 24 * 3600_000;
}

export function isValidTimeStr(s: string): boolean {
  return /^\d{2}:\d{2}$/.test(s);
}

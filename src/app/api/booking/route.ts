import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeFreeSlots,
  getPublicShop,
  isValidDateStr,
  isValidTimeStr,
  shopTimeToUtc,
} from "@/lib/booking";

type BookingPayload = {
  shop?: string;
  service?: string;
  barber?: string | null;
  date?: string;
  time?: string;
  name?: string;
  phone?: string;
  email?: string;
  // honeypot : rempli par les bots, jamais par le widget
  website?: string;
};

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  let payload: BookingPayload;
  try {
    payload = (await request.json()) as BookingPayload;
  } catch {
    return bad("Requête invalide.");
  }

  // Honeypot : on répond comme un succès pour ne rien apprendre au bot.
  if (payload.website) return NextResponse.json({ ok: true });

  const name = (payload.name ?? "").trim().slice(0, 120);
  const phone = (payload.phone ?? "").trim().slice(0, 30);
  const email = (payload.email ?? "").trim().slice(0, 254);
  const dateStr = payload.date ?? "";
  const timeStr = payload.time ?? "";

  if (!name || !isValidDateStr(dateStr) || !isValidTimeStr(timeStr)) {
    return bad("Nom, date et heure sont obligatoires.");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return bad("Adresse e-mail invalide.");
  }

  const shop = await getPublicShop(payload.shop ?? "");
  if (!shop || !shop.settings.booking.enabled) return bad("Réservation indisponible.", 404);

  const service = shop.services.find((s) => s.id === payload.service);
  if (!service) return bad("Prestation inconnue.", 404);

  const barberId = payload.barber ? payload.barber : null;
  if (barberId && !shop.barbers.some((b) => b.id === barberId)) {
    return bad("Coiffeur inconnu.", 404);
  }

  // Le créneau doit être réellement libre au moment de l'insert : on recalcule
  // côté serveur (jamais confiance au client) — fenêtre de course résiduelle
  // minime, l'agenda du salon reste juge de paix.
  const slots = await computeFreeSlots({
    shop,
    serviceDurationMin: service.duration_min,
    barberId,
    dateStr,
  });
  if (!slots.includes(timeStr)) {
    return bad("Ce créneau vient d'être pris — choisissez-en un autre.", 409);
  }

  const starts = shopTimeToUtc(dateStr, timeStr);
  const ends = new Date(starts.getTime() + service.duration_min * 60_000);

  const admin = createAdminClient();
  const { error } = await admin.from("appointments").insert({
    shop_id: shop.id,
    barber_id: barberId,
    service_id: service.id,
    client_name: name,
    client_phone: phone === "" ? null : phone,
    client_email: email === "" ? null : email,
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    source: "web",
  });
  if (error) return bad("Réservation impossible pour le moment. Réessayez.", 500);

  if (email && process.env.RESEND_API_KEY) {
    void sendConfirmationEmail({
      to: email,
      clientName: name,
      shopName: shop.name,
      serviceName: service.name,
      dateStr,
      timeStr,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}

// Confirmation client via Resend — best effort : un échec d'email n'annule
// jamais la réservation (elle est déjà dans l'agenda du salon).
async function sendConfirmationEmail(params: {
  to: string;
  clientName: string;
  shopName: string;
  serviceName: string;
  dateStr: string;
  timeStr: string;
}) {
  const dateLabel = new Date(`${params.dateStr}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  });
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${params.shopName} <no-reply@send.salonflow.fr>`,
      to: [params.to],
      subject: `Rendez-vous confirmé — ${params.shopName}`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">
  <h2 style="margin:0 0 8px;font-size:20px;">Rendez-vous confirmé</h2>
  <p style="font-size:15px;line-height:1.6;">Bonjour ${escapeHtml(params.clientName)},</p>
  <p style="font-size:15px;line-height:1.6;">Votre rendez-vous chez <strong>${escapeHtml(params.shopName)}</strong> est confirmé :</p>
  <p style="font-size:16px;line-height:1.8;background:#f6f6f6;border-radius:8px;padding:16px;">
    ${escapeHtml(params.serviceName)}<br>
    <strong style="text-transform:capitalize;">${dateLabel}</strong> à <strong>${params.timeStr}</strong>
  </p>
  <p style="font-size:13px;color:#666;line-height:1.5;">Un empêchement ? Appelez le salon pour annuler ou déplacer votre rendez-vous.</p>
</div>`,
    }),
  });
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

import { NextResponse, type NextRequest } from "next/server";
import { computeFreeSlots, getPublicShop, isValidDateStr } from "@/lib/booking";

// Créneaux libres pour un salon / une prestation / un jour. Public (les
// visiteurs n'ont pas de compte) : ne renvoie que des heures, jamais les RDV.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const slug = params.get("shop") ?? "";
  const serviceId = params.get("service") ?? "";
  const barber = params.get("barber"); // null ou "" = sans préférence
  const dateStr = params.get("date") ?? "";

  if (!slug || !serviceId || !isValidDateStr(dateStr)) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const shop = await getPublicShop(slug);
  if (!shop || !shop.settings.booking.enabled) {
    return NextResponse.json({ error: "Réservation indisponible." }, { status: 404 });
  }

  const service = shop.services.find((s) => s.id === serviceId);
  if (!service) {
    return NextResponse.json({ error: "Prestation inconnue." }, { status: 404 });
  }

  const barberId = barber ? (shop.barbers.some((b) => b.id === barber) ? barber : null) : null;
  if (barber && barberId === null) {
    return NextResponse.json({ error: "Coiffeur inconnu." }, { status: 404 });
  }

  const slots = await computeFreeSlots({
    shop,
    serviceDurationMin: service.duration_min,
    barberId,
    dateStr,
  });
  return NextResponse.json({ slots });
}

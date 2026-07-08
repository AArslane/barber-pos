import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getShop } from "@/lib/shop";
import { getSubscription } from "@/lib/subscription";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

// Ouvre le portail client Stripe (gérer/annuler l'abonnement) pour la
// boutique active du owner connecté.
export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe n'est pas configuré." }, { status: 503 });
  }

  const supabase = await createClient("owner");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.app_metadata.role === "device") {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const shop = await getShop();
  if (!shop) {
    return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
  }

  const sub = await getSubscription(shop.id);
  if (!sub?.stripeCustomerId) {
    return NextResponse.json({ error: "Aucun abonnement Stripe pour cette boutique." }, { status: 404 });
  }

  const stripe = getStripe();
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${request.nextUrl.origin}/dashboard/reglages`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    // Erreur Stripe (portail non configuré, customer supprimé…) : loggée
    // côté serveur, le client reçoit un JSON au lieu d'un 500 vide.
    console.error("Stripe portal:", e);
    return NextResponse.json(
      { error: "Impossible d'ouvrir le portail de facturation." },
      { status: 502 }
    );
  }
}

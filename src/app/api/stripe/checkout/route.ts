import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getShop } from "@/lib/shop";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

// Crée une session Stripe Checkout (mode subscription) pour la boutique active
// du owner connecté. Server-only : jamais appelé depuis la caisse.
export async function POST(request: NextRequest) {
  if (!isStripeConfigured() || !process.env.STRIPE_PRICE_ID) {
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

  const origin = request.nextUrl.origin;

  const stripe = getStripe();
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: shop.id,
      subscription_data: { metadata: { shop_id: shop.id } },
      success_url: `${origin}/dashboard/reglages?abonnement=succes`,
      cancel_url: `${origin}/dashboard/reglages?abonnement=annule`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    // Erreur Stripe (prix invalide, compte non activé…) : le message est loggé
    // côté serveur, le client reçoit un JSON générique au lieu d'un 500 vide.
    console.error("Stripe checkout:", e);
    return NextResponse.json(
      { error: "Impossible de créer la session de paiement." },
      { status: 502 }
    );
  }
}

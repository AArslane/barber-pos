import "server-only";
import Stripe from "stripe";

// Mode sans Stripe : si STRIPE_SECRET_KEY est absent, tout le gating abonnement
// est désactivé (les shops existants continuent de fonctionner normalement).
export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe n'est pas configuré (STRIPE_SECRET_KEY manquant).");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

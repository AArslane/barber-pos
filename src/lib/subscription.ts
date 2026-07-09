import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isStripeConfigured } from "@/lib/stripe";

export type SubscriptionStatus = {
  status: string;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
};

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export async function getSubscription(shopId: string): Promise<SubscriptionStatus | null> {
  const supabase = await createClient("owner");
  const { data } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, stripe_customer_id")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (!data) return null;
  return {
    status: data.status,
    currentPeriodEnd: data.current_period_end,
    stripeCustomerId: data.stripe_customer_id,
  };
}

export function isSubscriptionActive(sub: SubscriptionStatus | null): boolean {
  return sub !== null && ACTIVE_STATUSES.has(sub.status);
}

// Jours restants d'essai, arrondis au supérieur (2h restantes = "1 jour").
// null si aucun essai posé, 0 si échu.
export function getTrialDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

// La caisse ne doit jamais être bloquée par la facturation : ce gating ne
// s'applique qu'au dashboard, et seulement si Stripe est configuré.
// L'essai 14 jours sans CB (shops.trial_ends_at) ouvre le dashboard sans
// abonnement tant qu'il court.
export async function isShopGated(shopId: string): Promise<boolean> {
  if (!isStripeConfigured()) return false;
  const sub = await getSubscription(shopId);
  if (isSubscriptionActive(sub)) return false;
  const supabase = await createClient("owner");
  const { data } = await supabase
    .from("shops")
    .select("trial_ends_at")
    .eq("id", shopId)
    .maybeSingle();
  const daysLeft = getTrialDaysLeft(data?.trial_ends_at ?? null);
  return daysLeft === null || daysLeft <= 0;
}

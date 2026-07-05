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

// La caisse ne doit jamais être bloquée par la facturation : ce gating ne
// s'applique qu'au dashboard, et seulement si Stripe est configuré.
export async function isShopGated(shopId: string): Promise<boolean> {
  if (!isStripeConfigured()) return false;
  const sub = await getSubscription(shopId);
  if (!sub) return true;
  return !ACTIVE_STATUSES.has(sub.status);
}

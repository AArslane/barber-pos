"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getShop } from "@/lib/shop";
import { getSubscription, type SubscriptionStatus } from "@/lib/subscription";
import { isStripeConfigured } from "@/lib/stripe";
import type { ShopSettings } from "@/lib/types";

// Réglages de la boutique active (sélecteur multi-boutiques du dashboard),
// pas d'un shop arbitraire du owner.
export async function getShopSettings(): Promise<{ shopId: string; name: string; currency: string; settings: ShopSettings } | null> {
  const shop = await getShop();
  if (!shop) return null;
  return {
    shopId: shop.id,
    name: shop.name,
    currency: shop.currency,
    settings: shop.settings,
  };
}

export async function updateShopIdentity(shopId: string, name: string, currency: string): Promise<void> {
  const supabase = await createClient("owner");
  const { error } = await supabase.from("shops").update({ name, currency }).eq("id", shopId);
  if (error) throw new Error(error.message);
}

export async function updateShopSettings(shopId: string, settings: ShopSettings): Promise<void> {
  const supabase = await createClient("owner");
  const { error } = await supabase.from("shops").update({ settings }).eq("id", shopId);
  if (error) throw new Error(error.message);
}

export async function getSubscriptionInfo(
  shopId: string
): Promise<{ stripeConfigured: boolean; subscription: SubscriptionStatus | null }> {
  if (!isStripeConfigured()) return { stripeConfigured: false, subscription: null };
  return { stripeConfigured: true, subscription: await getSubscription(shopId) };
}

export type ConnectedDevice = { userId: string; email: string; createdAt: string };

export async function listConnectedDevices(shopId: string): Promise<ConnectedDevice[]> {
  const supabase = await createClient("owner");
  const { data, error } = await supabase
    .from("members")
    .select("user_id, created_at")
    .eq("shop_id", shopId)
    .eq("role", "device");
  if (error || !data) return [];

  const admin = createAdminClient();
  const devices: ConnectedDevice[] = [];
  for (const m of data) {
    const { data: userRes } = await admin.auth.admin.getUserById(m.user_id);
    if (userRes.user) {
      devices.push({ userId: m.user_id, email: userRes.user.email ?? "?", createdAt: m.created_at });
    }
  }
  return devices;
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withShopSettingsDefaults, type ShopSettings } from "@/lib/types";

export async function getShopSettings(): Promise<{ shopId: string; name: string; currency: string; settings: ShopSettings } | null> {
  const supabase = await createClient("owner");
  const { data, error } = await supabase
    .from("members")
    .select("shop_id, shops(name, currency, settings)")
    .limit(1)
    .single();
  if (error || !data) return null;
  const shop = Array.isArray(data.shops) ? data.shops[0] : data.shops;
  const s = shop as { name: string; currency: string; settings: Partial<ShopSettings> } | null;
  if (!s) return null;
  return {
    shopId: data.shop_id as string,
    name: s.name,
    currency: s.currency,
    settings: withShopSettingsDefaults(s.settings),
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

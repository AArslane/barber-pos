import { createClient } from "@/lib/supabase/server";
import { withShopSettingsDefaults } from "@/lib/types";

// Shop du user connecté (MVP : un seul shop par compte).
export async function getShop() {
  const supabase = await createClient("owner");
  const { data, error } = await supabase
    .from("members")
    .select("shop_id, shops(name, currency, settings)")
    .limit(1)
    .single();

  if (error || !data) return null;
  const shop = Array.isArray(data.shops) ? data.shops[0] : data.shops;
  const s = shop as { name: string; settings: unknown } | null;
  return {
    id: data.shop_id as string,
    name: s?.name ?? "Mon salon",
    adminSessionMinutes: withShopSettingsDefaults(
      s?.settings as Parameters<typeof withShopSettingsDefaults>[0]
    ).security.admin_session_minutes,
  };
}

import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { withShopSettingsDefaults, type ShopSettings } from "@/lib/types";

export const ACTIVE_SHOP_COOKIE = "active_shop_id";

export type MemberShop = { id: string; name: string };

// Toutes les boutiques du owner connecté (un owner peut en avoir plusieurs,
// cf. create_additional_shop). Le compte tablette (device) n'appartient qu'à
// un seul shop : cette fonction n'est utilisée que côté espace propriétaire.
export async function listMemberShops(): Promise<MemberShop[]> {
  const supabase = await createClient("owner");
  const { data, error } = await supabase.from("members").select("shop_id, shops(name)");
  if (error || !data) return [];
  return data
    .map((m) => {
      const shop = Array.isArray(m.shops) ? m.shops[0] : m.shops;
      const s = shop as { name: string } | null;
      return s ? { id: m.shop_id as string, name: s.name } : null;
    })
    .filter((s): s is MemberShop => s !== null);
}

// Boutique active (sélecteur du dashboard) : cookie si présent et valide,
// sinon la première boutique du owner.
export const getShop = cache(async function getShop() {
  const shops = await listMemberShops();
  if (shops.length === 0) return null;

  const cookieStore = await cookies();
  const cookieShopId = cookieStore.get(ACTIVE_SHOP_COOKIE)?.value;
  const activeId = shops.some((s) => s.id === cookieShopId) ? cookieShopId! : shops[0].id;

  const supabase = await createClient("owner");
  const { data, error } = await supabase
    .from("shops")
    .select("id, name, currency, settings")
    .eq("id", activeId)
    .single();
  if (error || !data) return null;

  const settings: ShopSettings = withShopSettingsDefaults(
    data.settings as Parameters<typeof withShopSettingsDefaults>[0]
  );

  return {
    id: data.id as string,
    name: data.name as string,
    currency: data.currency as string,
    settings,
    adminSessionMinutes: settings.security.admin_session_minutes,
    shops,
  };
});

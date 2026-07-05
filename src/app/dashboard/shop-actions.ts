"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_SHOP_COOKIE } from "@/lib/shop";

// Persiste la boutique active (sélecteur multi-boutiques du dashboard) dans
// un cookie : lu par getShop() côté serveur, propagé aux pages client via
// le contexte ActiveShop.
export async function switchActiveShop(shopId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_SHOP_COOKIE, shopId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function createAdditionalShop(name: string, currency: string): Promise<string> {
  const supabase = await createClient("owner");
  const { data, error } = await supabase.rpc("create_additional_shop", {
    shop_name: name,
    shop_currency: currency,
  });
  if (error || !data) throw new Error(error?.message ?? "Impossible de créer la boutique");
  return data as string;
}

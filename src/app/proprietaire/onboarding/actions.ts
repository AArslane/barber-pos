"use server";

import { createClient } from "@/lib/supabase/server";

// Erreurs retournées en valeur (pas jetées) : en production Next masque les
// messages des erreurs jetées par une server action, or ils doivent s'afficher.
export async function bootstrapShop(
  name: string,
  currency: string
): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient("owner");
  const { data, error } = await supabase.rpc("bootstrap_shop", {
    shop_name: name,
    shop_currency: currency,
  });
  if (error || !data) return { error: error?.message ?? "Impossible de créer le salon" };
  return { id: data as string };
}

export async function addBarber(
  shopId: string,
  name: string,
  color: string,
  commissionPct: number
): Promise<{ error?: string }> {
  const supabase = await createClient("owner");
  const { data, error } = await supabase
    .from("barbers")
    .insert({ shop_id: shopId, display_name: name, color })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Impossible d'ajouter le coiffeur" };

  const { error: privError } = await supabase
    .from("barber_private")
    .insert({ barber_id: data.id, shop_id: shopId, commission_pct: commissionPct });
  if (privError) return { error: privError.message };
  return {};
}

export type ServiceTemplateItem = {
  name: string;
  price: number;
  category: string;
  sort_order: number;
};

export async function seedServices(
  shopId: string,
  items: ServiceTemplateItem[]
): Promise<{ error?: string }> {
  if (items.length === 0) return {};
  const supabase = await createClient("owner");
  const { error } = await supabase
    .from("services")
    .insert(items.map((s) => ({ ...s, shop_id: shopId })));
  if (error) return { error: error.message };
  return {};
}

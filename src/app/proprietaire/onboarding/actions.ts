"use server";

import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function bootstrapShop(name: string, currency: string): Promise<string> {
  const supabase = await createClient("owner");
  const { data, error } = await supabase.rpc("bootstrap_shop", {
    shop_name: name,
    shop_currency: currency,
  });
  if (error || !data) throw new Error(error?.message ?? "Impossible de créer le salon");
  return data as string;
}

export async function addBarber(
  shopId: string,
  name: string,
  color: string,
  commissionPct: number
): Promise<void> {
  const supabase = await createClient("owner");
  const { data, error } = await supabase
    .from("barbers")
    .insert({ shop_id: shopId, display_name: name, color })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Impossible d'ajouter le coiffeur");

  const { error: privError } = await supabase
    .from("barber_private")
    .insert({ barber_id: data.id, shop_id: shopId, commission_pct: commissionPct });
  if (privError) throw new Error(privError.message);
}

export type ServiceTemplateItem = {
  name: string;
  price: number;
  category: string;
  sort_order: number;
};

export async function seedServices(shopId: string, items: ServiceTemplateItem[]): Promise<void> {
  if (items.length === 0) return;
  const supabase = await createClient("owner");
  const { error } = await supabase
    .from("services")
    .insert(items.map((s) => ({ ...s, shop_id: shopId })));
  if (error) throw new Error(error.message);
}

export async function createDeviceAccount(
  shopId: string
): Promise<{ email: string; password: string }> {
  const admin = createAdminClient();
  const email = `tablette-${shopId.slice(0, 8)}@device.barber-pos.local`;
  const password = randomUUID();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "device" },
  });
  if (error || !data.user) throw new Error(error?.message ?? "Impossible de créer le compte tablette");

  const supabase = await createClient("owner");
  const { error: memberError } = await supabase.rpc("add_device_membership", {
    shop: shopId,
    new_user_id: data.user.id,
  });
  if (memberError) throw new Error(memberError.message);

  return { email, password };
}

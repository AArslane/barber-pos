import { createClient } from "@/lib/supabase/server";

// Shop du user connecté (MVP : un seul shop par compte).
export async function getShop() {
  // TEMPORAIRE — préview sans Supabase, à supprimer avant déploiement (voir src/lib/preview.ts)
  // (id en dur : preview.ts importe Dexie, inutilisable côté serveur)
  if (process.env.NEXT_PUBLIC_PREVIEW === "1") {
    return { id: "11111111-1111-1111-1111-111111111111", name: "Barbershop Démo" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .select("shop_id, shops(name, currency)")
    .limit(1)
    .single();

  if (error || !data) return null;
  const shop = Array.isArray(data.shops) ? data.shops[0] : data.shops;
  return {
    id: data.shop_id as string,
    name: (shop as { name: string } | null)?.name ?? "Mon salon",
  };
}

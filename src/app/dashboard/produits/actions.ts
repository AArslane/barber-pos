"use server";

import { createClient } from "@/lib/supabase/server";

// Réappro / correction : la RPC écrit le mouvement et met à jour le stock dans
// la même transaction, et vérifie elle-même que l'appelant est owner du shop.
// Retourne le nouveau stock.
export async function adjustStock(
  productId: string,
  delta: number,
  reason: "restock" | "correction",
  note: string,
): Promise<number> {
  const supabase = await createClient("owner");
  const { data, error } = await supabase.rpc("adjust_stock", {
    p_product_id: productId,
    p_delta: delta,
    p_reason: reason,
    p_note: note.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data as number;
}

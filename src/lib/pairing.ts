"use server";

import { randomInt, randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Alphabet sans caractères ambigus (O/0, I/1) : le code se recopie à la main.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const CODE_TTL_MINUTES = 10;

export type PairingCode = { code: string; expiresAt: string };

// Les server actions sont des endpoints publics : chaque action re-vérifie que
// l'appelant a une session owner ET une membership owner sur le shop visé
// (le scope du cookie ne prouve rien, un client peut y copier n'importe quelle session).
async function assertOwnerOfShop(shopId: string): Promise<void> {
  const supabase = await createClient("owner");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Session propriétaire requise");
  const { data } = await supabase
    .from("members")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("shop_id", shopId)
    .eq("role", "owner")
    .maybeSingle();
  if (!data) throw new Error("Réservé au propriétaire du salon");
}

export async function generatePairingCode(shopId: string): Promise<PairingCode> {
  await assertOwnerOfShop(shopId);
  const admin = createAdminClient();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();

  // Collision improbable (32^6) mais le code est unique en base : on retente.
  for (let attempt = 0; attempt < 3; attempt++) {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    }
    const { error } = await admin
      .from("device_pairing_codes")
      .upsert({ shop_id: shopId, code, expires_at: expiresAt });
    if (!error) return { code, expiresAt };
  }
  throw new Error("Impossible de générer un code, réessayez");
}

export type RedeemResult = { ok: true } | { ok: false; error: string };

// Échec volontairement lent et uniforme (code inconnu, expiré, malformé) :
// endpoint public + code court, on ne donne aucun signal à une énumération.
async function reject(): Promise<RedeemResult> {
  await new Promise((r) => setTimeout(r, 500));
  return { ok: false, error: "Code invalide ou expiré." };
}

// Résultat retourné (pas d'exception) : en production Next masque les messages
// des erreurs jetées par une server action, or celui-ci doit s'afficher tel quel.
export async function redeemPairingCode(rawCode: string): Promise<RedeemResult> {
  const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== CODE_LENGTH) return reject();

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("device_pairing_codes")
    .select("shop_id, expires_at")
    .eq("code", code)
    .maybeSingle();
  if (!row || new Date(row.expires_at).getTime() < Date.now()) return reject();

  // Usage unique : consommé avant la création du compte.
  await admin.from("device_pairing_codes").delete().eq("shop_id", row.shop_id);

  // Un compte device jetable par tablette : le supprimer (Réglages → Sécurité)
  // révoque cette tablette sans toucher aux autres.
  const email = `tablette-${row.shop_id.slice(0, 8)}-${randomUUID().slice(0, 8)}@device.barber-pos.local`;
  const password = randomUUID();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "device" },
  });
  if (error || !created.user) {
    return { ok: false, error: "Impossible de créer le compte tablette." };
  }

  const { error: memberError } = await admin
    .from("members")
    .insert({ user_id: created.user.id, shop_id: row.shop_id, role: "device" });
  if (memberError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: "Impossible de rattacher la tablette au salon." };
  }

  // Pose la session caisse (cookies sb-caisse-auth) directement depuis l'action.
  const caisse = await createClient("caisse");
  const { error: signInError } = await caisse.auth.signInWithPassword({ email, password });
  if (signInError) {
    return { ok: false, error: "Connexion de la tablette impossible, réessayez." };
  }
  return { ok: true };
}

export async function disconnectDevice(shopId: string, userId: string): Promise<void> {
  await assertOwnerOfShop(shopId);
  const supabase = await createClient("owner");
  // Ne supprime que des comptes device du shop de l'appelant — jamais un owner.
  const { data } = await supabase
    .from("members")
    .select("user_id")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .eq("role", "device")
    .maybeSingle();
  if (!data) throw new Error("Tablette inconnue");

  const admin = createAdminClient();
  // Supprimer le user invalide ses tokens (la tablette est déconnectée au
  // prochain refresh) et cascade sur members.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}

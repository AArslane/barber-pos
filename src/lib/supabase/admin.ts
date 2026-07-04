import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Clé secrète (jamais NEXT_PUBLIC_*) : seule capable de créer des comptes
// (compte tablette de l'onboarding). Server-only, jamais importable côté client.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

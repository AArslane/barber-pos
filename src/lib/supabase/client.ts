import { createBrowserClient } from "@supabase/ssr";

// Deux sessions distinctes (cookies séparés) : la caisse reste connectée pendant
// et après une visite dans l'espace propriétaire, sur la même tablette.
export type SessionScope = "caisse" | "owner";

export const SESSION_COOKIE_NAMES: Record<SessionScope, string> = {
  caisse: "sb-caisse-auth",
  owner: "sb-owner-auth",
};

export function createClient(scope: SessionScope = "caisse") {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: { name: SESSION_COOKIE_NAMES[scope] } }
  );
}

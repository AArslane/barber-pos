import { createBrowserClient } from "@supabase/ssr";

// Deux sessions distinctes (cookies séparés) : la caisse reste connectée pendant
// et après une visite dans l'espace propriétaire, sur la même tablette.
export type SessionScope = "caisse" | "owner";

export const SESSION_COOKIE_NAMES: Record<SessionScope, string> = {
  caisse: "sb-caisse-auth",
  owner: "sb-owner-auth",
};

// createBrowserClient garde un singleton interne : le deuxième appel renvoie le
// client du premier scope, avec son storageKey. Il faut donc désactiver ce
// singleton et mémoriser un client par scope, sinon la session owner s'écrit
// dans le cookie de la caisse.
const clients = new Map<SessionScope, ReturnType<typeof createBrowserClient>>();

export function createClient(scope: SessionScope = "caisse") {
  const cached = clients.get(scope);
  if (cached) return cached;
  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { isSingleton: false, cookieOptions: { name: SESSION_COOKIE_NAMES[scope] } }
  );
  clients.set(scope, client);
  return client;
}

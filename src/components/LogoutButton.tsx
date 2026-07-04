"use client";

import { useRouter } from "next/navigation";
import { createClient, type SessionScope } from "@/lib/supabase/client";

export function LogoutButton({
  scope = "caisse",
  redirectTo = "/login",
  label = "Déconnexion",
}: {
  scope?: SessionScope;
  redirectTo?: string;
  label?: string;
}) {
  const router = useRouter();

  async function handleLogout() {
    await createClient(scope).auth.signOut();
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="min-h-11 text-sm text-muted hover:text-foreground transition-colors duration-150 px-2"
    >
      {label}
    </button>
  );
}

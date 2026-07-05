"use client";

import { useRouter } from "next/navigation";
import { createClient, type SessionScope } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

export function LogoutButton({
  scope = "caisse",
  redirectTo = "/login",
  label = "Déconnexion",
  className,
}: {
  scope?: SessionScope;
  redirectTo?: string;
  label?: string;
  className?: string;
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
      className={cn(
        "min-h-11 text-sm text-muted hover:text-foreground transition-colors duration-150 px-2",
        className
      )}
    >
      {label}
    </button>
  );
}

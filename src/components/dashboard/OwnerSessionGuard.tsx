"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart"] as const;

// Déconnecte automatiquement la session propriétaire après N min d'inactivité
// sur la tablette (la session caisse, elle, n'est jamais affectée).
export function OwnerSessionGuard({ timeoutMinutes }: { timeoutMinutes: number }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    function reset() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        await createClient("owner").auth.signOut();
        router.replace("/caisse");
        router.refresh();
      }, timeoutMinutes * 60 * 1000);
    }

    reset();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset));
    return () => {
      if (timer.current) clearTimeout(timer.current);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [router, timeoutMinutes]);

  return null;
}

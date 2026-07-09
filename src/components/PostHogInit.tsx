"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { POSTHOG_KEY } from "@/lib/analytics";

// Monté dans le layout racine : le funnel visiteur → inscription → abonnement
// traverse les pages marketing ET l'app, l'identité doit être partagée.
// `defaults: "2025-05-24"` active la capture des pageviews SPA (history change)
// sans code manuel. UTM capturés automatiquement au pageview.
export function PostHogInit() {
  useEffect(() => {
    if (!POSTHOG_KEY || posthog.__loaded) return;
    posthog.init(POSTHOG_KEY, {
      api_host: "https://eu.i.posthog.com",
      defaults: "2025-05-24",
    });
  }, []);
  return null;
}

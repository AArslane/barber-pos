import posthog from "posthog-js";

// No-op sans clé : le tracking est entièrement optionnel (dev local, préprod).
export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

export function track(event: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return;
  posthog.capture(event, properties);
}

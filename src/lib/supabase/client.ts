import { createBrowserClient } from "@supabase/ssr";
import { createPreviewClient } from "@/lib/preview";

export function createClient() {
  // TEMPORAIRE — préview sans Supabase, à supprimer avant déploiement (voir src/lib/preview.ts)
  if (process.env.NEXT_PUBLIC_PREVIEW === "1") {
    return createPreviewClient() as ReturnType<typeof createBrowserClient>;
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

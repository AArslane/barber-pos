import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getShop } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";
import { isShopGated } from "@/lib/subscription";
import { isStripeConfigured } from "@/lib/stripe";
import { DashboardNav } from "@/components/dashboard/Nav";
import { LogoutButton } from "@/components/LogoutButton";
import { OwnerSessionGuard } from "@/components/dashboard/OwnerSessionGuard";
import { ActiveShopProvider } from "@/components/dashboard/ActiveShopContext";
import { SubscriptionGate } from "@/components/dashboard/SubscriptionGate";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shop = await getShop();
  if (!shop) redirect("/proprietaire/onboarding");

  // "Quitter l'admin" n'a de sens que sur la tablette (session caisse présente
  // en dessous) : sur le téléphone du proprio, seul "Déconnexion" s'affiche.
  const caisse = await createClient("caisse");
  const {
    data: { user: caisseUser },
  } = await caisse.auth.getUser();
  const onTablet = caisseUser?.app_metadata.role === "device";

  // La caisse ne doit jamais être bloquée par la facturation : ce gating ne
  // s'applique qu'au dashboard, jamais si Stripe n'est pas configuré, et
  // laisse toujours accès aux réglages pour pouvoir s'abonner.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isReglages = pathname.startsWith("/dashboard/reglages");
  const gated = !isReglages && isStripeConfigured() && (await isShopGated(shop.id));

  return (
    <ActiveShopProvider shopId={shop.id}>
      <div className="flex-1 flex flex-col">
        <OwnerSessionGuard timeoutMinutes={shop.adminSessionMinutes} />
        <header className="border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-bold truncate">{shop.name}</span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {onTablet && (
              // Quitter l'admin ferme la session owner : sur un appareil partagé,
              // l'espace propriétaire redemande toujours le mot de passe.
              <LogoutButton
                scope="owner"
                redirectTo="/caisse"
                label="Quitter l'admin"
                className="inline-flex items-center rounded-lg bg-surface-2 px-3 py-2 text-foreground hover:bg-border-strong/30 hover:text-foreground"
              />
            )}
            <LogoutButton scope="owner" redirectTo="/proprietaire" />
          </div>
        </header>
        <div className="border-b border-border px-4 sm:px-6 py-2">
          <DashboardNav shops={shop.shops} activeShopId={shop.id} />
        </div>
        <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
          {gated ? <SubscriptionGate /> : children}
        </main>
      </div>
    </ActiveShopProvider>
  );
}

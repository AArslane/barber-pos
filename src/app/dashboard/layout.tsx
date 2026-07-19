import { redirect } from "next/navigation";
import { getShop } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";
import { getSubscription, getTrialDaysLeft, isSubscriptionActive } from "@/lib/subscription";
import { isStripeConfigured } from "@/lib/stripe";
import { DashboardNav } from "@/components/dashboard/Nav";
import { LogoutButton } from "@/components/LogoutButton";
import { OwnerSessionGuard } from "@/components/dashboard/OwnerSessionGuard";
import { ActiveShopProvider } from "@/components/dashboard/ActiveShopContext";
import { TrialBanner } from "@/components/dashboard/TrialBanner";

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

  // Bandeau essai : seulement si le gating existe (Stripe configuré), qu'aucun
  // abonnement n'est actif et que l'essai court encore.
  let trialDaysLeft: number | null = null;
  if (isStripeConfigured() && !isSubscriptionActive(await getSubscription(shop.id))) {
    const daysLeft = getTrialDaysLeft(shop.trialEndsAt);
    if (daysLeft !== null && daysLeft > 0) trialDaysLeft = daysLeft;
  }

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
            <LogoutButton scope="owner" redirectTo="/login" />
          </div>
        </header>
        <div className="border-b border-border px-4 sm:px-6 py-2">
          <DashboardNav shops={shop.shops} activeShopId={shop.id} />
        </div>
        {trialDaysLeft !== null && <TrialBanner daysLeft={trialDaysLeft} />}
        <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>
    </ActiveShopProvider>
  );
}

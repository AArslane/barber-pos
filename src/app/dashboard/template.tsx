import { headers } from "next/headers";
import { getShop } from "@/lib/shop";
import { isShopGated } from "@/lib/subscription";
import { isStripeConfigured } from "@/lib/stripe";
import { SubscriptionGate } from "@/components/dashboard/SubscriptionGate";

export default async function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const shop = await getShop();
  if (!shop) return children;

  // La caisse ne doit jamais être bloquée par la facturation : ce gating ne
  // s'applique qu'au dashboard, jamais si Stripe n'est pas configuré, et
  // laisse toujours accès aux réglages pour pouvoir s'abonner.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isReglages = pathname.startsWith("/dashboard/reglages");
  const gated = !isReglages && isStripeConfigured() && (await isShopGated(shop.id));

  return gated ? <SubscriptionGate /> : children;
}

"use client";

import { createContext, useContext } from "react";

// Boutique active (sélecteur multi-boutiques) : posée par DashboardLayout
// (server component, via getShop()) pour que les pages client filtrent leurs
// requêtes Supabase par shop_id plutôt que de compter uniquement sur RLS
// (qui autoriserait sinon la lecture de toutes les boutiques du owner).
const ActiveShopContext = createContext<string | null>(null);

export function ActiveShopProvider({
  shopId,
  children,
}: {
  shopId: string;
  children: React.ReactNode;
}) {
  return <ActiveShopContext.Provider value={shopId}>{children}</ActiveShopContext.Provider>;
}

export function useActiveShopId(): string {
  const shopId = useContext(ActiveShopContext);
  if (!shopId) throw new Error("useActiveShopId must be used within ActiveShopProvider");
  return shopId;
}

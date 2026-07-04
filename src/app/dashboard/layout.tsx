import Link from "next/link";
import { redirect } from "next/navigation";
import { getShop } from "@/lib/shop";
import { DashboardNav } from "@/components/dashboard/Nav";
import { LogoutButton } from "@/components/LogoutButton";
import { OwnerSessionGuard } from "@/components/dashboard/OwnerSessionGuard";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shop = await getShop();
  if (!shop) redirect("/proprietaire/onboarding");

  return (
    <div className="flex-1 flex flex-col">
      <OwnerSessionGuard timeoutMinutes={shop.adminSessionMinutes} />
      <header className="border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-bold truncate">{shop.name}</span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <Link
            href="/caisse"
            className="inline-flex items-center min-h-11 text-sm px-3 py-2 rounded-lg bg-surface-2 hover:bg-border-strong/30 transition-colors duration-150"
          >
            Quitter l&apos;admin
          </Link>
          <LogoutButton scope="owner" redirectTo="/proprietaire" />
        </div>
      </header>
      <div className="border-b border-border px-4 sm:px-6 py-2">
        <DashboardNav />
      </div>
      <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
        {children}
      </main>
    </div>
  );
}

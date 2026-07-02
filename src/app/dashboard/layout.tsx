import Link from "next/link";
import { redirect } from "next/navigation";
import { getShop } from "@/lib/shop";
import { DashboardNav } from "@/components/dashboard/Nav";
import { LogoutButton } from "@/components/LogoutButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shop = await getShop();
  if (!shop) redirect("/login");

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-zinc-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-bold truncate">{shop.name}</span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <Link
            href="/caisse"
            className="text-sm px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors duration-150"
          >
            Ouvrir la caisse
          </Link>
          <LogoutButton />
        </div>
      </header>
      <div className="border-b border-zinc-800 px-4 sm:px-6 py-2">
        <DashboardNav />
      </div>
      <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
        {children}
      </main>
    </div>
  );
}

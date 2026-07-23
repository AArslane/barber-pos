"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { switchActiveShop } from "@/app/dashboard/shop-actions";
import type { MemberShop } from "@/lib/shop";
import {
  CalendarIcon,
  ChartIcon,
  HistoryIcon,
  HomeIcon,
  PackageIcon,
  PercentIcon,
  SettingsIcon,
} from "@/components/icons";

const LINKS = [
  { href: "/dashboard", label: "Aujourd'hui", icon: HomeIcon },
  { href: "/dashboard/agenda", label: "Agenda", icon: CalendarIcon },
  { href: "/dashboard/historique", label: "Historique", icon: HistoryIcon },
  { href: "/dashboard/stats", label: "Stats", icon: ChartIcon },
  { href: "/dashboard/commissions", label: "Commissions", icon: PercentIcon },
  { href: "/dashboard/produits", label: "Produits", icon: PackageIcon },
  { href: "/dashboard/reglages", label: "Réglages", icon: SettingsIcon },
];

export function DashboardNav({
  shops,
  activeShopId,
}: {
  shops: MemberShop[];
  activeShopId: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-3">
      {shops.length > 1 && (
        <select
          value={activeShopId}
          onChange={(e) => {
            void switchActiveShop(e.target.value).then(() => {
              router.refresh();
            });
          }}
          className="min-h-11 rounded-lg border border-border bg-surface px-3 text-sm font-medium"
        >
          {shops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
      <nav className="flex gap-1 overflow-x-auto">
        {LINKS.map(({ href, label, icon: NavIcon }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "inline-flex items-center gap-2 min-h-11 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors duration-150",
                active
                  ? "bg-surface-2 text-gold-400 font-semibold"
                  : "text-muted hover:text-foreground hover:bg-surface-2",
              )}
            >
              <NavIcon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  ChartIcon,
  HistoryIcon,
  HomeIcon,
  PercentIcon,
  SettingsIcon,
} from "@/components/icons";

const LINKS = [
  { href: "/dashboard", label: "Aujourd'hui", icon: HomeIcon },
  { href: "/dashboard/historique", label: "Historique", icon: HistoryIcon },
  { href: "/dashboard/stats", label: "Stats", icon: ChartIcon },
  { href: "/dashboard/commissions", label: "Commissions", icon: PercentIcon },
  { href: "/dashboard/reglages", label: "Réglages", icon: SettingsIcon },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
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
  );
}

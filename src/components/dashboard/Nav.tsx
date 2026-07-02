"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Aujourd'hui" },
  { href: "/dashboard/historique", label: "Historique" },
  { href: "/dashboard/stats", label: "Stats" },
  { href: "/dashboard/commissions", label: "Commissions" },
  { href: "/dashboard/reglages", label: "Réglages" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {LINKS.map(({ href, label }) => {
        const active =
          href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors duration-150 ${
              active
                ? "bg-indigo-600 text-white"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

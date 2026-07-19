import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

export function Footer() {
  return (
    <footer className="border-t border-border px-4 sm:px-6 py-10">
      <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-muted">
        <div className="text-center sm:text-left">
          <p className="font-display tracking-widest text-gold-400">
            {BRAND_NAME.toUpperCase()}
          </p>
          <p className="mt-1">
            La caisse des barbershops : commissions auto, CA en temps réel.
          </p>
        </div>
        <nav className="flex flex-wrap justify-center gap-4">
          <Link href="/tarifs" className="hover:text-foreground">
            Tarifs
          </Link>
          <Link href="/inscription" className="hover:text-foreground">
            Essai gratuit
          </Link>
          <Link href="/login" className="hover:text-foreground">
            Connexion
          </Link>
        </nav>
      </div>
    </footer>
  );
}

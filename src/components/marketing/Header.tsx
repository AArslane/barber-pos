import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { CtaLink } from "./CtaLink";

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="font-display text-xl tracking-widest text-gold-400">
          {BRAND_NAME.toUpperCase()}
        </Link>
        <nav className="flex items-center gap-4 sm:gap-6 text-sm">
          <Link href="/tarifs" className="text-muted hover:text-foreground">
            Tarifs
          </Link>
          <Link
            href="/login"
            className="hidden sm:inline text-muted hover:text-foreground"
          >
            Se connecter
          </Link>
          <CtaLink location="header" size="md">
            Essayer gratuitement
          </CtaLink>
        </nav>
      </div>
    </header>
  );
}

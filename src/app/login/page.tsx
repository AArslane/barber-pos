"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient as createBareClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { resetLocalCache } from "@/lib/db";
import { redeemPairingCode } from "@/lib/pairing";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/fields";
import { ScissorsIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"email" | "pair">("email");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePair(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await redeemPairingCode(code);
      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        return;
      }
      // Nouvelle identité de caisse : les données locales de l'ancienne
      // boutique (catalogue, réglages, ventes rejetées) ne doivent pas survivre.
      await resetLocalCache();
      router.replace("/caisse");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    // Toute exception doit repasser par setLoading(false) : sans ça le bouton
    // reste bloqué sur "Connexion…" sans message, et l'utilisateur n'a aucun
    // moyen de savoir ce qui a échoué.
    try {
      // Un seul formulaire pour les deux types de compte. Le rôle est lu via un
      // client jetable en mémoire (aucun cookie écrit) : s'authentifier sur le
      // scope caisse pour deviner le rôle écraserait — puis détruirait — la
      // session device d'une tablette appairée sur ce navigateur.
      const probe = createBareClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        // storageKey dédié : sans lui, ce client partagerait la clé par défaut
        // et déclencherait le warning "Multiple GoTrueClient instances".
        { auth: { persistSession: false, autoRefreshToken: false, storageKey: "sb-login-probe" } },
      );
      const { data, error } = await probe.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError("Email ou mot de passe incorrect.");
        setLoading(false);
        return;
      }
      const scope = data.user?.app_metadata.role === "device" ? "caisse" : "owner";
      const { error: scopedError } = await createClient(scope).auth.signInWithPassword({
        email,
        password,
      });
      if (scopedError) {
        setError("Connexion impossible, réessayez.");
        setLoading(false);
        return;
      }
      router.replace(scope === "caisse" ? "/caisse" : "/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <Card className="w-full max-w-sm p-8">
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold-400/40 bg-gold-500/10">
              <ScissorsIcon className="h-5 w-5 text-gold-400" />
            </span>
            <h1 className="font-display text-3xl tracking-widest">
              SALON<span className="text-gold-400">FLOW</span>
            </h1>
            <p className="text-sm text-muted">
              {mode === "pair" ? "Appairer la tablette du salon" : "Connexion à votre espace"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-xl bg-background/50 p-1">
            {(
              [
                { value: "email", label: "Email & mot de passe" },
                { value: "pair", label: "Code d'appairage" },
              ] as const
            ).map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => {
                  setMode(m.value);
                  setError(null);
                }}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                  mode === m.value
                    ? "bg-gold-500/15 text-gold-400 border border-gold-400/40"
                    : "text-muted hover:text-foreground",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode === "pair" ? (
            <form onSubmit={handlePair} className="space-y-5">
              <p className="text-sm text-muted text-center">
                Saisissez le code d&apos;appairage affiché sur votre espace propriétaire
                (Réglages → Sécurité).
              </p>
              <Field label="Code d'appairage">
                <Input
                  required
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={8}
                  placeholder="ABC234"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="text-center font-mono text-lg tracking-[0.3em]"
                />
              </Field>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full">
                {loading ? "Appairage…" : "Connecter la caisse"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <Field label="Email">
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="vous@exemple.fr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Mot de passe">
                <Input
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full">
                {loading ? "Connexion…" : "Se connecter"}
              </Button>
              <p className="text-center text-sm text-muted">
                Pas encore de salon ?{" "}
                <Link href="/inscription" className="text-gold-400 hover:underline">
                  Créer un compte
                </Link>
              </p>
            </form>
          )}

        </div>
      </Card>
    </main>
  );
}

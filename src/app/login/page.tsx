"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { redeemPairingCode } from "@/lib/pairing";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/fields";
import { ScissorsIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"pair" | "email">("pair");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePair(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await redeemPairingCode(code);
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.replace("/caisse");
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError("Email ou mot de passe incorrect.");
      setLoading(false);
      return;
    }
    // La caisse n'accepte que le compte tablette : un compte propriétaire ici
    // donnerait à la tablette des droits owner (et ses ventes ne synchroniseraient pas).
    if (data.user?.app_metadata.role !== "device") {
      await supabase.auth.signOut();
      setError(
        "Ce compte n'est pas un compte tablette. Utilisez un code d'appairage (Réglages → Sécurité sur votre espace propriétaire)."
      );
      setLoading(false);
      return;
    }
    router.replace("/caisse");
    router.refresh();
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
              BARBER <span className="text-gold-400">POS</span>
            </h1>
            <p className="text-sm text-muted">
              {mode === "pair" ? "Appairer la tablette" : "Connexion du salon"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-xl bg-background/50 p-1">
            {(
              [
                { value: "pair", label: "Code d'appairage" },
                { value: "email", label: "Identifiants" },
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
                  placeholder="salon@exemple.fr"
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
            </form>
          )}

        </div>
      </Card>
    </main>
  );
}

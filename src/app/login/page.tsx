"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { redeemPairingCode } from "@/lib/pairing";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/fields";
import { ScissorsIcon } from "@/components/icons";

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

          <button
            type="button"
            className="w-full text-center text-sm text-faint hover:text-foreground transition-colors duration-150"
            onClick={() => {
              setMode(mode === "pair" ? "email" : "pair");
              setError(null);
            }}
          >
            {mode === "pair" ? "Connexion par identifiants" : "Utiliser un code d'appairage"}
          </button>
        </div>
      </Card>
    </main>
  );
}

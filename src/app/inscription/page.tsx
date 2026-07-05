"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/fields";
import { LockIcon } from "@/components/icons";

export default function InscriptionPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient("owner");
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    // Confirmation email activée côté projet Supabase : pas de session tout
    // de suite, on invite à valider l'email avant de continuer.
    if (!data.session) {
      setCheckEmail(true);
      setLoading(false);
      return;
    }
    router.replace("/proprietaire/onboarding");
    router.refresh();
  }

  if (checkEmail) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-sm p-8 text-center space-y-3">
          <h1 className="font-display text-xl tracking-widest">VÉRIFIEZ VOTRE EMAIL</h1>
          <p className="text-sm text-muted">
            Un email de confirmation vous a été envoyé. Cliquez sur le lien pour activer votre
            compte, puis connectez-vous.
          </p>
          <Link href="/proprietaire" className="text-sm text-gold-400 hover:underline">
            Aller à la connexion
          </Link>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <Card className="w-full max-w-sm p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-col items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold-400/40 bg-gold-500/10">
              <LockIcon className="h-5 w-5 text-gold-400" />
            </span>
            <h1 className="font-display text-2xl tracking-widest">
              CRÉER MON <span className="text-gold-400">SALON</span>
            </h1>
            <p className="text-sm text-muted text-center">
              Inscription propriétaire — l&apos;étape suivante configure votre salon.
            </p>
          </div>
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
              minLength={6}
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full">
            {loading ? "Création…" : "Créer mon compte"}
          </Button>
          <p className="text-center text-sm text-muted">
            Déjà un compte ?{" "}
            <Link href="/proprietaire" className="text-gold-400 hover:underline">
              Se connecter
            </Link>
          </p>
        </form>
      </Card>
    </main>
  );
}

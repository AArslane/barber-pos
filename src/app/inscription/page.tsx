"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/fields";
import { LockIcon } from "@/components/icons";

export default function InscriptionPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const signupStarted = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    track("signup_submitted");
    const supabase = createClient("owner");
    // Nom/téléphone stockés dans raw_user_meta_data (aucune table dédiée pour
    // l'instant) — le téléphone reste optionnel.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim() || null,
        },
      },
    });
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
          <Link href="/login" className="text-sm text-gold-400 hover:underline">
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom">
              <Input
                required
                autoComplete="given-name"
                placeholder="Karim"
                value={firstName}
                onFocus={() => {
                  if (signupStarted.current) return;
                  signupStarted.current = true;
                  track("signup_started");
                }}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </Field>
            <Field label="Nom">
              <Input
                required
                autoComplete="family-name"
                placeholder="Benali"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Téléphone (optionnel)">
            <Input
              type="tel"
              autoComplete="tel"
              placeholder="06 12 34 56 78"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
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
            <Link href="/login" className="text-gold-400 hover:underline">
              Se connecter
            </Link>
          </p>
        </form>
      </Card>
    </main>
  );
}

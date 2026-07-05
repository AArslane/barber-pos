# Déploiement en production — checklist go-live

## 1. Variables d'environnement (Vercel → Project → Settings → Environment Variables)

| Variable | Secrète | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | non | URL du projet Supabase (Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | non | Clé publique (`sb_publishable_...`) |
| `SUPABASE_SECRET_KEY` | **oui** | Clé secrète (`sb_secret_...`), server-only. Utilisée par `src/lib/supabase/admin.ts` (création des comptes tablette, `listConnectedDevices`) |
| `STRIPE_SECRET_KEY` | **oui** | Clé secrète Stripe. Optionnelle : absente = gating abonnement désactivé partout |
| `STRIPE_WEBHOOK_SECRET` | **oui** | Signing secret du endpoint webhook Stripe |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | non | Clé publique Stripe — réservée à une future intégration Stripe.js côté client (le Checkout actuel redirige entièrement côté serveur, cette variable n'est pas encore lue par le code) |
| `STRIPE_PRICE_ID` | non (mais spécifique à l'environnement) | ID du prix Stripe (Price) de l'abonnement mensuel unique |

Toutes ces variables doivent être renseignées pour **Production** (et Preview si vous testez avant merge). Ne jamais committer `.env.local` — se référer à `.env.local.example`.

## 2. Migrations Supabase (projet de production)

Appliquer dans l'ordre, via `supabase db push` (CLI liée au projet prod) ou en collant chaque fichier dans l'éditeur SQL Supabase :

1. `supabase/migrations/0001_init.sql` — schéma initial, rôles, RLS
2. `supabase/migrations/0002_onboarding.sql` — `bootstrap_shop`, `add_device_membership`
3. `supabase/migrations/0003_device_pairing.sql` — table `device_pairing_codes`
4. `supabase/migrations/0004_drop_add_device_membership.sql` — suppression de la RPC remplacée par l'appairage
5. `supabase/migrations/0005_saas.sql` — `create_additional_shop`, table `subscriptions`

Vérifier après application : `select * from pg_policies where schemaname = 'public';` doit lister les policies de chaque table (RLS activée partout).

## 3. Realtime

Le dashboard "Aujourd'hui" écoute `postgres_changes` sur `public.sales`. La migration 0001 exécute déjà :

```sql
alter publication supabase_realtime add table public.sales;
```

Vérifier dans Supabase → Database → Replication que `sales` est bien cochée dans `supabase_realtime`. Si elle a été retirée manuellement, la recocher.

## 4. Webhook Stripe (si Stripe activé)

1. Stripe Dashboard → Developers → Webhooks → **Add endpoint**.
2. URL : `https://<votre-domaine>/api/stripe/webhook`
3. Événements à cocher (strict minimum utilisé par `src/app/api/stripe/webhook/route.ts`) :
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copier le **Signing secret** affiché → `STRIPE_WEBHOOK_SECRET` sur Vercel.
5. Créer le produit + prix mensuel dans Stripe → copier l'ID du prix → `STRIPE_PRICE_ID`.

Sans ces variables, le code se dégrade proprement (`isStripeConfigured()` renvoie `false` partout) : pas d'erreur, juste pas de facturation.

## 5. Vérifications post-déploiement

- **PWA installable** : ouvrir le site en HTTPS sur mobile/tablette, vérifier que `manifest.webmanifest` (`/manifest.webmanifest`) et le service worker (`/sw.js`, servi par `src/app/sw.js/route.ts`) répondent 200. Installer l'app (mode standalone) et vérifier l'icône + le lancement sur `/caisse`.
- **Caisse offline** : charger `/caisse` une première fois en ligne (catalogue mis en cache dans Dexie + précache du SW), puis couper le réseau (mode avion) et recharger la page : la caisse doit s'ouvrir sans erreur, encaisser une vente doit fonctionner et apparaître dans le badge de sync ("en attente"). Remettre le réseau : la vente doit se synchroniser automatiquement (`syncPending` sur l'event `online` + boucle 30s).
- **RLS — compte device isolé** : se connecter à la caisse avec un compte tablette (`device`) et vérifier depuis la console SQL Supabase (ou un test manuel via l'API REST avec le JWT du device) que :
  - `select * from barber_private` renvoie 0 ligne (policy owner-only).
  - `select * from sales` d'un **autre** shop renvoie 0 ligne (policy filtrée par `private.has_role(shop_id, 'device')`).
- **Multi-boutiques** : créer une deuxième boutique depuis Réglages → Boutique, vérifier que le sélecteur apparaît dans le nav et que changer de boutique change bien les données affichées (CA, historique, équipe, prestations) sans mélange entre boutiques.
- **Gating abonnement** (si Stripe configuré) : sur un shop sans abonnement actif, vérifier que le dashboard affiche "Abonnement requis" partout sauf Réglages, que le bouton "S'abonner" ouvre bien un Checkout Stripe, et que la caisse (`/caisse`) reste utilisable pendant ce temps.

## 6. Build de production

```
npm run build
```

Doit se terminer sans erreur (Turbopack, Next 16). Voir `RAPPORT_GLM.md` pour le résultat de la dernière exécution.

## 7. Configuration Vercel spécifique

Aucun réglage Vercel additionnel n'est nécessaire : le service worker est servi par une route Next (`src/app/sw.js/route.ts`) qui pose elle-même l'en-tête `Service-Worker-Allowed: /` et `Cache-Control: no-cache` — pas besoin de règle `vercel.json` pour ça. `next.config.ts` n'a pas de configuration spécifique à ajouter pour le moment.

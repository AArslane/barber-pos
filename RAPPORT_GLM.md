# Rapport de mission — finitions + Phase C SaaS + préparation prod

Trois commits locaux, un par phase (non pushés) : `Phase 1: ...`, `Phase 2: ...`, `Phase 3: ...`.

## Phase 1 — Finitions & durcissement

### Fait

- **Serwist** : tentative de migration réelle (`npm install serwist @serwist/next`, `src/app/sw.ts` avec précache + fallback offline `/caisse`, `next.config.ts` avec `withSerwistInit`). `npm run build` échoue :
  ```
  ⨯ ERROR: This build is using Turbopack, with a `webpack` config and no `turbopack` config.
  ```
  Serwist 9.5.11 (dernière version stable) s'appuie sur `@serwist/webpack-plugin`, mais Next 16 utilise Turbopack par défaut pour `next build`. Un support Turbopack existe (`@serwist/turbopack`) mais reste distinct/expérimental (voir issue serwist/serwist#54). **Décision : rollback**, package désinstallé, `src/app/sw.ts` supprimé.
- **SW manuel durci**, conformément à la clause de repli du prompt : `public/sw.js` (fichier statique) remplacé par une **route** `src/app/sw.js/route.ts` qui génère le même service worker mais avec un nom de cache dérivé de `VERCEL_GIT_COMMIT_SHA` (fallback `NEXT_BUILD_ID` puis timestamp) — le cache s'invalide donc automatiquement à chaque déploiement, sans bump manuel. Précache étendu (`/caisse`, `/manifest.webmanifest`, icônes) vs. seulement `/caisse` avant.
- **Durcissement offline** (`src/lib/sync.ts`, `src/lib/db.ts`) : `syncPending()` distingue désormais une erreur réseau (comportement inchangé : on retente) d'un rejet définitif du serveur identifié par un code Postgres (`23502`, `23503`, `23505`, `23514`, `42501`). Une vente rejetée est déplacée vers une nouvelle table Dexie `rejected_sales` (bump `db.version(2)`) au lieu de bloquer indéfiniment la file — les ventes suivantes continuent de se synchroniser. `SyncBadge` affiche en priorité "N vente(s) rejetée(s)" (tone danger) si `rejected_sales` n'est pas vide.
- Vérifié que la caisse démarre 100 % offline avec un catalogue en cache : `refreshCatalog()` échoue silencieusement si Supabase est injoignable, la page `/caisse` lit uniquement Dexie via `useLiveQuery` — aucun changement de code nécessaire, comportement déjà correct.
- **États de chargement + erreurs** : skeletons ajoutés sur Aujourd'hui, Stats, Commissions (Historique en avait déjà) ; `useToast().error(...)` ajouté partout où une requête Supabase du dashboard échouait silencieusement (chargement des 4 pages + remboursement dans Historique).

### Fichiers touchés

`next.config.ts` (réverti, pas de diff final), `public/sw.js` → `src/app/sw.js/route.ts`, `src/lib/db.ts`, `src/lib/sync.ts`, `src/components/caisse/SyncBadge.tsx`, `src/app/dashboard/page.tsx`, `src/app/dashboard/stats/page.tsx`, `src/app/dashboard/commissions/page.tsx`, `src/app/dashboard/historique/page.tsx`.

### Test manuel

1. `npm run dev`, ouvrir `/caisse`, encaisser une vente avec le réseau coupé (DevTools → Network → Offline) : le badge passe à "1 vente en attente", remettre le réseau → passe à "Synchronisé" en quelques secondes.
2. Pour simuler un rejet définitif : insérer manuellement une ligne invalide dans `pending_sales` (Dexie, via la console : violer une contrainte, ex. `barber_id` inexistant) puis relancer la sync — la vente doit apparaître dans `rejected_sales` (IndexedDB → `barber-pos` → `rejected_sales`) et le badge afficher "1 vente rejetée" sans bloquer les autres ventes en attente.
3. Couper le réseau puis recharger `/caisse` déjà visité une fois : la page doit s'afficher sans erreur (catalogue depuis Dexie).
4. Ouvrir Aujourd'hui/Stats/Commissions : un skeleton doit s'afficher brièvement avant les données ; couper Supabase (mauvaise clé) pour vérifier le toast d'erreur.

---

## Phase 2 — SaaS multi-shop

### Fait

- **`/inscription`** (`src/app/inscription/page.tsx`) : `supabase.auth.signUp` (scope `owner`), gère le cas confirmation email active (écran "vérifiez votre email") sinon redirige vers `/proprietaire/onboarding`. `src/proxy.ts` reconnaît `/inscription` comme route publique et redirige un owner déjà connecté vers `/dashboard` (même logique que `/proprietaire`). Lien ajouté depuis la page de connexion propriétaire.
- **Multi-boutiques** :
  - Migration `0005_saas.sql` : RPC `create_additional_shop` (comme `bootstrap_shop` mais sans l'exigence "aucune membership existante", pour permettre à un owner de créer une 2e/3e boutique).
  - `src/lib/shop.ts` réécrit : `listMemberShops()` (toutes les boutiques du owner), `getShop()` résout la boutique active via un cookie `active_shop_id` (repli sur la première boutique si absent/invalide) et renvoie aussi `shops`, `currency`, `settings`.
  - Sélecteur dans `src/components/dashboard/Nav.tsx` (affiché seulement si >1 boutique), persistant via cookie posé par la server action `switchActiveShop` (`src/app/dashboard/shop-actions.ts`).
  - `src/components/dashboard/ActiveShopContext.tsx` : contexte React posé par `DashboardLayout` pour que les pages client (Aujourd'hui/Historique/Stats/Commissions) connaissent la boutique active sans re-fetch serveur.
  - **Audit `.single()`** (`grep -rn "\.single()" src/`) : 5 sites trouvés. `src/lib/sync.ts` (caisse, `shops.select("settings").single()`) — **volontairement inchangé** : un compte tablette n'appartient qu'à un shop, c'est correct. `src/lib/shop.ts`, `src/components/reglages/EquipeTab.tsx`, `src/app/dashboard/reglages/actions.ts`, `src/app/proprietaire/onboarding/actions.ts` — tous sur des inserts/lookups mono-ligne légitimes, pas de fuite multi-shop.
  - **Fuite réelle trouvée et corrigée** : plusieurs requêtes owner (`sales`, `barbers`, `services`, `barber_private`) n'avaient **aucun** filtre `shop_id` et comptaient uniquement sur RLS (`is_member`) — avec un seul shop par owner ça ne posait pas de problème, mais avec le multi-shop ça aurait mélangé les données de toutes les boutiques d'un même owner. Ajout de `.eq("shop_id", shopId)` dans : `src/app/dashboard/page.tsx`, `historique/page.tsx`, `stats/page.tsx`, `commissions/page.tsx`, `src/components/reglages/EquipeTab.tsx`, `PrestationsTab.tsx`. Le canal Realtime "Aujourd'hui" est aussi filtré (`filter: shop_id=eq.<id>`).
  - Création d'une boutique supplémentaire : formulaire dans `BoutiqueTab` (Réglages → Boutique) → `createAdditionalShop` (RPC) → bascule automatique sur la nouvelle boutique.
- **Stripe** :
  - Migration `0005_saas.sql` (même fichier) : table `subscriptions` (`shop_id` PK/FK, `stripe_customer_id`, `stripe_subscription_id`, `status`, `current_period_end`), RLS lecture owner seule (`private.has_role(shop_id, 'owner')`), **aucune policy d'écriture** pour `anon`/`authenticated` — seul le service role (webhook, via `createAdminClient()`) peut écrire.
  - `src/lib/stripe.ts` : `isStripeConfigured()` / `getStripe()`. `src/lib/subscription.ts` : `getSubscription(shopId)`, `isShopGated(shopId)` (inactif si Stripe configuré et statut ni `active` ni `trialing`).
  - Routes : `src/app/api/stripe/checkout/route.ts` (Checkout mode subscription, `subscription_data.metadata.shop_id` pour retrouver le shop dans le webhook), `src/app/api/stripe/portal/route.ts` (portail client), `src/app/api/stripe/webhook/route.ts` (vérifie la signature, gère `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, upsert via client admin).
  - **Gating** : `src/components/dashboard/SubscriptionGate.tsx`, branché dans `src/app/dashboard/layout.tsx`. Ne s'active que si `isStripeConfigured()` **et** shop non actif/trialing, et **jamais** sur `/dashboard/reglages` (pour pouvoir s'abonner) — la route active est propagée depuis `src/proxy.ts` via un header `x-pathname` lu côté layout avec `headers()`. La caisse (`/caisse`) n'a aucune dépendance à ce gating.
  - **Mode sans Stripe** : si `STRIPE_SECRET_KEY` est absent, `isStripeConfigured()` renvoie `false` partout → aucun gating, routes API renvoient 503 proprement si appelées quand même.
  - Nouvel onglet Réglages → **Abonnement** (`src/components/reglages/AbonnementTab.tsx`) : statut, date de renouvellement, bouton Checkout ou portail selon l'état.
  - `.env.local.example` mis à jour avec les 4 nouvelles variables.

### Fichiers créés/modifiés (résumé)

Créés : `supabase/migrations/0005_saas.sql`, `src/app/inscription/page.tsx`, `src/app/dashboard/shop-actions.ts`, `src/components/dashboard/ActiveShopContext.tsx`, `src/components/dashboard/SubscriptionGate.tsx`, `src/components/reglages/AbonnementTab.tsx`, `src/lib/stripe.ts`, `src/lib/subscription.ts`, `src/app/api/stripe/{checkout,portal,webhook}/route.ts`.
Modifiés : `src/lib/shop.ts`, `src/proxy.ts`, `src/app/dashboard/layout.tsx`, `src/components/dashboard/Nav.tsx`, `src/app/dashboard/{page,stats/page,historique/page,commissions/page}.tsx`, `src/app/dashboard/reglages/{page,actions}.ts`, `src/components/reglages/{EquipeTab,PrestationsTab,BoutiqueTab}.tsx`, `src/app/proprietaire/page.tsx`, `.env.local.example`, `package.json`/`package-lock.json` (ajout `stripe`).

### Sciemment laissé de côté / simplifié

- Un seul plan mensuel (conforme au prompt), pas de gestion multi-plans/quantité.
- Pas d'UI Stripe.js côté client (Checkout/portail sont de simples redirections serveur → client via `window.location.href`), donc `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` est documentée mais pas encore lue par le code — suffisant pour le besoin (pas de formulaire de carte affiché dans l'app).
- Pas de suppression/désactivation de boutique depuis le dashboard (création uniquement, comme demandé).
- L'email de confirmation à l'inscription dépend du réglage Supabase Auth (Confirm email) — le code gère les deux cas mais je n'ai pas désactivé/activé ce réglage (config projet, hors code).

### Test manuel

1. **Inscription** : `/inscription` → créer un compte → (si confirmation email désactivée dans Supabase) redirection automatique vers l'onboarding → créer le salon → dashboard.
2. **Multi-boutiques** : Réglages → Boutique → "Créer" une 2e boutique → vérifier l'apparition du sélecteur dans le nav → changer de boutique → vérifier que Aujourd'hui/Historique/Stats/Commissions/Équipe/Prestations affichent des données différentes (et vides) pour la nouvelle boutique.
3. **Stripe (avec clés de test)** : Réglages → Abonnement → "S'abonner" → compléter un Checkout Stripe test → retour sur `/dashboard/reglages?abonnement=succes` → après réception du webhook (utiliser `stripe listen --forward-to localhost:3000/api/stripe/webhook` en local), le statut doit passer à "Actif" et le gating disparaître sur les autres pages.
4. **Sans Stripe configuré** : ne pas définir `STRIPE_SECRET_KEY` → le dashboard reste utilisable normalement, l'onglet Abonnement affiche le message "facturation non configurée".

---

## Phase 3 — Préparation production

### Fait

- `DEPLOY.md` créé à la racine : variables d'environnement (tirées de `grep -rn "process.env" src/`), ordre des migrations 0001→0005, activation Realtime sur `sales`, configuration webhook Stripe, vérifications post-déploiement (PWA, offline, RLS device, multi-boutiques, gating).
- `npm run build` vérifié propre après suppression de `.next` (build à froid).
- Pas de configuration Vercel/`next.config.ts` supplémentaire nécessaire : le SW est servi par une route Next qui pose déjà ses propres en-têtes (`Service-Worker-Allowed`, `Cache-Control`).

### Sciemment laissé de côté

- Le warning Next "workspace root inferred / multiple lockfiles" observé pendant le build est spécifique à l'exécution dans le worktree `.claude/worktrees/...` (deux `package-lock.json` empilés) — un artefact de l'environnement d'exécution de cette session, pas du dépôt réel ; rien à corriger dans le code.

---

## Commandes exécutées et résultats

- `npm run build` — **OK**, 0 erreur, 19 routes générées (dernière exécution après la Phase 3, `.next` supprimé au préalable).
- `npm run lint` — **OK**, aucune sortie (aucune erreur/warning ESLint).
- `npx tsc --noEmit` — **OK**, aucune erreur de type (vérification additionnelle, pas requise par le prompt mais faite à chaque étape).

Ces trois commandes ont été relancées et validées après chaque phase, avant chaque commit.

-- Appairage tablette : le propriétaire génère un code court depuis son dashboard,
-- la tablette le saisit pour recevoir son compte device — les identifiants du
-- compte tablette ne transitent jamais par un humain. Un seul code actif par
-- shop (PK = shop_id), usage unique, expiration courte.
-- Aucune policy : la table n'est accessible que via le service role (server actions).
create table public.device_pairing_codes (
  shop_id uuid primary key references public.shops (id) on delete cascade,
  code text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.device_pairing_codes enable row level security;

-- Les comptes tablette sont jetables : révoquer une tablette = supprimer son
-- user. L'audit ne doit pas bloquer la suppression d'un compte.
alter table public.audit_log
  drop constraint audit_log_actor_fkey,
  add constraint audit_log_actor_fkey
    foreign key (actor) references auth.users (id) on delete set null;

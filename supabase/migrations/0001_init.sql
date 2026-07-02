-- barber-pos — schéma initial
-- Multi-tenant : toutes les tables métier portent shop_id, isolées par RLS via members.
-- Deux rôles réels (members.role), appliqués par policy explicite par opération (jamais de "for all") :
--   owner  : proprio/admin, accès complet à son shop
--   device : compte tablette caisse, lecture catalogue + insertion de ventes seulement

create extension if not exists pgcrypto;

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  currency text not null default 'EUR',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.members (
  user_id uuid not null references auth.users (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'device')),
  created_at timestamptz not null default now(),
  primary key (user_id, shop_id)
);

create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  display_name text not null,
  color text not null default '#6366f1',
  -- hash bcrypt du PIN 6 chiffres (pgcrypto crypt/gen_salt('bf') côté serveur, bcryptjs côté caisse) ; jamais en clair
  pin_hash text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, shop_id)
);

-- Données sensibles (commission) : invisible du rôle device.
create table public.barber_private (
  barber_id uuid primary key references public.barbers (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  commission_pct numeric(5, 2) not null default 0 check (commission_pct between 0 and 100)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null,
  price numeric(8, 2) not null check (price >= 0),
  category text not null default 'Autre',
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, shop_id)
);

create table public.sales (
  -- id généré côté client (tablette) pour permettre l'upsert idempotent depuis la file offline
  id uuid primary key,
  shop_id uuid not null references public.shops (id) on delete cascade,
  barber_id uuid not null,
  payment_method text not null check (payment_method in ('cash', 'card', 'other')),
  total numeric(8, 2) not null check (total >= 0 and total <= 10000),
  status text not null default 'completed' check (status in ('completed', 'refunded')),
  -- heure réelle de la vente sur la tablette, pas l'heure de sync
  created_at timestamptz not null,
  device_id text,
  synced_at timestamptz not null default now(),
  foreign key (barber_id, shop_id) references public.barbers (id, shop_id)
);

create table public.sale_items (
  id uuid primary key,
  sale_id uuid not null references public.sales (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  -- snapshots : l'historique reste juste même si les tarifs changent
  name_snapshot text not null,
  price_snapshot numeric(8, 2) not null,
  qty int not null default 1 check (qty > 0 and qty <= 50),
  foreign key (service_id, shop_id) references public.services (id, shop_id)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  shop_id uuid not null references public.shops (id) on delete cascade,
  actor uuid references auth.users (id),
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index sales_shop_created_idx on public.sales (shop_id, created_at desc);
create index sales_barber_idx on public.sales (barber_id);
create index sale_items_sale_idx on public.sale_items (sale_id);
create index barbers_shop_idx on public.barbers (shop_id);
create index services_shop_idx on public.services (shop_id);
create index barber_private_shop_idx on public.barber_private (shop_id);
create index audit_log_shop_idx on public.audit_log (shop_id, created_at desc);

-- Rôles ------------------------------------------------------------------
-- Fonctions helper dans un schéma "private" (non exposé par PostgREST, cf.
-- api.schemas dans config.toml) : utilisables dans les policies/triggers,
-- mais pas appelables directement en RPC depuis l'extérieur.

create schema if not exists private;
grant usage on schema private to anon, authenticated;

create function private.is_member(shop uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members
    where members.user_id = (select auth.uid()) and members.shop_id = shop
  );
$$;

create function private.has_role(shop uuid, wanted text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members
    where members.user_id = (select auth.uid())
      and members.shop_id = shop
      and members.role = wanted
  );
$$;

grant execute on function private.is_member(uuid) to anon, authenticated;
grant execute on function private.has_role(uuid, text) to anon, authenticated;

-- Immutabilité des ventes : device insère, owner peut seulement changer le statut
-- (remboursement), delete interdit à tous.
create function public.sales_guard_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id <> old.id
    or new.shop_id <> old.shop_id
    or new.barber_id <> old.barber_id
    or new.payment_method <> old.payment_method
    or new.total <> old.total
    or new.created_at <> old.created_at
  then
    raise exception 'sales: seule la colonne status peut être modifiée';
  end if;
  return new;
end;
$$;

create trigger sales_guard_update
  before update on public.sales
  for each row execute function public.sales_guard_update();

create function public.sales_guard_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'sales: suppression interdite';
end;
$$;

create trigger sales_guard_delete
  before delete on public.sales
  for each row execute function public.sales_guard_delete();

-- RLS ------------------------------------------------------------------

alter table public.shops enable row level security;
alter table public.members enable row level security;
alter table public.barbers enable row level security;
alter table public.barber_private enable row level security;
alter table public.services enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.audit_log enable row level security;

-- shops : lecture pour les deux rôles, modification owner seul
create policy "members read their shops" on public.shops
  for select using (private.is_member(id));

create policy "owner update their shop" on public.shops
  for update using (private.has_role(id, 'owner'));

-- members : chacun lit sa propre ligne ; owner lit les membres de son shop
create policy "users read own membership" on public.members
  for select using (user_id = (select auth.uid()));

create policy "owner read shop members" on public.members
  for select using (private.has_role(shop_id, 'owner'));

-- barbers : lecture pour les deux rôles (pin_hash inclus, jamais le PIN en clair) ; CRUD owner seul
create policy "members read barbers" on public.barbers
  for select using (private.is_member(shop_id));

create policy "owner insert barbers" on public.barbers
  for insert with check (private.has_role(shop_id, 'owner'));

create policy "owner update barbers" on public.barbers
  for update using (private.has_role(shop_id, 'owner'));

create policy "owner delete barbers" on public.barbers
  for delete using (private.has_role(shop_id, 'owner'));

-- barber_private : owner seul, aucun accès device
create policy "owner full access barber_private" on public.barber_private
  for all using (private.has_role(shop_id, 'owner'))
  with check (private.has_role(shop_id, 'owner'));

-- services : lecture pour les deux rôles ; CRUD owner seul
create policy "members read services" on public.services
  for select using (private.is_member(shop_id));

create policy "owner insert services" on public.services
  for insert with check (private.has_role(shop_id, 'owner'));

create policy "owner update services" on public.services
  for update using (private.has_role(shop_id, 'owner'));

create policy "owner delete services" on public.services
  for delete using (private.has_role(shop_id, 'owner'));

-- sales : device insère seulement (vente complétée de son shop) ; owner lit + change le statut (remboursement)
create policy "device insert sales" on public.sales
  for insert with check (
    private.has_role(shop_id, 'device') and status = 'completed'
  );

create policy "owner read sales" on public.sales
  for select using (private.has_role(shop_id, 'owner'));

create policy "owner refund sales" on public.sales
  for update using (private.has_role(shop_id, 'owner'));

-- sale_items : device insère seulement (lignes d'une vente de son shop) ; owner lit
create policy "device insert sale_items" on public.sale_items
  for insert with check (private.has_role(shop_id, 'device'));

create policy "owner read sale_items" on public.sale_items
  for select using (private.has_role(shop_id, 'owner'));

-- audit_log : owner lit, écrit uniquement par les fonctions security definer
create policy "owner read audit_log" on public.audit_log
  for select using (private.has_role(shop_id, 'owner'));

-- Realtime pour le dashboard "Aujourd'hui"
alter publication supabase_realtime add table public.sales;

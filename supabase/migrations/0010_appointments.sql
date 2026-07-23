-- Agenda : rendez-vous par salon, liés (optionnellement) à un coiffeur et une
-- prestation. Créés depuis le dashboard (owner), la caisse (device) ou la page
-- de réservation publique (service-role, source 'web').
-- Jamais de DELETE : une annulation est un statut, comme le remboursement des ventes.

-- Durée des prestations : nécessaire au calcul des créneaux de réservation.
alter table public.services
  add column duration_min int not null default 30
  check (duration_min between 5 and 480);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  -- nullable : une résa web "sans préférence" n'a pas de coiffeur assigné
  barber_id uuid,
  service_id uuid,
  -- libellé libre quand la prestation ne vient pas du catalogue
  title text,
  client_name text not null check (char_length(client_name) between 1 and 120),
  client_phone text check (client_phone is null or char_length(client_phone) <= 30),
  client_email text check (client_email is null or char_length(client_email) <= 254),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'booked'
    check (status in ('booked', 'done', 'cancelled', 'no_show')),
  source text not null default 'manual' check (source in ('manual', 'web')),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (barber_id, shop_id) references public.barbers (id, shop_id) on delete set null (barber_id),
  foreign key (service_id, shop_id) references public.services (id, shop_id) on delete set null (service_id)
);

create index appointments_shop_starts_idx on public.appointments (shop_id, starts_at);
create index appointments_barber_idx on public.appointments (barber_id) where barber_id is not null;

create function public.appointments_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger appointments_touch_updated_at
  before update on public.appointments
  for each row execute function public.appointments_touch_updated_at();

-- L'identité d'un RDV ne change pas de boutique ni de date de création.
create function public.appointments_guard_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id <> old.id or new.shop_id <> old.shop_id or new.created_at <> old.created_at then
    raise exception 'appointments: id, shop_id et created_at sont immuables';
  end if;
  return new;
end;
$$;

create trigger appointments_guard_update
  before update on public.appointments
  for each row execute function public.appointments_guard_update();

create function public.appointments_guard_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'appointments: suppression interdite, utiliser status=cancelled';
end;
$$;

create trigger appointments_guard_delete
  before delete on public.appointments
  for each row execute function public.appointments_guard_delete();

-- RLS ------------------------------------------------------------------
-- owner et device gèrent l'agenda de leur shop (consultation, création,
-- modification — l'annulation depuis la tablette est voulue). Les résas web
-- passent par le service-role (page publique), jamais par anon.

alter table public.appointments enable row level security;

create policy "members read appointments" on public.appointments
  for select using (private.is_member(shop_id));

create policy "members insert appointments" on public.appointments
  for insert with check (private.is_member(shop_id));

create policy "members update appointments" on public.appointments
  for update using (private.is_member(shop_id))
  with check (private.is_member(shop_id));

-- Realtime : l'agenda de la caisse et du dashboard se rafraîchissent en direct.
alter publication supabase_realtime add table public.appointments;

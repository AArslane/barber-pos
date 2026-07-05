-- Phase C SaaS : multi-boutiques pour un owner + abonnements Stripe.

-- Un owner peut créer une boutique supplémentaire depuis le dashboard (en plus
-- de la première, créée par bootstrap_shop lors de l'onboarding). Contrairement
-- à bootstrap_shop, cette RPC n'exige pas l'absence de membership existante.
create function public.create_additional_shop(shop_name text, shop_currency text default 'EUR')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_shop_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentification requise';
  end if;

  if exists (select 1 from members where user_id = auth.uid() and role = 'device') then
    raise exception 'un compte tablette ne peut pas créer de boutique';
  end if;

  insert into shops (name, slug, currency)
  values (
    shop_name,
    lower(regexp_replace(shop_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 6),
    shop_currency
  )
  returning id into new_shop_id;

  insert into members (user_id, shop_id, role) values (auth.uid(), new_shop_id, 'owner');

  return new_shop_id;
end;
$$;

revoke all on function public.create_additional_shop(text, text) from public;
revoke execute on function public.create_additional_shop(text, text) from anon;
grant execute on function public.create_additional_shop(text, text) to authenticated;

-- Abonnements Stripe -------------------------------------------------------
-- Une ligne par shop. Écritures réservées au service role (webhook Stripe /
-- server actions admin) : aucune policy insert/update/delete pour anon ou
-- authenticated, seule la lecture est ouverte à l'owner du shop.
create table public.subscriptions (
  shop_id uuid primary key references public.shops (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'none',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "owner read subscription" on public.subscriptions
  for select using (private.has_role(shop_id, 'owner'));

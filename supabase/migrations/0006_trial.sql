-- Essai gratuit 14 jours sans carte bancaire : posé côté shop à la création,
-- indépendant de Stripe. isShopGated (dashboard) laisse passer tant que
-- trial_ends_at est dans le futur ; à échéance le gate abonnement s'applique.

alter table public.shops add column trial_ends_at timestamptz;

-- Backfill : les shops existants repartent avec 14 jours pleins.
update public.shops set trial_ends_at = now() + interval '14 days';

-- bootstrap_shop : pose le trial à la création du premier shop.
create or replace function public.bootstrap_shop(shop_name text, shop_currency text default 'EUR')
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

  if exists (select 1 from members where user_id = auth.uid()) then
    raise exception 'ce compte est déjà associé à un salon';
  end if;

  insert into shops (name, slug, currency, trial_ends_at)
  values (
    shop_name,
    lower(regexp_replace(shop_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 6),
    shop_currency,
    now() + interval '14 days'
  )
  returning id into new_shop_id;

  insert into members (user_id, shop_id, role) values (auth.uid(), new_shop_id, 'owner');

  return new_shop_id;
end;
$$;

-- create_additional_shop : idem pour les boutiques supplémentaires.
create or replace function public.create_additional_shop(shop_name text, shop_currency text default 'EUR')
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

  insert into shops (name, slug, currency, trial_ends_at)
  values (
    shop_name,
    lower(regexp_replace(shop_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 6),
    shop_currency,
    now() + interval '14 days'
  )
  returning id into new_shop_id;

  insert into members (user_id, shop_id, role) values (auth.uid(), new_shop_id, 'owner');

  return new_shop_id;
end;
$$;

-- La policy "owner update their shop" (0001) couvre toutes les colonnes : sans
-- verrou supplémentaire, un owner pourrait prolonger son propre essai via
-- PostgREST (update trial_ends_at). Privilèges de colonnes : le client ne peut
-- écrire que les colonnes des réglages. Les RPC security definer (ci-dessus)
-- et le service role ne sont pas affectés.
revoke update on table public.shops from authenticated;
grant update (name, currency, settings) on public.shops to authenticated;

-- Onboarding : crée le shop + la membership owner atomiquement pour le compte
-- qui vient de s'inscrire (invitation). Un seul shop par compte (MVP).
-- Le warning "authenticated_security_definer_function_executable" du linter est
-- attendu et accepté : c'est précisément le rôle de cette fonction (bootstrap
-- exécuté par un utilisateur authentifié qui n'a encore aucune membership).
create function public.bootstrap_shop(shop_name text, shop_currency text default 'EUR')
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

revoke all on function public.bootstrap_shop(text, text) from public;
revoke execute on function public.bootstrap_shop(text, text) from anon;
grant execute on function public.bootstrap_shop(text, text) to authenticated;

-- members n'a aucune policy INSERT directe : seul le propriétaire, via cette
-- RPC controlée, peut rattacher le compte tablette généré par admin.auth.admin.createUser.
create function public.add_device_membership(shop uuid, new_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not private.has_role(shop, 'owner') then
    raise exception 'réservé au propriétaire du salon';
  end if;
  insert into members (user_id, shop_id, role) values (new_user_id, shop, 'device');
end;
$$;

revoke all on function public.add_device_membership(uuid, uuid) from public;
revoke execute on function public.add_device_membership(uuid, uuid) from anon;
grant execute on function public.add_device_membership(uuid, uuid) to authenticated;

-- 0008 — Paiement mixte (ex. coupe à 25 € réglée 20 € espèces + 5 € carte).
--
-- `sales.payments` devient la source de vérité des encaissements :
--   [{"method":"cash","amount":20},{"method":"card","amount":5}]
-- `payment_method` reste pour le filtrage simple et vaut 'mixed' pour un split.
-- La cohérence des deux représentations est verrouillée par une contrainte CHECK.

-- Validation : tableau de 1 à 3 paiements, méthodes connues, montants > 0,
-- somme strictement égale au total, et cohérence avec payment_method
-- (1 paiement => même méthode ; plusieurs => 'mixed').
create or replace function private.payments_valid(payments jsonb, total numeric, method text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(payments) = 'array'
    and jsonb_array_length(payments) between 1 and 3
    and not exists (
      select 1 from jsonb_array_elements(payments) p
      where (p ->> 'method') not in ('cash', 'card', 'other')
        or jsonb_typeof(p -> 'amount') <> 'number'
        or (p ->> 'amount')::numeric <= 0
    )
    and (select sum((p ->> 'amount')::numeric) from jsonb_array_elements(payments) p) = total
    and case
      when jsonb_array_length(payments) = 1 then method = payments -> 0 ->> 'method'
      else method = 'mixed'
    end;
$$;

alter table public.sales add column payments jsonb;

-- Backfill des ventes existantes : l'ancien mode devient un paiement unique du
-- total. Le trigger d'immutabilité est suspendu le temps de la migration.
alter table public.sales disable trigger sales_guard_update;
update public.sales
  set payments = jsonb_build_array(
    jsonb_build_object('method', payment_method, 'amount', total)
  );
alter table public.sales enable trigger sales_guard_update;

alter table public.sales
  alter column payments set not null;

alter table public.sales
  drop constraint sales_payment_method_check;
alter table public.sales
  add constraint sales_payment_method_check
    check (payment_method in ('cash', 'card', 'other', 'mixed'));
alter table public.sales
  add constraint sales_payments_valid
    check (private.payments_valid(payments, total, payment_method));

-- Le détail des paiements est immuable, comme le reste de la vente.
create or replace function public.sales_guard_update()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.id <> old.id
    or new.shop_id <> old.shop_id
    or new.barber_id <> old.barber_id
    or new.payment_method <> old.payment_method
    or new.payments <> old.payments
    or new.total <> old.total
    or new.services_total <> old.services_total
    or new.created_at <> old.created_at
  then
    raise exception 'sales: seule la colonne status peut être modifiée';
  end if;
  return new;
end;
$$;

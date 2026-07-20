-- Produits & inventaire temps réel.
-- Le salon vend aussi des produits physiques (cires, shampooings...). Chaque
-- vente déduit le stock, chaque remboursement le recrédite, chaque mouvement
-- est journalisé. Le stock peut devenir négatif : une caisse ne bloque jamais
-- une vente (la tablette peut être hors-ligne avec un stock périmé).

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null,
  price numeric(8, 2) not null check (price >= 0),
  -- volontairement sans check >= 0 : la rupture assumée est un écart d'inventaire à corriger, pas une erreur
  stock int not null default 0,
  low_stock_threshold int not null default 0 check (low_stock_threshold >= 0),
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, shop_id)
);

create table public.stock_movements (
  id bigint generated always as identity primary key,
  shop_id uuid not null references public.shops (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  -- négatif = sortie de stock
  delta int not null check (delta <> 0),
  reason text not null check (reason in ('sale', 'refund', 'restock', 'correction')),
  sale_id uuid references public.sales (id) on delete set null,
  sale_item_id uuid references public.sale_items (id) on delete set null,
  actor uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

-- Idempotence : une ligne de vente ne peut produire qu'un seul mouvement par
-- raison, même si la file de sync offline rejoue l'upsert.
create unique index stock_movements_sale_item_unique
  on public.stock_movements (sale_item_id, reason)
  where sale_item_id is not null;

create index products_shop_idx on public.products (shop_id);
create index stock_movements_shop_idx on public.stock_movements (shop_id, created_at desc);
create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);

-- sale_items porte désormais des prestations ou des produits. Les snapshots
-- (name_snapshot / price_snapshot) valent pour les deux : l'historique reste
-- juste même si le produit est renommé ou supprimé.
alter table public.sale_items
  add column item_type text not null default 'service' check (item_type in ('service', 'product')),
  -- Même montage que service_id : la FK simple porte le ON DELETE SET NULL, la
  -- FK composite (anti cross-tenant) reste satisfaite dès que product_id est null.
  add column product_id uuid references public.products (id) on delete set null,
  add constraint sale_items_product_shop_fk
    foreign key (product_id, shop_id) references public.products (id, shop_id);

-- Base de calcul des commissions : les produits revendus ne comptent pas dans
-- la part du coiffeur. `total` reste le montant réellement encaissé.
alter table public.sales add column services_total numeric(8, 2) not null default 0;

-- Toutes les ventes antérieures sont 100 % prestations.
update public.sales set services_total = total;

-- Guard d'immutabilité : services_total rejoint les colonnes figées.
create or replace function public.sales_guard_update()
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
    or new.services_total <> old.services_total
    or new.created_at <> old.created_at
  then
    raise exception 'sales: seule la colonne status peut être modifiée';
  end if;
  return new;
end;
$$;

-- Sortie de stock à la vente.
-- security definer obligatoire : le rôle device n'a aucune policy UPDATE sur
-- products ni INSERT sur stock_movements.
create function public.sale_items_apply_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.item_type <> 'product' or new.product_id is null then
    return new;
  end if;

  insert into public.stock_movements (shop_id, product_id, delta, reason, sale_id, sale_item_id)
  values (new.shop_id, new.product_id, -new.qty, 'sale', new.sale_id, new.id)
  on conflict do nothing;

  -- faux si l'index d'idempotence a absorbé l'insert (re-sync) : ne pas décrémenter deux fois
  if found then
    update public.products set stock = stock - new.qty where id = new.product_id;
  end if;

  return new;
end;
$$;

-- Fonction trigger : jamais appelable en RPC (PostgREST l'exposerait sinon à anon).
revoke all on function public.sale_items_apply_stock() from public, anon, authenticated;

create trigger sale_items_apply_stock
  after insert on public.sale_items
  for each row execute function public.sale_items_apply_stock();

-- Retour en stock au remboursement.
create function public.sales_restock_on_refund()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
begin
  if old.status = 'refunded' or new.status <> 'refunded' then
    return new;
  end if;

  for item in
    select id, shop_id, product_id, qty
    from public.sale_items
    where sale_id = new.id and item_type = 'product' and product_id is not null
  loop
    insert into public.stock_movements (shop_id, product_id, delta, reason, sale_id, sale_item_id)
    values (item.shop_id, item.product_id, item.qty, 'refund', new.id, item.id)
    on conflict do nothing;

    if found then
      update public.products set stock = stock + item.qty where id = item.product_id;
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function public.sales_restock_on_refund() from public, anon, authenticated;

create trigger sales_restock_on_refund
  after update of status on public.sales
  for each row execute function public.sales_restock_on_refund();

-- Réappro / correction manuelle par le propriétaire : mouvement + stock dans la
-- même transaction. Seul chemin d'écriture manuelle sur products.stock.
create function public.adjust_stock(
  p_product_id uuid,
  p_delta int,
  p_reason text,
  p_note text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid;
  v_stock int;
begin
  if p_reason not in ('restock', 'correction') then
    raise exception 'adjust_stock: raison invalide';
  end if;
  if p_delta = 0 then
    raise exception 'adjust_stock: aucun changement';
  end if;

  select shop_id into v_shop_id from products where id = p_product_id;
  if v_shop_id is null then
    raise exception 'adjust_stock: produit introuvable';
  end if;
  if not private.has_role(v_shop_id, 'owner') then
    raise exception 'adjust_stock: réservé au propriétaire du salon';
  end if;

  update products set stock = stock + p_delta
  where id = p_product_id
  returning stock into v_stock;

  insert into stock_movements (shop_id, product_id, delta, reason, actor, note)
  values (v_shop_id, p_product_id, p_delta, p_reason, (select auth.uid()), nullif(btrim(p_note), ''));

  return v_stock;
end;
$$;

revoke all on function public.adjust_stock(uuid, int, text, text) from public;
revoke execute on function public.adjust_stock(uuid, int, text, text) from anon;
grant execute on function public.adjust_stock(uuid, int, text, text) to authenticated;

-- RLS ------------------------------------------------------------------

alter table public.products enable row level security;
alter table public.stock_movements enable row level security;

-- products : lecture pour les deux rôles (la caisse a besoin du catalogue et du
-- stock affiché) ; CRUD owner seul, à l'identique de services.
create policy "members read products" on public.products
  for select using (private.is_member(shop_id));

create policy "owner insert products" on public.products
  for insert with check (private.has_role(shop_id, 'owner'));

create policy "owner update products" on public.products
  for update using (private.has_role(shop_id, 'owner'));

create policy "owner delete products" on public.products
  for delete using (private.has_role(shop_id, 'owner'));

-- stock_movements : owner lit. Aucune policy d'écriture par design — les
-- mouvements ne naissent que des triggers et de adjust_stock (security definer).
create policy "owner read stock_movements" on public.stock_movements
  for select using (private.has_role(shop_id, 'owner'));

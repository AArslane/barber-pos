-- Seed de démo : un shop + coiffeurs + prestations.
-- Le rattachement du patron se fait après création de son compte auth :
--   insert into members (user_id, shop_id, role) values ('<auth user id>', '11111111-1111-1111-1111-111111111111', 'owner');
-- PIN de démo (jamais en clair en base) : Karim 111111, Sofiane 222222, Mehdi 333333.

insert into shops (id, name, slug) values
  ('11111111-1111-1111-1111-111111111111', 'Barbershop Démo', 'demo');

insert into barbers (id, shop_id, display_name, color, pin_hash) values
  ('b1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Karim', '#ef4444', crypt('111111', gen_salt('bf'))),
  ('b1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Sofiane', '#3b82f6', crypt('222222', gen_salt('bf'))),
  ('b1000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Mehdi', '#22c55e', crypt('333333', gen_salt('bf')));

insert into barber_private (barber_id, shop_id, commission_pct) values
  ('b1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 40),
  ('b1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 40),
  ('b1000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 50);

insert into services (shop_id, name, price, category, sort_order) values
  ('11111111-1111-1111-1111-111111111111', 'Coupe homme', 18, 'Coupe', 1),
  ('11111111-1111-1111-1111-111111111111', 'Coupe + barbe', 28, 'Coupe', 2),
  ('11111111-1111-1111-1111-111111111111', 'Coupe enfant', 12, 'Coupe', 3),
  ('11111111-1111-1111-1111-111111111111', 'Barbe', 12, 'Barbe', 1),
  ('11111111-1111-1111-1111-111111111111', 'Contours', 8, 'Barbe', 2),
  ('11111111-1111-1111-1111-111111111111', 'Soin visage', 15, 'Soins', 1),
  ('11111111-1111-1111-1111-111111111111', 'Coloration', 25, 'Soins', 2);

insert into products (shop_id, name, price, stock, low_stock_threshold, sort_order) values
  ('11111111-1111-1111-1111-111111111111', 'Cire coiffante', 12, 10, 3, 1),
  ('11111111-1111-1111-1111-111111111111', 'Shampooing', 9, 6, 2, 2),
  ('11111111-1111-1111-1111-111111111111', 'Huile à barbe', 15, 4, 2, 3);

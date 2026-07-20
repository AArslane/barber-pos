-- Nommage des tablettes.
-- Les comptes device ont un email généré (tablette-4879acf8-a1b2c3d4@...) :
-- illisible dès qu'un salon en a deux. Le propriétaire baptise la tablette au
-- moment où il génère le code ; le nom est porté par le code puis recopié sur
-- la membership à l'appairage.

alter table public.members add column label text;
alter table public.device_pairing_codes add column label text;

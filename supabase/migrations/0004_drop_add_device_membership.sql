-- L'appairage (lib/pairing.ts, service role) est désormais le seul chemin de
-- création des memberships device : la RPC exposée n'a plus de raison d'exister.
drop function public.add_device_membership(uuid, uuid);

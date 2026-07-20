-- Purge automatique des codes d'appairage expirés.
-- Un code expiré n'est jamais accepté (redeemPairingCode vérifie expires_at),
-- donc ce n'est pas une faille — mais laisser traîner des secrets morts en base
-- n'a aucun intérêt, et le va-et-vient des tests en accumule un par salon.

create extension if not exists pg_cron;

create or replace function public.purge_expired_pairing_codes()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.device_pairing_codes where expires_at < now();
$$;

-- Fonction de maintenance : jamais appelable depuis l'API.
revoke all on function public.purge_expired_pairing_codes() from public, anon, authenticated;

select cron.schedule(
  'purge-expired-pairing-codes',
  '0 * * * *',
  $$select public.purge_expired_pairing_codes()$$
);

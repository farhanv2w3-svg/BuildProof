-- Notification workers run as the service role (edge functions use
-- SUPABASE_SERVICE_ROLE_KEY). This project's public schema defaults grant
-- anon/authenticated/service_role only Dxtm, and 0012 revoked the outbox from
-- browser roles without granting the worker role, so PostgREST returned
-- 42501 for every delivery attempt.
--
-- Least privilege: the telegram worker needs SELECT (due rows), UPDATE
-- (sent/failed bookkeeping) and EXECUTE on the claim helper.

grant select, update on table public.registration_notification_outbox to service_role;
grant execute on function public.claim_registration_notification(uuid) to service_role;

-- Restore 0012's intent: 0019 blanket-granted SELECT to authenticated. RLS on
-- the outbox has no policies, so this changes no current behaviour but removes
-- the latent exposure if a policy is ever added.
revoke all on table public.registration_notification_outbox from anon, authenticated;

-- Web push worker: same class of failure on its own queue/subscription tables.
grant select, update on table public.push_delivery_outbox to service_role;
grant select, delete on table public.push_subscriptions to service_role;

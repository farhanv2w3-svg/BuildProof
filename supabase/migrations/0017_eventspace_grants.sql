-- ============================================================================
-- BuildProof — 0017_eventspace_grants.sql  (additive; privileges only)
--
-- 0015/0016 created RLS policies on the es_* EventSpace tables but never
-- granted table privileges to anon/authenticated. Postgres denies every query
-- before RLS is evaluated ("permission denied for table es_events"), which
-- broke the public EventSpace discovery page in production (found in
-- practical post-deploy testing, 2026-11-16).
--
-- This migration adds ONLY grants. RLS policies remain the actual authority:
-- without a matching policy a granted privilege still returns zero rows.
-- Existing data is not modified. No policy, table or function is altered.
-- ============================================================================

-- Public (anon) visitors: discovery + public event pages read these tables.
grant select on public.es_events           to anon;
grant select on public.es_event_rounds     to anon;
grant select on public.es_awards           to anon;
-- RLS has no anon policy on es_registrations, so this grant only prevents a
-- hard "permission denied" error; it still returns zero rows for anon.
grant select on public.es_registrations    to anon;

-- Authenticated users: the client performs direct CRUD; every operation is
-- governed by the RLS policies created in 0015/0016.
grant select, insert, update, delete on public.es_events              to authenticated;
grant select, insert, update, delete on public.es_event_rounds        to authenticated;
grant select, insert, delete         on public.es_event_staff         to authenticated;
grant select, insert, update, delete on public.es_event_teams         to authenticated;
grant select, insert, update, delete on public.es_event_team_members  to authenticated;
grant select, insert, update         on public.es_registrations       to authenticated;
grant select, insert, update, delete on public.es_submissions         to authenticated;
grant select, insert, delete         on public.es_submission_files    to authenticated;
grant select on public.es_submission_snapshots                        to authenticated;
grant select, insert, update, delete on public.es_judge_assignments   to authenticated;
grant select, insert, update, delete on public.es_evaluations         to authenticated;
grant select, insert, update, delete on public.es_awards              to authenticated;
grant select, insert, update, delete on public.es_results             to authenticated;
grant select, insert, delete         on public.es_announcements       to authenticated;
grant select, insert, update         on public.es_showcases           to authenticated;
-- Organiser status rows change only through SECURITY DEFINER RPCs
-- (es_review_organizer / es_withdraw_organizer_application), so authenticated
-- users get read + their own application insert only.
grant select, insert                 on public.es_event_organizers    to authenticated;

-- es_rate_limits stays intentionally ungranted: it is written exclusively by
-- the SECURITY DEFINER rate-limiter functions. This is unchanged from 0015.

-- ============================================================================
-- BuildProof — 0016_eventspace_integrity_checks.sql
--
-- MANUAL, NON-PRODUCTION verification for migration 0016.
-- Run against a scratch Supabase database AFTER applying 0001…0016, via psql
-- (the Supabase SQL editor cannot run the role-switching used here):
--
--   psql "<scratch db url>" -f supabase/tests/0016_eventspace_integrity_checks.sql
--
-- Everything runs in ONE transaction that ROLLBACKs at the end, so the script
-- leaves no data behind. Every assertion raises 'FAIL …' on violation; any
-- FAIL means the migration is wrong. Successful completion prints
-- '0016 integrity checks: ALL PASSED'.
--
-- RLS caveat: TypeScript unit tests CANNOT verify RLS, storage or trigger
-- behaviour. This script exists exactly for that. Run it after every change
-- to these policies/functions/triggers.
--
-- Assumptions (true on stock Supabase): the `postgres` role is a member of
-- `anon` and `authenticated`, and default privileges grant table access to
-- anon/authenticated. If SET ROLE fails, run first:
--   grant anon, authenticated to postgres;
--
-- RLS deny semantics: where a role HAS a table grant but no matching policy,
-- Postgres returns ZERO ROWS (not an error) — the assertions below test
-- row-visibility accordingly; absence of any grant is also treated as pass.
-- ============================================================================

begin;

-- ============================================================================
-- 0. FIXTURES (inserted as postgres; triggers still apply)
-- ============================================================================

create extension if not exists pgcrypto;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'org@test.local',   'x', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'm1@test.local',    'x', now(), now(), now()),
  ('33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'm2@test.local',    'x', now(), now(), now()),
  ('44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'judge@test.local', 'x', now(), now(), now()),
  ('55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated', 'other@test.local', 'x', now(), now(), now()),
  ('66666666-6666-6666-6666-666666666666', 'authenticated', 'authenticated', 'admin@test.local', 'x', now(), now(), now());

insert into public.profiles (id, full_name, email) values
  ('11111111-1111-1111-1111-111111111111', 'Organiser', 'org@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'Member One', 'm1@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'Member Two', 'm2@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'Judge', 'judge@test.local'),
  ('55555555-5555-5555-5555-555555555555', 'Bystander', 'other@test.local'),
  ('66666666-6666-6666-6666-666666666666', 'Platform Admin', null);

insert into public.user_roles (user_id, role)
values ('66666666-6666-6666-6666-666666666666', 'platform_admin');

-- Public event managed by the organiser (org). Criteria weights sum to 100.
insert into public.es_events (
  id, slug, created_by, title, category, short_description, institution_name,
  starts_at, ends_at, status, visibility, participation,
  evaluation_enabled, evaluation_criteria
) values (
  'aaaaaaaa-0000-0000-0000-000000000001', '0016-integrity-test',
  '11111111-1111-1111-1111-111111111111',
  'Integrity Check Event 2026', 'hackathon',
  'Automated fixture event for migration 0016 integrity checks.',
  'Test Institute of Technology',
  now() - interval '1 day', now() + interval '30 days',
  'published', 'public', 'both',
  true, '[{"name":"Impact","weight":50},{"name":"Execution","weight":50}]'::jsonb
);

-- Private event created by the BYSTANDER (so the organiser is NOT a manager).
insert into public.es_events (
  id, slug, created_by, title, category, short_description, institution_name,
  starts_at, ends_at, status, visibility, participation,
  evaluation_enabled, evaluation_criteria
) values (
  'aaaaaaaa-0000-0000-0000-000000000002', '0016-integrity-private',
  '55555555-5555-5555-5555-555555555555',
  'Private Check Event 2026', 'hackathon',
  'Automated fixture event owned by an unrelated user.',
  'Test Institute of Technology',
  now() - interval '1 day', now() + interval '30 days',
  'published', 'private', 'both',
  true, '[{"name":"Impact","weight":50},{"name":"Execution","weight":50}]'::jsonb
);

-- Fixture organiser row for the org (approved).
insert into public.es_event_organizers (user_id, org_name, official_email, position, reason, status)
values ('11111111-1111-1111-1111-111111111111', 'Test Institute', 'events@test.local',
        'Faculty coordinator', 'Fixture organiser for 0016 checks', 'approved');

-- Registrations: m1 + m2 + judge on the public event, m1 + m2 on the private
-- event (needed to own submissions there for the FK-consistent result fixtures).
insert into public.es_registrations (event_id, user_id, participation_type, status) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'individual', 'registered'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'individual', 'registered'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'individual', 'registered'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'individual', 'registered'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'individual', 'registered');

-- Team with both members active (for the team-membership tests). The member
-- inserts are trigger-checked like any other insert, so the INSERT guard
-- ('active' rows only for the user themselves) needs matching claims.
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into public.es_event_teams (id, event_id, name, leader_user_id, created_by)
values ('eeeeeeee-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000001', 'Fixture Team',
        '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222');

insert into public.es_event_team_members (team_id, user_id, member_role, status, invited_by) values
  ('eeeeeeee-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'leader', 'active',
   '22222222-2222-2222-2222-222222222222');
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
insert into public.es_event_team_members (team_id, user_id, member_role, status, invited_by) values
  ('eeeeeeee-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'member', 'active',
   '22222222-2222-2222-2222-222222222222');

-- ---- 0b. Real submissions (results FKs must point at existing rows) --------
-- 099: judge's individual submission on E1 (becomes the published result's project)
-- 098: m2's individual submission on E1 (evaluation fixture target)
-- 097: m1's individual submission on E2 (private-event result fixture)
select set_config('request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
insert into public.es_submissions (id, event_id, owner_type, owner_user_id, status, data, declarations)
values ('cccccccc-0000-0000-0000-000000000099',
        'aaaaaaaa-0000-0000-0000-000000000001',
        'individual', '44444444-4444-4444-4444-444444444444', 'draft', '{}', '{}');
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
insert into public.es_submissions (id, event_id, owner_type, owner_user_id, status, data, declarations)
values ('cccccccc-0000-0000-0000-000000000098',
        'aaaaaaaa-0000-0000-0000-000000000001',
        'individual', '33333333-3333-3333-3333-333333333333', 'draft', '{}', '{}');
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into public.es_submissions (id, event_id, owner_type, owner_user_id, status, data, declarations)
values ('cccccccc-0000-0000-0000-000000000097',
        'aaaaaaaa-0000-0000-0000-000000000002',
        'individual', '22222222-2222-2222-2222-222222222222', 'draft', '{}', '{}');

-- 099 must be organiser-accepted before a showcase draft may exist for it.
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
update public.es_submissions set status = 'accepted'
where id = 'cccccccc-0000-0000-0000-000000000099';

-- ---- 0c. UNPUBLISHED showcase draft on 099 (finding 3 fixture) -------------
select set_config('request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
set local role authenticated;
insert into public.es_showcases (event_id, submission_id, created_by, approved_title, approved_summary)
values ('aaaaaaaa-0000-0000-0000-000000000001',
        'cccccccc-0000-0000-0000-000000000099',
        '44444444-4444-4444-4444-444444444444',
        'Fixture Showcase Project Alpha',
        'An owner-drafted showcase summary that is not published yet.');
set local role none;

-- ---- 0d. Awards + results (must come after submissions: FK) ----------------
insert into public.es_awards (id, event_id, name, category) values
  ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Winner', 'winner'),
  ('dddddddd-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Winner', 'winner');

insert into public.es_results (id, event_id, award_id, submission_id, position, published, created_by) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   'dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000099', 1, true,
   '11111111-1111-1111-1111-111111111111'),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
   'dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000098', 2, false,
   '11111111-1111-1111-1111-111111111111'),
  ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002',
   'dddddddd-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000097', 1, true,
   '55555555-5555-5555-5555-555555555555');

-- ============================================================================
-- 1. FIX 1 — es_submission_window_open deadline authority
--    (now() is transaction-stable, so "exactly at deadline" is exact here)
-- ============================================================================

do $$
declare
  e uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
begin
  -- (a) before initial deadline, no resubmit window
  update public.es_events set submission_deadline = now() + interval '5 days',
    resubmit_until = null where id = e;
  if not public.es_submission_window_open(e, false) then
    raise exception 'FAIL 1a: initial submission should be open before the deadline';
  end if;
  if not public.es_submission_window_open(e, true) then
    raise exception 'FAIL 1a: resubmission should follow the deadline when resubmit_until is null';
  end if;

  -- (b) exactly at the deadline instant — still open
  update public.es_events set submission_deadline = now() where id = e;
  if not public.es_submission_window_open(e, false) then
    raise exception 'FAIL 1b: submission at exactly the deadline instant should be open';
  end if;

  -- (c) after the initial deadline, no resubmit window
  update public.es_events set submission_deadline = now() - interval '1 day',
    resubmit_until = null where id = e;
  if public.es_submission_window_open(e, false) then
    raise exception 'FAIL 1c: initial submission after the deadline must be closed';
  end if;
  if public.es_submission_window_open(e, true) then
    raise exception 'FAIL 1c: resubmission without resubmit_until must follow the deadline';
  end if;

  -- (d)+(f) deadline passed but resubmit_until in the future
  update public.es_events set submission_deadline = now() - interval '1 day',
    resubmit_until = now() + interval '5 days' where id = e;
  if public.es_submission_window_open(e, false) then
    raise exception 'FAIL 1f: resubmit_until must NEVER reopen the initial submission window';
  end if;
  if not public.es_submission_window_open(e, true) then
    raise exception 'FAIL 1d: eligible resubmission inside resubmit_until should be open';
  end if;

  -- (e) resubmission after its own deadline
  update public.es_events set resubmit_until = now() - interval '1 hour' where id = e;
  if public.es_submission_window_open(e, true) then
    raise exception 'FAIL 1e: resubmission after resubmit_until must be closed';
  end if;

  -- (g) non-published / disabled events never accept anything
  update public.es_events set status = 'completed', resubmit_until = now() + interval '5 days',
    submission_deadline = now() + interval '5 days' where id = e;
  if public.es_submission_window_open(e, false) or public.es_submission_window_open(e, true) then
    raise exception 'FAIL 1g: completed events must not accept submissions';
  end if;
  update public.es_events set status = 'cancelled' where id = e;
  if public.es_submission_window_open(e, false) then
    raise exception 'FAIL 1g: cancelled events must not accept submissions';
  end if;
  update public.es_events set status = 'published', submission_open = false where id = e;
  if public.es_submission_window_open(e, false) then
    raise exception 'FAIL 1g: submission_open = false must close the window';
  end if;
  update public.es_events set submission_open = true where id = e;
end $$;

-- resubmission eligibility: only revision-requested submissions may resubmit
do $$
declare
  e uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  s uuid := 'cccccccc-0000-0000-0000-000000000101';
begin
  update public.es_events set submission_deadline = now() + interval '5 days' where id = e;
  perform set_config('request.jwt.claims',
    '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

  -- fixture draft submission owned by m1
  insert into public.es_submissions (id, event_id, owner_type, owner_user_id, status, data, declarations)
  values (s, e, 'individual', '22222222-2222-2222-2222-222222222222', 'draft', '{}', '{}');

  -- draft -> resubmitted must be rejected (not revision-requested)
  begin
    update public.es_submissions set status = 'resubmitted' where id = s;
    raise exception 'FAIL 1h: non-revision-requested submission was resubmitted';
  exception
    when others then
      if sqlerrm like 'FAIL%' then raise; end if;
  end;

  -- organiser requests a revision, then the owner may resubmit
  perform set_config('request.jwt.claims',
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  update public.es_submissions set status = 'revision_requested', revision_reason = 'fixture'
    where id = s;
  perform set_config('request.jwt.claims',
    '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  update public.es_submissions set status = 'resubmitted', data = '{"fixed":true}'::jsonb where id = s;
  if (select status from public.es_submissions where id = s) <> 'resubmitted' then
    raise exception 'FAIL 1h: revision-requested submission could not be resubmitted';
  end if;
end $$;

-- ============================================================================
-- 2. FIX 2/8 — public results visibility + published-showcase join
-- ============================================================================

-- 2a. anon: nothing before results are published
set local role anon;
do $$
begin
  if (select count(*) from public.es_public_results
      where event_id = 'aaaaaaaa-0000-0000-0000-000000000001') <> 0 then
    raise exception 'FAIL 2a: anon saw results before results_published';
  end if;
end $$;

-- 2b. anon: only PUBLISHED rows of a published+public event with results on
set local role none;
update public.es_events set results_published = true
where id = 'aaaaaaaa-0000-0000-0000-000000000001';
set local role anon;
do $$
begin
  if (select count(*) from public.es_public_results
      where event_id = 'aaaaaaaa-0000-0000-0000-000000000001') <> 1 then
    raise exception 'FAIL 2b: anon should see exactly the 1 published result';
  end if;
  if (select count(*) from public.es_public_results
      where event_id = 'aaaaaaaa-0000-0000-0000-000000000001'
        and submission_id = 'cccccccc-0000-0000-0000-000000000098') <> 0 then
    raise exception 'FAIL 2b: unpublished result leaked to anon';
  end if;
end $$;

-- 2c. anon: private-event results never visible
do $$
begin
  if (select count(*) from public.es_public_results
      where event_id = 'aaaaaaaa-0000-0000-0000-000000000002') <> 0 then
    raise exception 'FAIL 2c: private-event result leaked to anon';
  end if;
end $$;

-- 2d. anon: no rows from the locked base table (RLS deny or no grant — both secure)
do $$
declare n integer;
begin
  begin
    select count(*) into n from public.es_results;
  exception
    when insufficient_privilege then n := 0; -- no grant at all — also secure
  end;
  if n <> 0 then
    raise exception 'FAIL 2d: anon saw % es_results rows directly', n;
  end if;
end $$;

-- 2e. authenticated non-organiser: no direct es_results rows; view still works
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
do $$
declare n integer;
begin
  begin
    select count(*) into n from public.es_results;
  exception
    when insufficient_privilege then n := 0;
  end;
  if n <> 0 then
    raise exception 'FAIL 2e: authenticated non-organiser saw % es_results rows', n;
  end if;
  if (select count(*) from public.es_public_results) <> 1 then
    raise exception 'FAIL 2e: authenticated non-organiser should see only the public result';
  end if;
end $$;

-- 2f. organiser: manages own event's results, cannot see others' events
set local role none;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.es_results
      where event_id = 'aaaaaaaa-0000-0000-0000-000000000001') <> 2 then
    raise exception 'FAIL 2f: organiser should see both own-event result rows';
  end if;
  if (select count(*) from public.es_results
      where event_id = 'aaaaaaaa-0000-0000-0000-000000000002') <> 0 then
    raise exception 'FAIL 2f: organiser saw another event''s results';
  end if;
end $$;
-- organiser can publish a result row of their own event
update public.es_results set published = true
where id = 'cccccccc-0000-0000-0000-000000000002';

-- 2g. after publishing both rows, anon sees 2
set local role none;
set local role anon;
do $$
begin
  if (select count(*) from public.es_public_results
      where event_id = 'aaaaaaaa-0000-0000-0000-000000000001') <> 2 then
    raise exception 'FAIL 2g: anon should see 2 results after organiser published both';
  end if;
end $$;

-- 2h. FINDING 3: unpublished showcase must contribute NULL project fields even
--     though its result row is published
do $$
begin
  if (select count(*) from public.es_public_results
      where event_id = 'aaaaaaaa-0000-0000-0000-000000000001'
        and submission_id = 'cccccccc-0000-0000-0000-000000000099') <> 1 then
    raise exception 'FAIL 2h: published result row should still be visible';
  end if;
  if (select count(*) from public.es_public_results
      where event_id = 'aaaaaaaa-0000-0000-0000-000000000001'
        and submission_id = 'cccccccc-0000-0000-0000-000000000099'
        and approved_title is not null) <> 0 then
    raise exception 'FAIL 2h: unpublished showcase content leaked through a published result';
  end if;
end $$;

-- 2i. after the owner approves AND the organiser publishes the showcase, the
--     same result row exposes the approved fields
set local role none;
select set_config('request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
set local role authenticated;
update public.es_showcases set status = 'owner_approved'
where submission_id = 'cccccccc-0000-0000-0000-000000000099';
set local role none;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
update public.es_showcases set status = 'published'
where submission_id = 'cccccccc-0000-0000-0000-000000000099';
set local role none;
set local role anon;
do $$
begin
  if (select count(*) from public.es_public_results
      where event_id = 'aaaaaaaa-0000-0000-0000-000000000001'
        and submission_id = 'cccccccc-0000-0000-0000-000000000099'
        and approved_title = 'Fixture Showcase Project Alpha') <> 1 then
    raise exception 'FAIL 2i: published showcase fields should be visible after approval + publication';
  end if;
end $$;

-- 2j. the public view must not expose organiser/private result fields
--     (r.note was removed in FIX 12; created_by/published were never included)
set local role none;
do $$
declare
  v_col text;
begin
  foreach v_col in array array['note', 'created_by', 'published'] loop
    begin
      execute format('select %I from public.es_public_results limit 1', v_col);
      raise exception 'FAIL 2j: public results view exposes column %', v_col;
    exception
      when undefined_column then null; -- expected: column absent from the view
    end;
  end loop;
end $$;

-- ============================================================================
-- 3. FIX 3 — es_notify_event_audience
-- ============================================================================

set local role none;

-- 3a. non-organiser cannot notify
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.es_notify_event_audience(
      'aaaaaaaa-0000-0000-0000-000000000001', 'participants', 'Test 3a');
    raise exception 'FAIL 3a: non-organiser delivered notifications';
  exception
    when others then
      if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- 3b. organiser cannot notify an event they do not manage (cross-event abuse)
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.es_notify_event_audience(
      'aaaaaaaa-0000-0000-0000-000000000002', 'participants', 'Test 3b');
    raise exception 'FAIL 3b: organiser notified an event they do not manage';
  exception
    when others then
      if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- 3c. invalid inputs are rejected: audience, title, and the full link matrix
do $$
begin
  begin
    perform public.es_notify_event_audience(
      'aaaaaaaa-0000-0000-0000-000000000001', 'everyone', 'Test 3c');
    raise exception 'FAIL 3c: invalid audience accepted';
  exception
    when others then
      if sqlerrm like 'FAIL%' then raise; end if;
  end;
  -- NULL audience must be explicitly rejected (SQL NOT IN alone passes NULL)
  begin
    perform public.es_notify_event_audience(
      'aaaaaaaa-0000-0000-0000-000000000001', null, 'Test 3c');
    raise exception 'FAIL 3c: NULL audience accepted';
  exception
    when others then
      if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    perform public.es_notify_event_audience(
      'aaaaaaaa-0000-0000-0000-000000000001', 'participants', repeat('x', 201));
    raise exception 'FAIL 3c: over-long title accepted';
  exception
    when others then
      if sqlerrm like 'FAIL%' then raise; end if;
  end;
  -- link matrix: every non-plain-path form must be rejected
  begin
    perform public.es_notify_event_audience(
      'aaaaaaaa-0000-0000-0000-000000000001', 'participants', 'Test 3c', null,
      'https://evil.example');
    raise exception 'FAIL 3c: absolute https URL accepted';
  exception
    when others then
      if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    perform public.es_notify_event_audience(
      'aaaaaaaa-0000-0000-0000-000000000001', 'participants', 'Test 3c', null,
      'http://evil.example/path');
    raise exception 'FAIL 3c: absolute http URL accepted';
  exception
    when others then
      if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    perform public.es_notify_event_audience(
      'aaaaaaaa-0000-0000-0000-000000000001', 'participants', 'Test 3c', null,
      '//evil.example/path');
    raise exception 'FAIL 3c: protocol-relative URL accepted';
  exception
    when others then
      if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    perform public.es_notify_event_audience(
      'aaaaaaaa-0000-0000-0000-000000000001', 'participants', 'Test 3c', null,
      'javascript:alert(1)');
    raise exception 'FAIL 3c: javascript URL accepted';
  exception
    when others then
      if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    perform public.es_notify_event_audience(
      'aaaaaaaa-0000-0000-0000-000000000001', 'participants', 'Test 3c', null,
      'data:text/html,<script>alert(1)</script>');
    raise exception 'FAIL 3c: data URL accepted';
  exception
    when others then
      if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    perform public.es_notify_event_audience(
      'aaaaaaaa-0000-0000-0000-000000000001', 'participants', 'Test 3c', null,
      '\eventspace\traversal');
    raise exception 'FAIL 3c: backslash path accepted';
  exception
    when others then
      if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    perform public.es_notify_event_audience(
      'aaaaaaaa-0000-0000-0000-000000000001', 'participants', 'Test 3c', null,
      '/eventspace/' || chr(10) || 'bad');
    raise exception 'FAIL 3c: control-character path accepted';
  exception
    when others then
      if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    perform public.es_notify_event_audience(
      'aaaaaaaa-0000-0000-0000-000000000001', 'participants', 'Test 3c', null,
      '/eventspace/%zzbroken');
    raise exception 'FAIL 3c: malformed percent-encoding accepted';
  exception
    when others then
      if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    perform public.es_notify_event_audience(
      'aaaaaaaa-0000-0000-0000-000000000001', 'participants', 'Test 3c', null,
      '   ');
    raise exception 'FAIL 3c: empty/blank path accepted';
  exception
    when others then
      if sqlerrm like 'FAIL%' then raise; end if;
  end;
  -- a legitimate internal path with a query string must still be accepted
  perform public.es_notify_event_audience(
    'aaaaaaaa-0000-0000-0000-000000000001', 'participants', 'Test 3c valid link',
    'body', '/eventspace/0016-integrity-test?tab=results');
end $$;

-- 3d. organiser notifies participants: exactly the registered users
do $$
declare n integer;
begin
  n := public.es_notify_event_audience(
    'aaaaaaaa-0000-0000-0000-000000000001', 'participants',
    'Integrity Test: announcement', 'Fixture body', '/eventspace/0016-integrity-test');
  if n <> 3 then
    raise exception 'FAIL 3d: expected 3 participant recipients, got %', n;
  end if;
  n := public.es_notify_event_audience(
    'aaaaaaaa-0000-0000-0000-000000000001', 'judges', 'Integrity Test: judges early');
  if n <> 0 then
    raise exception 'FAIL 3d: expected 0 judge recipients (no assignment yet), got %', n;
  end if;
end $$;

-- 3e. every notified user is THIS event's participant — verify server-side rows
set local role none;
do $$
begin
  if (select count(*) from public.notifications
      where type = 'es_announcement'
        and title like 'Integrity Test: announcement%') <> 3 then
    raise exception 'FAIL 3e: expected exactly 3 delivered notifications';
  end if;
  if exists (
    select 1 from public.notifications n
    where n.type = 'es_announcement'
      and not exists (
        select 1 from public.es_registrations r
        where r.user_id = n.user_id
          and r.event_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      )
  ) then
    raise exception 'FAIL 3e: notification delivered outside the event audience';
  end if;
end $$;

-- ============================================================================
-- 4. FIX 4 — final evaluation immutability
-- ============================================================================

-- 4a. judge assignment on the fixture submission 098 (owned by m2)
set local role none;
insert into public.es_judge_assignments (id, event_id, judge_user_id, submission_id, assigned_by)
values ('bbbbbbbb-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000001',
        '44444444-4444-4444-4444-444444444444',
        'cccccccc-0000-0000-0000-000000000098',
        '11111111-1111-1111-1111-111111111111');

-- 4b. judge saves a draft, then submits the final evaluation
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
insert into public.es_evaluations (assignment_id, scores, private_notes, is_draft)
values ('bbbbbbbb-0000-0000-0000-000000000001',
        '[{"criterion":"Impact","score":8},{"criterion":"Execution","score":7}]'::jsonb,
        'private fixture note', true);
update public.es_evaluations set is_draft = false
where assignment_id = 'bbbbbbbb-0000-0000-0000-000000000001';
do $$
begin
  if (select total_score from public.es_evaluations
      where assignment_id = 'bbbbbbbb-0000-0000-0000-000000000001') <> 75.0 then
    raise exception 'FAIL 4b: server-computed total should be 75';
  end if;
  if (select status from public.es_judge_assignments
      where id = 'bbbbbbbb-0000-0000-0000-000000000001') <> 'completed' then
    raise exception 'FAIL 4b: final evaluation must complete the assignment';
  end if;
end $$;

-- 4c. judge CANNOT rewrite the final evaluation
do $$
begin
  begin
    update public.es_evaluations
    set private_notes = 'tampered',
        scores = '[{"criterion":"Impact","score":10},{"criterion":"Execution","score":10}]'::jsonb
    where assignment_id = 'bbbbbbbb-0000-0000-0000-000000000001';
    raise exception 'FAIL 4c: judge rewrote a final evaluation';
  exception
    when others then
      if sqlerrm not like 'Final evaluations are locked%' then
        raise exception 'FAIL 4c: unexpected error: %', sqlerrm;
      end if;
  end;
end $$;

-- 4d. judge cannot silently reopen a final evaluation as draft
do $$
begin
  begin
    update public.es_evaluations set is_draft = true
    where assignment_id = 'bbbbbbbb-0000-0000-0000-000000000001';
    raise exception 'FAIL 4d: judge reopened a final evaluation';
  exception
    when others then
      if sqlerrm not like 'Final evaluations are locked%' then
        raise exception 'FAIL 4d: unexpected error: %', sqlerrm;
      end if;
  end;
end $$;

-- 4e. organiser publishes results → even the platform admin is blocked
set local role none;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
update public.es_events set results_published = true
where id = 'aaaaaaaa-0000-0000-0000-000000000001';
set local role none;
select set_config('request.jwt.claims',
  '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  begin
    update public.es_evaluations set private_notes = 'admin fix'
    where assignment_id = 'bbbbbbbb-0000-0000-0000-000000000001';
    raise exception 'FAIL 4e: admin corrected an evaluation while results were published';
  exception
    when others then
      if sqlerrm not like 'Results are published%' then
        raise exception 'FAIL 4e: unexpected error: %', sqlerrm;
      end if;
  end;
end $$;

-- 4f. organiser unpublishes → admin correction allowed AND audited
set local role none;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
update public.es_events set results_published = false
where id = 'aaaaaaaa-0000-0000-0000-000000000001';
set local role none;
select set_config('request.jwt.claims',
  '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
set local role authenticated;
update public.es_evaluations set private_notes = 'admin correction (typo fix)'
where assignment_id = 'bbbbbbbb-0000-0000-0000-000000000001';
set local role none;
do $$
begin
  if not exists (
    select 1 from public.audit_logs
    where action = 'es_evaluation_admin_correction'
      and entity_id = (select id from public.es_evaluations
                       where assignment_id = 'bbbbbbbb-0000-0000-0000-000000000001')
  ) then
    raise exception 'FAIL 4f: admin correction was not written to audit_logs';
  end if;
  if (select private_notes from public.es_evaluations
      where assignment_id = 'bbbbbbbb-0000-0000-0000-000000000001')
      not like 'admin correction%' then
    raise exception 'FAIL 4f: admin correction was not applied';
  end if;
end $$;

-- 3f. judge audience now that the judge assignment exists
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n integer;
begin
  n := public.es_notify_event_audience(
    'aaaaaaaa-0000-0000-0000-000000000001', 'judges', 'Integrity Test: judges notice');
  if n <> 1 then
    raise exception 'FAIL 3f: expected 1 judge recipient, got %', n;
  end if;
end $$;

-- 3g. announcement RATE LIMIT EXCEEDED: 4 calls were consumed so far
--     (3c valid-link + 3d participants + 3d judges-early + 3f judges). The
--     fixed allowance is 30/hour per event, so the next 26 calls succeed and
--     the 27th must be rejected.
set local role none;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
do $$
declare i integer;
begin
  for i in 1..26 loop
    begin
      perform public.es_notify_event_audience(
        'aaaaaaaa-0000-0000-0000-000000000001', 'participants',
        'Integrity Test: flood ' || i);
    exception
    when others then
      raise exception 'FAIL 3g: call % of 26 unexpectedly rejected: %', i, sqlerrm;
    end;
  end loop;
  begin
    perform public.es_notify_event_audience(
      'aaaaaaaa-0000-0000-0000-000000000001', 'participants',
      'Integrity Test: flood over limit');
    raise exception 'FAIL 3g: announcement beyond the 30/hour limit was accepted';
  exception
    when others then
      if sqlerrm not like 'Too many notifications%' then
        raise exception 'FAIL 3g: unexpected error: %', sqlerrm;
      end if;
  end;
end $$;

-- ============================================================================
-- 5. FIX 5 — one team submission per (event, team)
-- ============================================================================

set local role none;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
-- m1 (team leader) creates the team submission
insert into public.es_submissions (id, event_id, owner_type, owner_user_id, team_id, status, data, declarations)
values ('cccccccc-0000-0000-0000-000000000103',
        'aaaaaaaa-0000-0000-0000-000000000001',
        'team', '22222222-2222-2222-2222-222222222222',
        'eeeeeeee-0000-0000-0000-000000000001', 'draft', '{}', '{}');
set local role none;
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
-- m2 (active member, different owner_user_id) must NOT create a second one
do $$
begin
  begin
    insert into public.es_submissions (id, event_id, owner_type, owner_user_id, team_id, status, data, declarations)
    values ('cccccccc-0000-0000-0000-000000000104',
            'aaaaaaaa-0000-0000-0000-000000000001',
            'team', '33333333-3333-3333-3333-333333333333',
            'eeeeeeee-0000-0000-0000-000000000001', 'draft', '{}', '{}');
    raise exception 'FAIL 5: second team submission for the same (event, team) was accepted';
  exception
    when unique_violation then null; -- expected
    when others then
      if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;
-- individual submissions unaffected: m2 can still create their own draft on
-- the other event (m2 already owns 098 on E1 — uniqueness is per event)
insert into public.es_submissions (id, event_id, owner_type, owner_user_id, status, data, declarations)
values ('cccccccc-0000-0000-0000-000000000105',
        'aaaaaaaa-0000-0000-0000-000000000002',
        'individual', '33333333-3333-3333-3333-333333333333', 'draft', '{}', '{}');

-- 5b. submission snapshots are immutable for everyone (FIX 3 verification +
--     0015 design: snapshots have only a stakeholder SELECT policy; the
--     submit/resubmit transition of 0101 wrote exactly one snapshot)
set local role none;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.es_submission_snapshots
      where submission_id = 'cccccccc-0000-0000-0000-000000000101') <> 1 then
    raise exception 'FAIL 5b: expected exactly 1 snapshot for the resubmitted fixture';
  end if;
  -- INSERT with no policy must be rejected outright
  begin
    insert into public.es_submission_snapshots (submission_id, version, data)
    values ('cccccccc-0000-0000-0000-000000000101', 99, '{"forged":true}'::jsonb);
    raise exception 'FAIL 5b: snapshot insert was allowed';
  exception
    when others then
      if sqlerrm not like '%row-level security%' then
        raise exception 'FAIL 5b: unexpected insert error: %', sqlerrm;
      end if;
  end;
end $$;
-- UPDATE/DELETE have no policy: the row is invisible, so these change nothing
update public.es_submission_snapshots
set data = '{"forged":true}'::jsonb
where submission_id = 'cccccccc-0000-0000-0000-000000000101';
delete from public.es_submission_snapshots
where submission_id = 'cccccccc-0000-0000-0000-000000000101';
set local role none;
do $$
begin
  if (select count(*) from public.es_submission_snapshots
      where submission_id = 'cccccccc-0000-0000-0000-000000000101') <> 1 then
    raise exception 'FAIL 5b: snapshot row was altered or removed';
  end if;
  if (select data::text from public.es_submission_snapshots
      where submission_id = 'cccccccc-0000-0000-0000-000000000101') like '%forged%' then
    raise exception 'FAIL 5b: snapshot data was tampered with';
  end if;
end $$;

-- ============================================================================
-- 6. FINDINGS 1 + 2 — organiser-registry RLS + function execute grants
-- ============================================================================

set local role none;

-- 6a. anon: organiser applications are invisible (RLS now ENABLEd)
set local role anon;
do $$
declare n integer;
begin
  begin
    select count(*) into n from public.es_event_organizers;
  exception
    when insufficient_privilege then n := 0;
  end;
  if n <> 0 then
    raise exception 'FAIL 6a: anon saw % organiser application rows', n;
  end if;
end $$;

-- 6b. authenticated non-self: only their own row (or none)
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.es_event_organizers) <> 0 then
    raise exception 'FAIL 6b: unrelated user saw organiser applications';
  end if;
end $$;

-- 6c. the applicant sees their own row
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.es_event_organizers
      where user_id = '11111111-1111-1111-1111-111111111111') <> 1 then
    raise exception 'FAIL 6c: organiser cannot see their own application row';
  end if;
end $$;

-- 6d. authenticated insert exercises the es_rate_ok grant inside the policy
--     (0015:246) — before FIX 7 this failed with a permission error
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into public.es_event_organizers (user_id, org_name, official_email, position, reason, status)
values ('22222222-2222-2222-2222-222222222222', 'Member One Org', 'm1@org.test',
        'Student coordinator', 'Fixture application to verify policy-level rate limiter grants.',
        'pending');

-- 6e. admin RPC exercises the es_review_organizer grant (0015:547 revocation)
select set_config('request.jwt.claims',
  '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
do $$
begin
  perform public.es_review_organizer(
    '22222222-2222-2222-2222-222222222222', 'rejected', 'fixture');
exception
when others then
  raise exception 'FAIL 6e: admin could not review application: %', sqlerrm;
end $$;
do $$
begin
  if (select status from public.es_event_organizers
      where user_id = '22222222-2222-2222-2222-222222222222') <> 'rejected' then
    raise exception 'FAIL 6e: review decision was not applied';
  end if;
end $$;

-- 6f. withdraw RPC exercises the es_withdraw_organizer_application grant.
--     m2 has NO existing es_event_organizers row (the PK is user_id, so the
--     fixture avoids a user whose application row already exists — the
--     earlier m1 reuse would have collided with m1's rejected row from 6e).
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
insert into public.es_event_organizers (user_id, org_name, official_email, position, reason, status)
values ('33333333-3333-3333-3333-333333333333', 'Member Two Org', 'm2@org.test',
        'Student coordinator', 'Fixture application for the withdraw test path, unused user.',
        'pending');
do $$
begin
  perform public.es_withdraw_organizer_application();
exception
when others then
  raise exception 'FAIL 6f: organiser could not withdraw application: %', sqlerrm;
end $$;
do $$
begin
  -- m2 had no prior row; withdraw deletes the pending row, so the user must
  -- now have zero application rows at all.
  if exists (
    select 1 from public.es_event_organizers
    where user_id = '33333333-3333-3333-3333-333333333333'
  ) then
    raise exception 'FAIL 6f: withdrawn pending application still present';
  end if;
end $$;

-- 6g. es_rate_ok is HARDENED (FIX 10 + issue A): fixed actions, exact fixed
--     params, caller-owned CANONICAL buckets. Anon stays denied.
set local role none;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  v_ok boolean := true;
  i integer;
begin
  -- (a) the reported bypass: a NEGATIVE interval must be rejected
  begin
    perform public.es_rate_ok('es_eval:22222222-2222-2222-2222-222222222222',
                              200, interval '-1 hour');
    raise exception 'FAIL 6g(a): negative interval accepted (counter reset bypass)';
  exception
    when others then
      if sqlerrm not like 'Rate-limit parameters must match%' then
        raise exception 'FAIL 6g(a): unexpected error: %', sqlerrm;
      end if;
  end;

  -- (b) an oversized maximum must be rejected
  begin
    perform public.es_rate_ok('es_eval:22222222-2222-2222-2222-222222222222',
                              2147483647, interval '1 hour');
    raise exception 'FAIL 6g(b): oversized maximum accepted';
  exception
    when others then
      if sqlerrm not like 'Rate-limit parameters must match%' then
        raise exception 'FAIL 6g(b): unexpected error: %', sqlerrm;
      end if;
  end;

  -- (c) unknown / fabricated actions must be rejected
  begin
    perform public.es_rate_ok('es_check_direct', 5, interval '1 hour');
    raise exception 'FAIL 6g(c): unknown rate-limit action accepted';
  exception
    when others then
      if sqlerrm not like 'Unknown rate-limit action%' then
        raise exception 'FAIL 6g(c): unexpected error: %', sqlerrm;
      end if;
  end;

  -- (d) another user's bucket must be rejected
  begin
    perform public.es_rate_ok('es_eval:33333333-3333-3333-3333-333333333333',
                              200, interval '1 hour');
    raise exception 'FAIL 6g(d): bucket addressed another user';
  exception
    when others then
      if sqlerrm not like 'Rate-limit bucket must address%' then
        raise exception 'FAIL 6g(d): unexpected error: %', sqlerrm;
      end if;
  end;

  -- (e) issue A: ARBITRARY SUFFIXES must be rejected — the bucket format is
  --     exactly '<action>:<uid>'; extra components cannot mint new buckets
  begin
    perform public.es_rate_ok('es_eval:22222222-2222-2222-2222-222222222222:extra1',
                              200, interval '1 hour');
    raise exception 'FAIL 6g(e): bucket with an arbitrary extra suffix accepted';
  exception
    when others then
      if sqlerrm not like 'Malformed rate-limit bucket%' then
        raise exception 'FAIL 6g(e): unexpected error: %', sqlerrm;
      end if;
  end;

  -- (f) NULL / empty / malformed buckets must be rejected
  begin
    perform public.es_rate_ok(null, 200, interval '1 hour');
    raise exception 'FAIL 6g(f): NULL bucket accepted';
  exception
    when others then
      if sqlerrm not like 'Malformed rate-limit bucket%' then
        raise exception 'FAIL 6g(f): unexpected error: %', sqlerrm;
      end if;
  end;
  begin
    perform public.es_rate_ok('', 200, interval '1 hour');
    raise exception 'FAIL 6g(f): empty bucket accepted';
  exception
    when others then
      if sqlerrm not like 'Malformed rate-limit bucket%' then
        raise exception 'FAIL 6g(f): unexpected error: %', sqlerrm;
      end if;
  end;
  begin
    perform public.es_rate_ok('es_eval', 200, interval '1 hour');
    raise exception 'FAIL 6g(f): bucket without a caller part accepted';
  exception
    when others then
      if sqlerrm not like 'Malformed rate-limit bucket%' then
        raise exception 'FAIL 6g(f): unexpected error: %', sqlerrm;
      end if;
  end;

  -- (g) NULL limits and windows must be rejected
  begin
    perform public.es_rate_ok('es_eval:22222222-2222-2222-2222-222222222222',
                              null, interval '1 hour');
    raise exception 'FAIL 6g(g): NULL maximum accepted';
  exception
    when others then
      if sqlerrm not like 'Rate-limit parameters must match%' then
        raise exception 'FAIL 6g(g): unexpected error: %', sqlerrm;
      end if;
  end;
  begin
    perform public.es_rate_ok('es_eval:22222222-2222-2222-2222-222222222222',
                              200, null);
    raise exception 'FAIL 6g(g): NULL window accepted';
  exception
    when others then
      if sqlerrm not like 'Rate-limit parameters must match%' then
        raise exception 'FAIL 6g(g): unexpected error: %', sqlerrm;
      end if;
  end;

  -- (h) exact fixed params on the caller's own canonical bucket work — and
  --     the counter really counts every legitimate call up to the limit
  for i in 1..201 loop
    v_ok := public.es_rate_ok('es_eval:22222222-2222-2222-2222-222222222222',
                              200, interval '1 hour');
    exit when not v_ok;
  end loop;
  if v_ok then
    raise exception 'FAIL 6g(h): counter never reached the fixed limit of 200';
  end if;
end $$;
-- the counter check needs the base table, which authenticated cannot read
set local role none;
do $$
begin
  if (select hits from public.es_rate_limits
      where bucket = 'es_eval:22222222-2222-2222-2222-222222222222') <> 201 then
    raise exception 'FAIL 6g(h): counter did not record every legitimate call';
  end if;
  -- only canonical system buckets may exist (no fabricated buckets left by
  -- the caller). NOTE: in LIKE patterns '_' is a single-character wildcard —
  -- the earlier `bucket NOT LIKE 'es_%'` check was meaningless; use a regexp
  -- over the full canonical action set instead.
  if exists (
    select 1 from public.es_rate_limits
    where bucket !~ '^es_(org_apply|event_create|team_create|team_invite|register|submission_create|file_up|eval|notify):[0-9a-f-]{36}$'
  ) then
    raise exception 'FAIL 6g: non-canonical bucket rows were created';
  end if;
end $$;
set local role anon;
do $$
begin
  begin
    perform public.es_rate_ok('es_eval:44444444-4444-4444-4444-444444444444',
                              200, interval '1 hour');
    raise exception 'FAIL 6g: anon was able to execute es_rate_ok';
  exception
    when insufficient_privilege then null; -- expected
  end;
  -- the internal per-event limiter must not be callable by anon either
  begin
    perform public.es_rate_ok_event('aaaaaaaa-0000-0000-0000-000000000001');
    raise exception 'FAIL 6g: anon was able to execute es_rate_ok_event';
  exception
    when insufficient_privilege then null; -- expected
  end;
end $$;
-- ...and not by authenticated users either (it is owner-only by design)
set local role none;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.es_rate_ok_event('aaaaaaaa-0000-0000-0000-000000000001');
    raise exception 'FAIL 6g: authenticated user executed the internal es_rate_ok_event';
  exception
    when insufficient_privilege then null; -- expected
  end;
end $$;

-- ============================================================================
-- 7. FINDING 4 — team-membership immutability
-- ============================================================================

set local role none;
-- Leader invites the judge to the fixture team (invited, not yet active)
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
insert into public.es_event_team_members (team_id, user_id, member_role, status, invited_by)
values ('eeeeeeee-0000-0000-0000-000000000001',
        '44444444-4444-4444-4444-444444444444', 'member', 'invited',
        '22222222-2222-2222-2222-222222222222');

-- 7a. the invitee CANNOT move their membership row to another team
select set_config('request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
do $$
begin
  begin
    update public.es_event_team_members
    set team_id = 'eeeeeeee-0000-0000-0000-000000009999'
    where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
      and user_id = '44444444-4444-4444-4444-444444444444';
    raise exception 'FAIL 7a: membership row was moved to another team';
  exception
    when others then
      if sqlerrm not like 'Membership cannot be moved%' then
        raise exception 'FAIL 7a: unexpected error: %', sqlerrm;
      end if;
  end;
end $$;

-- 7b. …nor reassign it to a different user
do $$
begin
  begin
    update public.es_event_team_members
    set user_id = '55555555-5555-5555-5555-555555555555'
    where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
      and user_id = '44444444-4444-4444-4444-444444444444';
    raise exception 'FAIL 7b: membership row was reassigned to another user';
  exception
    when others then
      if sqlerrm not like 'Membership cannot be reassigned%' then
        raise exception 'FAIL 7b: unexpected error: %', sqlerrm;
      end if;
  end;
end $$;

-- 7c. a member cannot change their own role or invitation metadata
do $$
begin
  begin
    update public.es_event_team_members
    set member_role = 'leader'
    where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
      and user_id = '44444444-4444-4444-4444-444444444444';
    raise exception 'FAIL 7c: member escalated their own role';
  exception
    when others then
      if sqlerrm not like 'Only the team leader or an organiser%' then
        raise exception 'FAIL 7c: unexpected error: %', sqlerrm;
      end if;
  end;
  begin
    update public.es_event_team_members
    set invited_by = '33333333-3333-3333-3333-333333333333'
    where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
      and user_id = '44444444-4444-4444-4444-444444444444';
    raise exception 'FAIL 7c: member changed invitation metadata';
  exception
    when others then
      if sqlerrm not like 'Only the team leader or an organiser%' then
        raise exception 'FAIL 7c: unexpected error: %', sqlerrm;
      end if;
  end;
end $$;

-- 7d. accepting the invitation (status change) is still allowed for the member
update public.es_event_team_members
set status = 'active', responded_at = now()
where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
  and user_id = '44444444-4444-4444-4444-444444444444';
do $$
begin
  if (select status from public.es_event_team_members
      where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
        and user_id = '44444444-4444-4444-4444-444444444444') <> 'active' then
    raise exception 'FAIL 7d: legitimate invitation acceptance was blocked';
  end if;
end $$;

-- 7e. an ordinary (non-leader) member cannot change invitation metadata:
--     (a) editing their OWN row's invited_by passes RLS but the trigger blocks it
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
do $$
begin
  begin
    update public.es_event_team_members
    set invited_by = '33333333-3333-3333-3333-333333333333'
    where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
      and user_id = '33333333-3333-3333-3333-333333333333';
    raise exception 'FAIL 7e: ordinary member changed their own invitation metadata';
  exception
    when others then
      if sqlerrm not like 'Only the team leader or an organiser%' then
        raise exception 'FAIL 7e: unexpected error: %', sqlerrm;
      end if;
  end;
end $$;
-- (b) editing ANOTHER member's row is invisible via RLS: zero rows updated,
--     and the other row must remain untouched
update public.es_event_team_members
set invited_by = '33333333-3333-3333-3333-333333333333'
where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
  and user_id = '44444444-4444-4444-4444-444444444444';
do $$
begin
  if (select invited_by from public.es_event_team_members
      where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
        and user_id = '44444444-4444-4444-4444-444444444444')
      <> '22222222-2222-2222-2222-222222222222' then
    raise exception 'FAIL 7e: ordinary member edited another member''s metadata';
  end if;
end $$;

-- 7f. even the team leader cannot move a membership row between teams
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$
begin
  begin
    update public.es_event_team_members
    set team_id = 'eeeeeeee-0000-0000-0000-000000009999'
    where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
      and user_id = '44444444-4444-4444-4444-444444444444';
    raise exception 'FAIL 7f: leader moved a membership row between teams';
  exception
    when others then
      if sqlerrm not like 'Membership cannot be moved%' then
        raise exception 'FAIL 7f: unexpected error: %', sqlerrm;
      end if;
  end;
end $$;

-- 7g. a member can leave, but cannot self-reactivate afterwards (FIX 11)
select set_config('request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
update public.es_event_team_members
set status = 'left', responded_at = now()
where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
  and user_id = '44444444-4444-4444-4444-444444444444';
do $$
begin
  if (select status from public.es_event_team_members
      where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
        and user_id = '44444444-4444-4444-4444-444444444444') <> 'left' then
    raise exception 'FAIL 7g: member could not leave the team';
  end if;
end $$;
do $$
begin
  begin
    update public.es_event_team_members
    set status = 'active'
    where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
      and user_id = '44444444-4444-4444-4444-444444444444';
    raise exception 'FAIL 7g: member reactivated themselves after leaving';
  exception
    when others then
      if sqlerrm not like 'Membership status change from left to active%' then
        raise exception 'FAIL 7g: unexpected error: %', sqlerrm;
      end if;
  end;
end $$;

-- 7h. the leader re-invites a left member; an invitee can only accept or
--     decline — invited -> left is not permitted
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
update public.es_event_team_members
set status = 'invited', responded_at = null
where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
  and user_id = '44444444-4444-4444-4444-444444444444';
select set_config('request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
do $$
begin
  begin
    update public.es_event_team_members
    set status = 'left'
    where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
      and user_id = '44444444-4444-4444-4444-444444444444';
    raise exception 'FAIL 7h: invitee performed invited -> left';
  exception
    when others then
      if sqlerrm not like 'Membership status change from invited to left%' then
        raise exception 'FAIL 7h: unexpected error: %', sqlerrm;
      end if;
  end;
end $$;

-- 7i. the invitee can decline; a declined member cannot self-reactivate
update public.es_event_team_members
set status = 'declined', responded_at = now()
where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
  and user_id = '44444444-4444-4444-4444-444444444444';
do $$
begin
  begin
    update public.es_event_team_members
    set status = 'active'
    where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
      and user_id = '44444444-4444-4444-4444-444444444444';
    raise exception 'FAIL 7i: declined member reactivated themselves';
  exception
    when others then
      if sqlerrm not like 'Membership status change from declined to active%' then
        raise exception 'FAIL 7i: unexpected error: %', sqlerrm;
      end if;
  end;
end $$;

-- 7j. the leader re-invites a declined member, then cancels the invitation
--     (invited -> removed); the target cannot self-reactivate
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
update public.es_event_team_members
set status = 'invited', responded_at = null
where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
  and user_id = '44444444-4444-4444-4444-444444444444';
update public.es_event_team_members
set status = 'removed'
where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
  and user_id = '44444444-4444-4444-4444-444444444444';
select set_config('request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
do $$
begin
  begin
    update public.es_event_team_members
    set status = 'active'
    where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
      and user_id = '44444444-4444-4444-4444-444444444444';
    raise exception 'FAIL 7j: removed member reactivated themselves';
  exception
    when others then
      if sqlerrm not like 'Membership status change from removed to active%' then
        raise exception 'FAIL 7j: unexpected error: %', sqlerrm;
      end if;
  end;
end $$;

-- 7k. a member cannot self-remove (leaving is 'left', not 'removed')
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
do $$
begin
  begin
    update public.es_event_team_members
    set status = 'removed'
    where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
      and user_id = '33333333-3333-3333-3333-333333333333';
    raise exception 'FAIL 7k: member performed self-removal';
  exception
    when others then
      if sqlerrm not like 'Membership status change from active to removed%' then
        raise exception 'FAIL 7k: unexpected error: %', sqlerrm;
      end if;
  end;
end $$;

-- 7l. the leader CAN remove an active member; the removed member cannot
--     self-reactivate; only a fresh invitation restores access
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
update public.es_event_team_members
set status = 'invited', responded_at = null
where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
  and user_id = '44444444-4444-4444-4444-444444444444';
select set_config('request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
update public.es_event_team_members
set status = 'active', responded_at = now()
where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
  and user_id = '44444444-4444-4444-4444-444444444444';
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
update public.es_event_team_members
set status = 'removed'
where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
  and user_id = '44444444-4444-4444-4444-444444444444';
select set_config('request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
do $$
begin
  begin
    update public.es_event_team_members
    set status = 'active'
    where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
      and user_id = '44444444-4444-4444-4444-444444444444';
    raise exception 'FAIL 7l: member removed by the leader reactivated themselves';
  exception
    when others then
      if sqlerrm not like 'Membership status change from removed to active%' then
        raise exception 'FAIL 7l: unexpected error: %', sqlerrm;
      end if;
  end;
end $$;
-- the full re-invitation cycle works and restores the member
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
update public.es_event_team_members
set status = 'invited', responded_at = null
where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
  and user_id = '44444444-4444-4444-4444-444444444444';
select set_config('request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
update public.es_event_team_members
set status = 'active', responded_at = now()
where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
  and user_id = '44444444-4444-4444-4444-444444444444';
do $$
begin
  if (select status from public.es_event_team_members
      where team_id = 'eeeeeeee-0000-0000-0000-000000000001'
        and user_id = '44444444-4444-4444-4444-444444444444') <> 'active' then
    raise exception 'FAIL 7l: re-invitation cycle did not restore the member';
  end if;
end $$;

-- 7m. FIX 13 regression: the app's createTeam flow (create team via RLS, then
--     insert your OWN active leader row) must work end-to-end
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
insert into public.es_event_teams (id, event_id, name, leader_user_id, created_by)
values ('eeeeeeee-0000-0000-0000-000000000002',
        'aaaaaaaa-0000-0000-0000-000000000001', 'Fixture Team Two',
        '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333');
insert into public.es_event_team_members (team_id, user_id, member_role, status, invited_by)
values ('eeeeeeee-0000-0000-0000-000000000002',
        '33333333-3333-3333-3333-333333333333', 'leader', 'active',
        '33333333-3333-3333-3333-333333333333');
do $$
begin
  if (select status from public.es_event_team_members
      where team_id = 'eeeeeeee-0000-0000-0000-000000000002'
        and user_id = '33333333-3333-3333-3333-333333333333') <> 'active' then
    raise exception 'FAIL 7m: creator could not add their own leader row (FIX 13)';
  end if;
end $$;
-- ...and the narrow policy cannot be abused: m2 may NOT use it to insert a
-- row for someone else as active
do $$
begin
  begin
    insert into public.es_event_team_members (team_id, user_id, member_role, status, invited_by)
    values ('eeeeeeee-0000-0000-0000-000000000002',
            '44444444-4444-4444-4444-444444444444', 'member', 'active',
            '33333333-3333-3333-3333-333333333333');
    raise exception 'FAIL 7m: creator bypassed the invitation flow with an active insert';
  exception
    when others then
      -- the trigger's consent guard fires before RLS in most cases; either
      -- rejection is fail-closed
      if sqlerrm not like 'Members must be invited%'
         and sqlerrm not like '%row-level security%' then
        raise exception 'FAIL 7m: unexpected error: %', sqlerrm;
      end if;
  end;
end $$;

-- 7n. a leader of ANOTHER team cannot touch T2's membership
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
update public.es_event_team_members
set status = 'removed'
where team_id = 'eeeeeeee-0000-0000-0000-000000000002';
do $$
begin
  begin
    insert into public.es_event_team_members (team_id, user_id, member_role, status, invited_by)
    values ('eeeeeeee-0000-0000-0000-000000000002',
            '44444444-4444-4444-4444-444444444444', 'member', 'invited',
            '22222222-2222-2222-2222-222222222222');
    raise exception 'FAIL 7n: leader of another team invited into T2';
  exception
    when others then
      if sqlerrm not like '%row-level security%' then
        raise exception 'FAIL 7n: unexpected error: %', sqlerrm;
      end if;
  end;
end $$;
do $$
begin
  if (select status from public.es_event_team_members
      where team_id = 'eeeeeeee-0000-0000-0000-000000000002'
        and user_id = '33333333-3333-3333-3333-333333333333') <> 'active' then
    raise exception 'FAIL 7n: T2 membership was modified by an unrelated leader';
  end if;
end $$;

-- 7o. judges cannot assign themselves (assignment inserts are organiser-only)
select set_config('request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
do $$
begin
  begin
    insert into public.es_judge_assignments (id, event_id, judge_user_id, submission_id, assigned_by)
    values ('bbbbbbbb-0000-0000-0000-000000000009',
            'aaaaaaaa-0000-0000-0000-000000000001',
            '44444444-4444-4444-4444-444444444444',
            'cccccccc-0000-0000-0000-000000000098',
            '44444444-4444-4444-4444-444444444444');
    raise exception 'FAIL 7o: judge self-assigned a submission';
  exception
    when others then
      if sqlerrm not like '%row-level security%' then
        raise exception 'FAIL 7o: unexpected error: %', sqlerrm;
      end if;
  end;
end $$;

-- ============================================================================
-- DONE
-- ============================================================================
rollback;
select '0016 integrity checks: ALL PASSED (transaction rolled back, no data left behind)' as result;

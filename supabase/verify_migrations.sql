-- ============================================================================
-- BuildProof — POST-MIGRATION VERIFICATION (READ-ONLY)
-- Paste this file into: Supabase Dashboard → SQL editor.
-- Run Section A ONCE AFTER `0001_init_schema.sql` (you may comment Section B
-- out), then run the whole file again AFTER `0002_storage_policies.sql`.
-- Every query prints the expected count next to it — compare before continuing.
-- ============================================================================

-- ===========================================================================
-- SECTION A — after 0001_init_schema.sql
-- ===========================================================================

-- A1. Table count — EXPECT 23
select count(*) as table_count,
       23 as expected
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';

-- A2. RLS must be enabled on EVERY table — EXPECT 23 true / 0 false
select c.relname as table_name,
       c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;

-- A3. Policy count — EXPECT 64
select count(*) as policy_count,
       64 as expected
from pg_policies
where schemaname = 'public';

-- A4. Policies per table — no table may have zero policies
select tablename, count(*) as policies
from pg_policies
where schemaname = 'public'
group by tablename
order by tablename;

-- A5. Public functions — EXPECT 15 total
--     helpers: is_platform_admin, has_any_role, is_institution_admin,
--              is_cohort_staff, is_cohort_member, is_team_member, can_read_team,
--              can_edit_team_work, submitted_by_check, can_review_team_work
--     trigger fns: enforce_self_member_status_only, proof_card_review_guard,
--              handle_new_user
--     RPCs: find_user_id_by_email, accept_team_invite
--     (+ your pre-existing utility: rls_auto_enable — untouched, so 16 rows)
select p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by function_name;

-- A6. Signup trigger must exist on auth.users — EXPECT 1 row:
--     on_auth_user_created → handle_new_user
select n.nspname as schema, c.relname as table_name, t.tgname as trigger_name,
       p.proname as fires_function
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal and n.nspname = 'auth' and c.relname = 'users';

-- A7. Internal triggers in public schema — EXPECT 10 rows:
--     8 × *_updated_at (moddatetime) + cohort_members_self_guard
--     + proof_cards_review_guard
select c.relname as table_name, t.tgname as trigger_name, p.proname as fires_function
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal and n.nspname = 'public'
order by 1, 2;

-- A8. moddatetime extension — EXPECT 1 row
select e.extname, n.nspname as installed_in
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
where e.extname = 'moddatetime';

-- ===========================================================================
-- SECTION B — after 0002_storage_policies.sql
-- ===========================================================================

-- B1. The private evidence bucket — EXPECT 1 row with public = false
select id, name, public, file_size_limit, file_size_limit as expect_10485760
from storage.buckets
where id = 'evidence';

-- B2. Storage object policies — EXPECT 4 rows, all roles = authenticated
select policyname, tablename, cmd, roles
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

-- B3. Sanity: policies that mention the evidence path pattern — EXPECT 4
select policyname
from pg_policies
where schemaname = 'storage'
  and policyname like '%evidence%'
order by policyname;

-- ===========================================================================
-- SECTION C — after 0004_events.sql (College Events)
-- ===========================================================================

-- C1. public.events must exist with RLS enabled — EXPECT 1 row, rls = true
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'events';

-- C2. Events policies — EXPECT 5 rows
select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'events'
order by policyname;

-- C3. Total public policies — EXPECT 69 (was 64; +5 for events)
select count(*) as policy_count, 69 as expected
from pg_policies
where schemaname = 'public';

-- C4. The dedicated PUBLIC poster bucket — EXPECT 1 row:
--     public = true, file_size_limit = 5242880 (5 MiB), mime list jpeg/png/webp.
--     The private "evidence" bucket must still show public = false (Section B1).
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'event_posters';

-- C5. Storage object policies — EXPECT 8 rows now
--     (4 from 0002 "evidence…" + 4 from 0004 "event posters…/organizers…")
select policyname, cmd, roles
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

-- C6. events table triggers — EXPECT 1 row: events_updated_at → moddatetime
select c.relname as table_name, t.tgname as trigger_name, p.proname as fires_function
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal and n.nspname = 'public' and c.relname = 'events';

-- C7. Custom check constraints landed on events — EXPECT break Enforcement row:
--     events_dates_order (end_date >= start_date) and the poster-path + numeric
--     checks can be listed via:
select conname
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public' and t.relname = 'events' and c.contype = 'c'
order by conname;

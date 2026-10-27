-- ============================================================================
-- BuildProof — PRE-FLIGHT INSPECTION (READ-ONLY — safe to run any time)
-- Paste this WHOLE file into: Supabase Dashboard → SQL editor → Run.
--
-- Purpose: inspect the CURRENT state of your BuildProof Supabase project
-- before running `0001_init_schema.sql`, so we never assume the failed runs
-- left the database empty.
--
-- Nothing here writes, alters, drops or creates anything.
-- If any section errors, note the error text and continue with the rest.
-- Expected result for a project where the earlier migration attempts failed:
--   §1: no tables (only the `rls_auto_enable` function of §2)
--   §2: one PL/pgSQL function `rls_auto_enable` (owned by postgres — KEEP it)
--   §3: whether an EVENT TRIGGER is attached to it and is enabled
--   §4: extensions enabled (moddatetime may or may not be there yet)
--   §5: storage state (default buckets; the `evidence` bucket should NOT exist)
--   §6: triggers on auth.users and public schema functions (only rls_auto_enable)
-- ============================================================================

-- §1 — Every object living in the public schema right now
select 'TABLE' as kind, c.relname as object_name,
       c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'S', 'f')
union all
select 'FUNCTION', p.proname || '(' ||
       pg_get_function_identity_arguments(p.oid) || ')', null
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
union all
select 'SEQUENCE or other', c.relname, null
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind not in ('r', 'v', 'm', 'f')
order by 1, 2;

-- §2 — Definition of the existing rls_auto_enable() (informational; KEEP it)
select p.proname,
       r.rolname as owner,
       pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.oid = p.proowner
where n.nspname = 'public' and p.proname = 'rls_auto_enable';

-- §3 — Event triggers: is rls_auto_enable attached to one, and is it ENABLED?
--    evtenabled: 'O' = enabled, 'D' = disabled, 'A' = always, 'R' = replica
select t.evtname as event_trigger_name,
       t.evtevent as fires_on,          -- e.g. ddl_command_end
       t.evtenabled as enabled_state,   -- 'O' means it WILL fire on our DDL
       n.nspname || '.' || p.proname as handler_function
from pg_event_trigger t
join pg_proc p on p.oid = t.evtfoid
join pg_namespace n on n.oid = p.pronamespace
order by 1;

-- §4 — Extensions currently installed (moddatetime must end up listed here;
--      it may already live in a different schema such as `extensions`)
select e.extname as extension, n.nspname as installed_in_schema
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
order by 1;

-- §5 — Storage: buckets and any existing object policies
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by id;

select policyname, tablename, cmd, roles
from pg_policies
where schemaname = 'storage'
order by tablename, policyname;

-- §6 — Triggers on auth.users (a leftover signup trigger would conflict with
--      0001's on_auth_user_created) and on public tables
select n.nspname as schema, c.relname as table_name, t.tgname as trigger_name,
       t.tgenabled as enabled_state, p.proname as fires_function
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal
  and (n.nspname = 'auth' or n.nspname = 'public')
order by 1, 2, 3;

-- §7 — Existing policies in the public schema (should be empty pre-migration)
select schemaname, tablename, policyname
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

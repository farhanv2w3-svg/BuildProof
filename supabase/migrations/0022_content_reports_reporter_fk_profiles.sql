-- ============================================================================
-- BuildProof — 0022_content_reports_reporter_fk_profiles.sql  (additive)
--
-- DEFECT — the admin content-reports panel fails with PostgREST PGRST200
--   ("Could not find a relationship between 'content_reports' and
--   'profiles'"). Found on /app/admin during the organiser smoke test
--   (2026-11-16); the panel renders its other sections but reports never
--   load.
--
-- ROOT CAUSE
--   content_reports.reporter references auth.users (id), while the client
--   (listOpenReports in src/lib/api.ts) embeds profile:profiles(*), which
--   requires a foreign key to public.profiles. The two sides of the schema
--   were written against different assumptions.
--
-- FIX
--   Point the FK at public.profiles (id) instead. Every auth user is
--   guaranteed a profiles row by the handle_new_user trigger, so values in
--   reporter are valid profiles.id values and the new FK validates against
--   existing rows. The client embed then resolves; profile data remains RLS
--   protected ("authenticated users read any profile").
-- ============================================================================

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'content_reports_reporter_fkey'
      and conrelid = 'public.content_reports'::regclass
  ) then
    alter table public.content_reports drop constraint content_reports_reporter_fkey;
  end if;
end $$;

-- Not valid initially: avoid a full-table scan under load; validated below
-- in the same transaction (the table is tiny).
alter table public.content_reports
  add constraint content_reports_reporter_fkey
  foreign key (reporter) references public.profiles (id) on delete cascade;

alter table public.content_reports
  validate constraint content_reports_reporter_fkey;

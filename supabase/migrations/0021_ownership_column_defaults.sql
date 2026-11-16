-- ============================================================================
-- BuildProof — 0021_ownership_column_defaults.sql  (additive)
--
-- DEFECT — organiser application, event creation and event registration all
--   fail at runtime with "new row violates row-level security policy" (403).
--   Found during the post-deploy organiser smoke test (2026-11-16).
--
-- ROOT CAUSE
--   The client inserts rely on auth.uid() column defaults that 0015 never
--   defined:
--     * applyForOrganizer() inserts into es_event_organizers WITHOUT user_id
--       (confirmed live: user_id = NULL -> policy `user_id = auth.uid()`
--       evaluates false -> RLS rejection);
--     * CreateEventPage explicitly deletes created_by from the es_events
--       payload before insert;
--     * registerForEvent() upserts es_registrations WITHOUT user_id (its
--       onConflict target is (event_id, user_id)).
--   All three columns are NOT NULL without a default, so every insert of
--   these flows was impossible.
--
-- FIX
--   Set the missing defaults. This is NOT a security weakening: the RLS
--   policies still require user_id/created_by = auth.uid(), so a caller
--   supplying a different value is still rejected. The default only fills
--   the value the client deliberately omits.
-- ============================================================================

alter table public.es_event_organizers
  alter column user_id set default auth.uid();

alter table public.es_events
  alter column created_by set default auth.uid();

alter table public.es_registrations
  alter column user_id set default auth.uid();

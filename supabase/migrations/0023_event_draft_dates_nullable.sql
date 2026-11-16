-- ============================================================================
-- BuildProof — 0023_event_draft_dates_nullable.sql  (additive)
--
-- DEFECT — saving an EventSpace DRAFT event without dates fails with
--   "invalid input syntax for type timestamp with time zone: \"\"" (400).
--   Found during the organiser smoke test (2026-11-16).
--
-- ROOT CAUSE
--   Two layers disagree about drafts:
--     * The create/edit wizard is explicitly designed for date-less drafts
--       ("Drafts autosave section-by-section; publish only when the
--       checklist is complete" — the checklist only requires start/end
--       dates for PUBLISH), and its date inputs hold "" until filled.
--     * 0015 declares starts_at/ends_at NOT NULL, and other nullable date
--       columns receive "" instead of NULL, which PostgREST cannot cast.
--
-- FIX (database side)
--   Make draft dates nullable; the existing ends_at >= starts_at check is
--   NULL-safe (NULL comparisons pass). Publication still requires dates —
--   enforced by the client checklist AND by es_can_read_submission /
--   public-read policies which only expose published events.
--
--   The client side (empty-string sanitation in createEventDraft/updateEvent)
--   is fixed in the same commit so payloads never send "" for these columns.
-- ============================================================================

alter table public.es_events
  alter column starts_at drop not null;

alter table public.es_events
  alter column ends_at drop not null;

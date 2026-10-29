-- ============================================================================
-- BuildProof — 0004_events.sql  (additive College Events module)
-- Run order: 0001 → 0002 → 0003 → 0004 (this file).
--
-- Scope discipline:
--   * ADDS public.events + one dedicated storage bucket ("event_posters").
--   * Does NOT alter existing tables, policies, buckets or limits.
--   * Views/policies follow the conventions established in 0001–0003.
--
-- Authorisation model (matches the existing account model):
--   * Any authenticated user may create events under their own account
--     (created_by = auth.uid() enforced by RLS — never taken from the payload).
--   * Organisers update/delete ONLY their own events; platform admins keep
--     their existing moderate-everything right via public.is_platform_admin().
--   * Anonymous visitors read only events intended for public display
--     (status = 'published').
--   * College names are ORGANIZER-PROVIDED. There is no verification step —
--     the UI must never imply institutional verification.
--
-- Poster integrity:
--   * poster_path is required and MUST live under the creator's own folder
--     ("{auth_uid}/..."), enforced by a check constraint, so a crafted
--     payload can never point an event at another user's file.
--   * The bucket is PUBLIC by design: posters are published event images.
--     Nothing confidential may ever be placed in this bucket.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- events — the narrowly scoped event data model
-- ----------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,

  -- Core required information -------------------------------------------------
  title text not null check (char_length(title) between 6 and 160),
  event_type text not null check (event_type in (
    'hackathon', 'symposium', 'workshop', 'technical_fest', 'cultural_fest',
    'coding_competition', 'robotics_hardware', 'project_exhibition',
    'conference', 'other'
  )),
  institution_name text not null check (char_length(institution_name) between 3 and 200),
  city text not null check (char_length(city) between 2 and 120),
  state_name text not null check (char_length(state_name) between 2 and 120),
  start_date date not null,
  end_date date not null,

  -- Poster (required; the object path lives in the creator's own folder) ------
  -- created_by is a uuid (hex + dashes only), so LIKE has no wildcard risks.
  -- (Object storage has no filesystem traversal semantics; this pins the event
  -- to its creator's folder, which is what the storage policies enforce.)
  poster_path text not null check (
    char_length(poster_path) <= 400
    and poster_path like (created_by::text || '/%')
    and poster_path <> (created_by::text || '/')
  ),

  -- Optional information ------------------------------------------------------
  contact_number text check (contact_number ~ '^[+0-9(][0-9 ()-]{5,19}$'),
  venue text check (char_length(venue) <= 240),
  description text check (char_length(description) <= 3000),
  -- Only safe schemes: a URL that does not begin with http(s):// can never be stored.
  registration_url text check (
    char_length(registration_url) <= 400
    and registration_url ~ '^https?://[^[:space:]]+$'
  ),
  contact_name text check (char_length(contact_name) <= 120),
  schedule_note text check (char_length(schedule_note) <= 3000),

  -- Lifecycle -----------------------------------------------------------------
  status text not null default 'published' check (status in ('draft', 'published', 'cancelled')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A multi-day event can never end before it starts.
  constraint events_dates_order check (end_date >= start_date)
);

create index events_status_dates_idx on public.events (status, start_date);
create index events_city_idx on public.events (city);
create index events_created_by_idx on public.events (created_by);

-- Keep updated_at fresh the same way Part-1 tables do (moddatetime extension).
create trigger events_updated_at before update on public.events
for each row execute procedure moddatetime (updated_at);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.events enable row level security;

-- Anonymous visitors: only events intended for public display.
create policy "public read published events" on public.events
for select to anon
using (status = 'published');

-- Signed-in users additionally see their own events and admins see everything.
create policy "authenticated read published or own events" on public.events
for select to authenticated
using (
  status = 'published'
  or created_by = auth.uid()
  or public.is_platform_admin()
);

-- Creation is self-scoped: the row must name the author from their session.
create policy "organizers create own events" on public.events
for insert to authenticated
with check (created_by = auth.uid());

-- Creators manage their own events; platform admins keep oversight.
-- The same predicate on USING and WITH CHECK means a crafted payload cannot
-- move the record to another owner: the new row must still pass created_by = auth.uid().
create policy "creators & admins update events" on public.events
for update to authenticated
using (created_by = auth.uid() or public.is_platform_admin())
with check (created_by = auth.uid() or public.is_platform_admin());

create policy "creators & admins delete events" on public.events
for delete to authenticated
using (created_by = auth.uid() or public.is_platform_admin());

-- ----------------------------------------------------------------------------
-- Dedicated poster bucket — public, small, image-only
-- ----------------------------------------------------------------------------
-- Enforced SERVER-side by the bucket settings (Supabase storage applies these
-- on upload, independent of any frontend validation):
--   * file_size_limit  = 5 MiB (5242880 bytes) — MAX_EVENT_POSTER_SIZE_BYTES
--   * allowed_mime_types = JPEG / PNG / WebP only (no SVG: no sanitisation
--     pipeline exists for active XML content, so SVG stays rejected).
-- The upsert is scoped to THIS bucket id only; no other bucket is touched.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event_posters', 'event_posters', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Posters are published event marketing images: world-readable.
create policy "event posters public read" on storage.objects
for select to anon, authenticated
using (bucket_id = 'event_posters');

-- Upload only into your OWN first path segment ("{auth_uid}/{uuid}-{file}").
create policy "organizers upload own poster objects" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'event_posters'
  and ((storage.foldername(name))[1]) = auth.uid()::text
);

-- Replacement is folder-scoped: never another organizer's poster.
create policy "organizers replace own poster objects" on storage.objects
for update to authenticated
using (
  bucket_id = 'event_posters'
  and ((storage.foldername(name))[1]) = auth.uid()::text
)
with check (
  bucket_id = 'event_posters'
  and ((storage.foldername(name))[1]) = auth.uid()::text
);

-- Deletion is folder-scoped; platform admins keep their standing rights on
-- storage.objects via the default postgres role, so no extra policy is needed
-- for them here (a creator can always clean up abandoned uploads themselves).
create policy "organizers delete own poster objects" on storage.objects
for delete to authenticated
using (
  bucket_id = 'event_posters'
  and ((storage.foldername(name))[1]) = auth.uid()::text
);

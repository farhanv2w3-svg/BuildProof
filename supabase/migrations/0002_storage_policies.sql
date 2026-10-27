-- ============================================================================
-- BuildProof — storage: private evidence bucket
-- Run order: 0001 (schema) → 0002 (this file) → seed.sql (demo ONLY).
--
-- Bucket design:
--   * One PRIVATE bucket named "evidence". Nothing in it is publicly
--     readable; the app only ever opens files through short-lived signed
--     URLs (300 s) created for authorised users.
--   * Objects are uploaded as "{teamId}/{uuid}-{filename}", so the first
--     path segment is always the team id. Every policy below re-derives the
--     team id from the object name and re-checks team permission, so a user
--     can never touch another team's folder even with a crafted path.
-- ============================================================================

-- Idempotent bucket creation (safe to re-run).
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- read (also required for the storage API to mint signed URLs)
-- ----------------------------------------------------------------------------
create policy "team readers read evidence objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'evidence'
  and public.can_read_team(
    ((storage.foldername(name))[1])::uuid
  )
);

-- ----------------------------------------------------------------------------
-- upload (insert)
-- ----------------------------------------------------------------------------
create policy "team members upload evidence objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'evidence'
  and public.is_team_member(
    ((storage.foldername(name))[1])::uuid
  )
);

-- ----------------------------------------------------------------------------
-- overwrite only by the uploader or reviewers
-- ----------------------------------------------------------------------------
create policy "uploaders & reviewers update evidence objects"
on storage.objects for update to authenticated
using (
  bucket_id = 'evidence'
  and (
    owner_id = (select id from auth.users where id = auth.uid())::text
    or public.can_review_team_work(
      ((storage.foldername(name))[1])::uuid
    )
  )
)
with check (
  bucket_id = 'evidence'
  and (
    owner_id = (select id from auth.users where id = auth.uid())::text
    or public.can_review_team_work(
      ((storage.foldername(name))[1])::uuid
    )
  )
);

-- ----------------------------------------------------------------------------
-- delete
-- ----------------------------------------------------------------------------
create policy "uploaders & reviewers delete evidence objects"
on storage.objects for delete to authenticated
using (
  bucket_id = 'evidence'
  and (
    owner_id = (select id from auth.users where id = auth.uid())::text
    or public.can_review_team_work(
      ((storage.foldername(name))[1])::uuid
    )
  )
);

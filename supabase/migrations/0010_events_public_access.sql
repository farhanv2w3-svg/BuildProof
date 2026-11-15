-- Events public read access repair
-- Apply only after reviewing against the production schema.
-- Scope: grants and RLS for published college events only.

begin;

alter table public.events enable row level security;

drop policy if exists "public read published events" on public.events;
create policy "public read published events" on public.events
for select to anon
using (status = 'published');

grant select on public.events to anon;

-- Authenticated organizers need the matching DML privileges for the policies
-- above. Keep these grants minimal and specific to public.events.
grant select, insert, update, delete on public.events to authenticated;

-- Storage is public only because event posters are published marketing images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event_posters', 'event_posters', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;

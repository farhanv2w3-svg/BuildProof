-- DRAFT: Team collaboration and public hardware project publishing.
-- Apply only after approval and staging verification.

create table if not exists public.team_messages (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists team_messages_team_created_idx
  on public.team_messages(team_id, created_at desc);

alter table public.team_messages enable row level security;

drop policy if exists "team members read their messages" on public.team_messages;
create policy "team members read their messages" on public.team_messages
for select to authenticated
using (public.is_team_member(team_id));

drop policy if exists "team members send messages" on public.team_messages;
create policy "team members send messages" on public.team_messages
for insert to authenticated
with check (public.is_team_member(team_id) and sender_id = auth.uid());

alter table public.hardware_projects
  add column if not exists lifecycle_status text not null default 'prototype'
    check (lifecycle_status in ('idea', 'in_progress', 'prototype', 'testing', 'completed')),
  add column if not exists visibility text not null default 'private'
    check (visibility in ('private', 'restricted', 'public')),
  add column if not exists published_at timestamptz;

create index if not exists hardware_projects_public_idx
  on public.hardware_projects(visibility, lifecycle_status);

drop policy if exists "public read published hardware" on public.hardware_projects;
create policy "public read published hardware" on public.hardware_projects
for select to anon
using (visibility = 'public' and published_at is not null);

drop policy if exists "authenticated read authored hardware" on public.hardware_projects;
create policy "authenticated read authored hardware" on public.hardware_projects
for select to authenticated
using (
  public.is_team_member(team_id)
  or (visibility = 'public' and published_at is not null)
);

drop policy if exists "team members manage hardware" on public.hardware_projects;
create policy "team members manage hardware" on public.hardware_projects
for all to authenticated
using (public.can_edit_team_work(team_id))
with check (public.can_edit_team_work(team_id));

revoke insert, update, delete on public.team_messages from anon;
grant select, insert on public.team_messages to authenticated;
revoke insert, update, delete on public.hardware_projects from anon;
grant select on public.hardware_projects to anon;

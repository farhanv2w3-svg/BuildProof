-- Central notification system additions.
-- Existing notifications remain the canonical in-app notification table.

create extension if not exists pgcrypto;

alter table public.notifications
  add column if not exists category text not null default 'account';

create table if not exists public.registration_notification_outbox (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  registered_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists registration_notification_retry_idx
  on public.registration_notification_outbox(status, next_attempt_at);

create or replace function public.queue_registration_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.registration_notification_outbox
    (user_id, email, display_name, registered_at)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.created_at, now())
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.queue_registration_notification() from public;

drop trigger if exists on_auth_user_queued_notification on auth.users;
create trigger on_auth_user_queued_notification
after insert on auth.users
for each row execute function public.queue_registration_notification();

create table if not exists public.feature_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 160),
  description text not null check (char_length(description) between 1 and 5000),
  image_url text,
  destination_route text,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'published', 'archived')),
  publish_at timestamptz,
  published_at timestamptz,
  author_id uuid references public.profiles(id) on delete set null,
  notification_created boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feature_announcement_route check (
    destination_route is null or destination_route like '/%'
  ),
  constraint feature_announcement_schedule check (
    status != 'scheduled' or publish_at is not null
  ),
  constraint feature_announcement_publish_time check (
    status != 'published' or published_at is not null
  )
);

create index if not exists feature_announcements_visible_idx
  on public.feature_announcements(status, published_at desc);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  in_app_enabled boolean not null default true,
  push_enabled boolean not null default false,
  feature_announcements boolean not null default true,
  team_notifications boolean not null default true,
  project_notifications boolean not null default true,
  event_notifications boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text,
  endpoint_hash text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  last_error text
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id, enabled);

create table if not exists public.push_delivery_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.push_subscriptions(id) on delete cascade,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

alter table public.feature_announcements enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "published announcements readable" on public.feature_announcements
for select to authenticated, anon
using (status = 'published' or published_at is not null);

create policy "admins manage announcements"
on public.feature_announcements for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "users manage own notification preferences"
on public.notification_preferences for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users manage own push subscriptions"
on public.push_subscriptions for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select on public.feature_announcements to anon, authenticated;
grant select, insert, update, delete on public.feature_announcements to authenticated;
grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- These privileged tables are intentionally not granted to browser roles.
revoke all on public.registration_notification_outbox from anon, authenticated;
revoke all on public.push_delivery_outbox from anon, authenticated;

create or replace function public.publish_feature_announcement(announcement_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  announcement record;
begin
  if not public.is_platform_admin() then
    raise exception 'platform administrator required';
  end if;

  select * into announcement from public.feature_announcements
  where id = announcement_id
  for update;

  if not found then raise exception 'announcement not found'; end if;

  if announcement.notification_created and announcement.status = 'published' then
    return announcement_id;
  end if;

  update public.feature_announcements
  set status = 'published',
      published_at = coalesce(published_at, now()),
      notification_created = true,
      updated_at = now()
  where id = announcement_id;

  insert into public.notifications (user_id, type, category, title, body, link, read)
  select p.id, 'feature_announcement', 'feature',
         announcement.title, announcement.description,
         nullif(announcement.destination_route, ''), false
  from public.profiles p
  left join public.notification_preferences np on np.user_id = p.id
  where coalesce(np.in_app_enabled, true)
    and coalesce(np.feature_announcements, true);

  insert into public.push_delivery_outbox (user_id, subscription_id, payload)
  select ps.user_id, ps.id, jsonb_build_object(
    'title', announcement.title,
    'body', announcement.description,
    'url', coalesce(announcement.destination_route, '/app/notifications')
  )
  from public.push_subscriptions ps
  left join public.notification_preferences np on np.user_id = ps.user_id
  where ps.enabled and coalesce(np.push_enabled, false)
    and coalesce(np.feature_announcements, true)
  on conflict do nothing;

  return announcement_id;
end;
$$;

revoke all on function public.publish_feature_announcement(uuid) from public;
grant execute on function public.publish_feature_announcement(uuid) to authenticated;

create or replace function public.retry_registration_notification(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then raise exception 'platform administrator required'; end if;
  update public.registration_notification_outbox
  set status = 'pending', next_attempt_at = now(), updated_at = now()
  where user_id = target_user_id;
end;
$$;
revoke all on function public.retry_registration_notification(uuid) from public;
grant execute on function public.retry_registration_notification(uuid) to authenticated;

create or replace function public.admin_registration_notification_status()
returns table (
  user_id uuid,
  email text,
  display_name text,
  registered_at timestamptz,
  status text,
  attempt_count integer,
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select o.user_id, o.email, o.display_name, o.registered_at, o.status,
         o.attempt_count, o.next_attempt_at, o.delivered_at, o.last_error,
         o.created_at, o.updated_at
  from public.registration_notification_outbox o
  where public.is_platform_admin()
  order by o.created_at desc
  limit 200;
$$;

revoke all on function public.admin_registration_notification_status() from public;
grant execute on function public.admin_registration_notification_status() to authenticated;

create or replace function public.claim_registration_notification(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
  claimed boolean;
begin
  update public.registration_notification_outbox
  set status = 'processing',
      attempt_count = attempt_count + 1,
      updated_at = now()
  where user_id = target_user_id
    and status in ('pending', 'failed')
    and next_attempt_at <= now();
  get diagnostics updated_count = row_count;
  claimed := updated_count > 0;
  return claimed;
end;
$$;

revoke all on function public.claim_registration_notification(uuid) from public;
revoke execute on function public.claim_registration_notification(uuid) from authenticated;

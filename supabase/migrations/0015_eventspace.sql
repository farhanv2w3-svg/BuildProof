-- ============================================================================
-- BuildProof — 0015_eventspace.sql  (additive EventSpace module)
-- Run order: 0001 … 0014 (this file last).
--
-- Scope discipline:
--   * ADDS the es_* EventSpace domain + one PRIVATE storage bucket
--     ("es_submission_files"). Does NOT alter existing tables except the
--     content_reports subject_type CHECK (additive, documented below).
--   * Reuses existing users/profiles/roles, notifications, audit_logs,
--     content_reports and the public event_posters bucket (covers/posters).
--   * No hard duplicate of the college-events module: EventSpace is the
--     competition/project-event domain (registrations, submissions, judging).
--
-- Security model (mirrors existing conventions):
--   * Roles come from public.user_roles; privilege is NEVER taken from payload.
--   * Organiser status lives in es_event_organizers and is granted ONLY by a
--     platform admin (SECURITY DEFINER RPC). Users cannot self-assign.
--   * Submissions/files are PRIVATE by default; judges see only assigned
--     submissions; showcase is published only after owner + organiser approval.
--   * Server-side triggers validate dates, capacity, weights, snapshots.
--
-- NOTE FOR OPERATORS: run this file once via `supabase db push` (or the SQL
-- editor). It is idempotent-safe for re-runs only where noted; new policies
-- use create policy which errors on duplicates by design (fail-loud).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Shared helper functions (security definer; revocable; stable where possible)
-- ----------------------------------------------------------------------------

-- Approved organiser (or platform admin) — gate for event creation.
create or replace function public.es_is_approved_organizer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.es_event_organizers
    where user_id = auth.uid() and status = 'approved'
  ) or public.is_platform_admin();
$$;

-- Can this user manage a specific event? (creator, staff, or platform admin)
create or replace function public.es_can_manage_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.es_events e
    where e.id = p_event_id
      and (
        e.created_by = auth.uid()
        or public.is_platform_admin()
        or exists (
          select 1 from public.es_event_staff s
          where s.event_id = e.id and s.user_id = auth.uid() and s.role = 'manager'
        )
      )
  );
$$;

-- Active participant (accepted registration, not withdrawn/cancelled).
create or replace function public.es_is_participant(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.es_registrations r
    where r.event_id = p_event_id
      and r.user_id = auth.uid()
      and r.status in ('registered', 'pending', 'waitlisted')
  );
$$;

-- Active member of an EventSpace team.
create or replace function public.es_is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.es_event_team_members m
    where m.team_id = p_team_id and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

-- Owner check for a submission (individual owner or active team member).
create or replace function public.es_is_submission_owner(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.es_submissions s
    where s.id = p_submission_id
      and (
        (s.owner_type = 'individual' and s.owner_user_id = auth.uid())
        or
        (s.owner_type = 'team' and s.team_id is not null
           and public.es_is_team_member(s.team_id))
      )
  );
$$;

-- Staff (incl. creator/manager/admin) for a submission's event.
create or replace function public.es_can_review_submission(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.es_submissions s
    where s.id = p_submission_id
      and public.es_can_manage_event(s.event_id)
  );
$$;

-- Assigned judge for a specific submission.
create or replace function public.es_is_assigned_judge(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.es_judge_assignments a
    where a.submission_id = p_submission_id
      and a.judge_user_id = auth.uid()
      and a.status <> 'removed'
  );
$$;

-- Combined read access to a submission's PRIVATE payload.
create or replace function public.es_can_read_submission(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_is_submission_owner(p_submission_id)
      or public.es_can_review_submission(p_submission_id)
      or public.es_is_assigned_judge(p_submission_id);
$$;

-- Submission window open on the event (server-side date authority).
create or replace function public.es_submission_window_open(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.es_events e
    where e.id = p_event_id
      and e.status = 'published'
      and coalesce(e.submission_open, true)
      and (e.submission_opens_at is null or e.submission_opens_at <= now())
      and (e.resubmit_until is not null or e.submission_deadline is null or e.submission_deadline >= now())
  );
$$;

-- Lightweight in-table rate limiter for sensitive public-ish actions.
create table public.es_rate_limits (
  bucket text primary key,
  window_start timestamptz not null default now(),
  hits integer not null default 0
);
alter table public.es_rate_limits enable row level security;
revoke all on public.es_rate_limits from anon, authenticated;

create or replace function public.es_rate_ok(p_bucket text, p_max integer, p_window interval)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.es_rate_limits;
begin
  insert into public.es_rate_limits (bucket, window_start, hits)
  values (p_bucket, now(), 1)
  on conflict (bucket) do update
    set hits = case
          when es_rate_limits.window_start < now() - p_window then 1
          else es_rate_limits.hits + 1
        end,
        window_start = case
          when es_rate_limits.window_start < now() - p_window then now()
          else es_rate_limits.window_start
        end
    returning * into v_row;
  return v_row.hits <= p_max;
end;
$$;
revoke all on function public.es_rate_ok(text, integer, interval) from public, anon;

-- ----------------------------------------------------------------------------
-- Organiser applications / registry
-- ----------------------------------------------------------------------------
create table public.es_event_organizers (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  org_name text not null check (char_length(org_name) between 2 and 200),
  official_email text not null check (official_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  position text not null check (char_length(position) between 2 and 120),
  website text check (char_length(website) <= 400 and website ~ '^https?://[^[:space:]]+$'),
  reason text not null check (char_length(reason) between 20 and 2000),
  verification_notes text check (char_length(verification_notes) <= 2000),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'suspended')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (char_length(review_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index es_event_organizers_status_idx on public.es_event_organizers (status);

-- Review is an admin-only RPC (see below); organisers may never self-approve.
create policy "organizers read own application" on public.es_event_organizers
for select to authenticated
using (user_id = auth.uid() or public.is_platform_admin());

create policy "users apply to be organizer" on public.es_event_organizers
for insert to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'
  and public.es_rate_ok('es_org_apply:' || auth.uid()::text, 3, interval '1 hour')
);

-- No direct update/delete policies: admins act through the RPC, withdrawal via RPC.

-- ----------------------------------------------------------------------------
-- Events
-- ----------------------------------------------------------------------------
create table public.es_events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,78}[a-z0-9])?$'),
  created_by uuid not null references public.profiles (id) on delete cascade,

  -- identity
  title text not null check (char_length(title) between 6 and 180),
  category text not null check (category in (
    'hackathon', 'ideathon', 'coding_competition', 'project_exhibition',
    'workshop', 'conference', 'symposium', 'robotics_hardware', 'other'
  )),
  short_description text not null check (char_length(short_description) between 20 and 400),
  full_description text check (char_length(full_description) <= 12000),
  cover_path text check (
    char_length(cover_path) <= 400
    and cover_path like (created_by::text || '/%')
  ),
  poster_path text check (
    char_length(poster_path) <= 400
    and poster_path like (created_by::text || '/%')
  ),
  logo_path text check (
    char_length(logo_path) <= 400
    and logo_path like (created_by::text || '/%')
  ),
  institution_name text not null check (char_length(institution_name) between 2 and 200),
  edition text check (char_length(edition) <= 80),
  theme text check (char_length(theme) <= 200),
  official_url text check (char_length(official_url) <= 400 and official_url ~ '^https?://[^[:space:]]+$'),

  -- format & location
  format text not null default 'online' check (format in ('online', 'offline', 'hybrid')),
  venue text check (char_length(venue) <= 240),
  city text check (char_length(city) <= 120),
  state_name text check (char_length(state_name) <= 120),
  country text check (char_length(country) <= 120),
  timezone text not null default 'Asia/Kolkata' check (char_length(timezone) <= 64),
  online_instructions text check (char_length(online_instructions) <= 3000),
  map_url text check (char_length(map_url) <= 400 and map_url ~ '^https?://[^[:space:]]+$'),

  -- dates (server-validated ordering; see es_events_dates_order)
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  submission_opens_at timestamptz,
  submission_deadline timestamptz,
  judging_starts_at timestamptz,
  judging_ends_at timestamptz,
  results_at timestamptz,
  resubmit_until timestamptz,

  -- eligibility
  eligibility_levels text[] not null default '{school,college,university,open}'
    check (cardinality(eligibility_levels) between 1 and 4),
  eligibility_years text[] default null,
  eligibility_departments text[] default null,
  eligibility_institutions text[] default null,
  eligibility_regions text[] default null,
  age_note text check (char_length(age_note) <= 300),
  participation text not null default 'both'
    check (participation in ('individual', 'team', 'both')),
  min_team_size integer not null default 2 check (min_team_size between 1 and 20),
  max_team_size integer not null default 4 check (max_team_size between 1 and 20),

  -- registration settings
  registration_enabled boolean not null default true,
  registration_capacity integer check (registration_capacity between 1 and 100000),
  registration_approval boolean not null default false,
  reg_questions jsonb not null default '[]'::jsonb,
  registration_note text check (char_length(registration_note) <= 3000),
  confirmation_message text check (char_length(confirmation_message) <= 2000),

  -- rules / submission config / evaluation config
  rules text check (char_length(rules) <= 12000),
  submission_requirements text check (char_length(submission_requirements) <= 8000),
  originality_terms text check (char_length(originality_terms) <= 4000),
  ip_terms text check (char_length(ip_terms) <= 4000),
  late_submission_terms text check (char_length(late_submission_terms) <= 2000),
  disqualification_terms text check (char_length(disqualification_terms) <= 2000),
  contact_name text check (char_length(contact_name) <= 120),
  contact_email text check (contact_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  contact_phone text check (contact_phone ~ '^[+0-9(][0-9 ()-]{5,19}$'),
  faq jsonb not null default '[]'::jsonb,
  submission_fields jsonb not null default '[]'::jsonb,
  evaluation_enabled boolean not null default true,
  evaluation_criteria jsonb not null default '[]'::jsonb,
  feedback_visible boolean not null default false,
  anonymous_judging boolean not null default false,

  -- lifecycle & visibility
  status text not null default 'draft'
    check (status in ('draft', 'published', 'completed', 'cancelled', 'archived')),
  visibility text not null default 'public' check (visibility in ('public', 'unlisted', 'private')),
  registration_open boolean not null default true,
  submission_open boolean not null default true,
  judging_open boolean not null default false,
  results_published boolean not null default false,
  featured boolean not null default false,
  published_at timestamptz,
  cancelled_reason text check (char_length(cancelled_reason) <= 1000),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint es_events_team_size_order check (max_team_size >= min_team_size),
  constraint es_events_dates_order check (ends_at >= starts_at)
);

create index es_events_status_idx on public.es_events (status, starts_at);
create index es_events_public_idx on public.es_events (status, visibility, registration_opens_at);
create index es_events_category_idx on public.es_events (category);
create index es_events_created_by_idx on public.es_events (created_by);
create trigger es_events_updated_at before update on public.es_events
for each row execute procedure moddatetime (updated_at);

-- Date-ordering + publish-readiness validation (server-side authority).
create or replace function public.es_validate_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.registration_opens_at is not null and new.registration_closes_at is not null
     and new.registration_closes_at <= new.registration_opens_at then
    raise exception 'Registration closing must be after opening';
  end if;
  if new.registration_closes_at is not null and new.registration_closes_at > new.ends_at then
    raise exception 'Registration cannot close after the event ends';
  end if;
  if new.submission_opens_at is not null and new.submission_deadline is not null
     and new.submission_deadline <= new.submission_opens_at then
    raise exception 'Submission deadline must be after submission opening';
  end if;
  if new.submission_deadline is not null and new.submission_deadline > new.ends_at then
    raise exception 'Submission deadline cannot be after the event ends';
  end if;
  if new.judging_starts_at is not null and new.judging_ends_at is not null
     and new.judging_ends_at <= new.judging_starts_at then
    raise exception 'Judging end must be after judging start';
  end if;
  if new.starts_at < now() - interval '1 day' and new.status = 'draft' and old is null then
    -- allow backdated drafts; organiser responsibility. No-op guard.
    null;
  end if;

  if new.status = 'published' then
    if coalesce(trim(new.title), '') = '' then raise exception 'Publish requires a title'; end if;
    if coalesce(trim(new.short_description), '') = '' then raise exception 'Publish requires a short description'; end if;
    if coalesce(trim(new.institution_name), '') = '' then raise exception 'Publish requires institution/organisation'; end if;
    if new.format in ('offline', 'hybrid') and coalesce(trim(new.venue), '') = '' then
      raise exception 'Offline/hybrid events require a venue';
    end if;
    if new.participation in ('team', 'both') and new.min_team_size < 1 then
      raise exception 'Team events require a valid minimum team size';
    end if;
    -- evaluation criteria must total exactly 100 when evaluation is on
    if new.evaluation_enabled then
      if coalesce(jsonb_array_length(new.evaluation_criteria), 0) = 0 then
        raise exception 'Evaluation enabled but no criteria configured';
      end if;
      if coalesce((
        select sum((c ->> 'weight')::numeric)
        from jsonb_array_elements(new.evaluation_criteria) c
      ), 0) <> 100 then
        raise exception 'Evaluation criteria weights must total exactly 100';
      end if;
    end if;
    if new.published_at is null then
      new.published_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger es_events_validate before insert or update on public.es_events
for each row execute function public.es_validate_event();

-- RLS ------------------------------------------------------------------
alter table public.es_events enable row level security;

-- Public discovery: published + public. Unlisted reachable by direct link
-- for authenticated users (not discoverable via filters because filters
-- query with visibility = 'public'). Private requires participation/staff.
create policy "anon read public events" on public.es_events
for select to anon
using (status = 'published' and visibility = 'public');

create policy "auth read visible events" on public.es_events
for select to authenticated
using (
  (status = 'published' and visibility in ('public', 'unlisted'))
  or public.es_can_manage_event(id)
  or public.es_is_participant(id)
  or exists (
    select 1 from public.es_event_staff s
    where s.event_id = id and s.user_id = auth.uid()
  )
  or public.is_platform_admin()
);

create policy "approved organizers create events" on public.es_events
for insert to authenticated
with check (
  created_by = auth.uid()
  and status = 'draft'
  and public.es_is_approved_organizer()
  and public.es_rate_ok('es_event_create:' || auth.uid()::text, 10, interval '1 day')
);

create policy "managers update events" on public.es_events
for update to authenticated
using (public.es_can_manage_event(id))
with check (
  public.es_can_manage_event(id)
  and (created_by = auth.uid() or public.is_platform_admin())
  and created_by = (select e.created_by from public.es_events e where e.id = id)
);

create policy "managers delete draft events" on public.es_events
for delete to authenticated
using (
  (public.es_can_manage_event(id) and status = 'draft')
  or public.is_platform_admin()
);

-- ----------------------------------------------------------------------------
-- Event staff (managers + judges granted by an authorised organiser)
-- ----------------------------------------------------------------------------
create table public.es_event_staff (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.es_events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('manager', 'judge')),
  granted_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, user_id, role)
);

create index es_event_staff_user_idx on public.es_event_staff (user_id);
create index es_event_staff_event_idx on public.es_event_staff (event_id);

alter table public.es_event_staff enable row level security;

create policy "participants & staff read staff list" on public.es_event_staff
for select to authenticated
using (public.es_can_manage_event(event_id) or user_id = auth.uid());

create policy "managers grant staff" on public.es_event_staff
for insert to authenticated
with check (
  public.es_can_manage_event(event_id)
  and user_id <> auth.uid()
);

create policy "managers revoke staff" on public.es_event_staff
for delete to authenticated
using (public.es_can_manage_event(event_id));

-- Admin RPC: organiser application review (SECURITY DEFINER; admin-gated).
create or replace function public.es_review_organizer(
  p_user_id uuid,
  p_decision text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform administrators can review organiser applications';
  end if;
  if p_decision not in ('approved', 'rejected', 'suspended') then
    raise exception 'Invalid decision';
  end if;
  update public.es_event_organizers
    set status = p_decision,
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        review_note = left(p_note, 1000)
    where user_id = p_user_id;
  if not found then
    raise exception 'Application not found';
  end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'es_review_organizer', 'es_event_organizers', p_user_id,
            jsonb_build_object('decision', p_decision, 'note', left(p_note, 1000)));
end;
$$;
revoke all on function public.es_review_organizer(uuid, text, text) from public, anon;

-- Organiser withdraws their own pending application (no status tampering).
create or replace function public.es_withdraw_organizer_application()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.es_event_organizers
    where user_id = auth.uid() and status = 'pending';
$$;
revoke all on function public.es_withdraw_organizer_application() from public, anon;

-- Admin helper: resolve an invitee by exact email (never exposes other PII).
create or replace function public.es_resolve_invitee(p_event_id uuid, p_email text)
returns table (user_id uuid, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name
  from public.profiles p
  where public.es_can_manage_event(p_event_id)
    and lower(p.email) = lower(p_email)
  limit 1;
$$;
revoke all on function public.es_resolve_invitee(uuid, text) from public, anon;
grant execute on function public.es_resolve_invitee(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Rounds
-- ----------------------------------------------------------------------------
create table public.es_event_rounds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.es_events (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  description text check (char_length(description) <= 4000),
  round_type text not null default 'submission'
    check (round_type in ('submission', 'interview', 'presentation', 'review', 'other')),
  opens_at timestamptz,
  closes_at timestamptz,
  submission_config jsonb not null default '{}'::jsonb,
  evaluation_config jsonb not null default '{}'::jsonb,
  advancement text check (char_length(advancement) <= 2000),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint es_event_rounds_dates check (closes_at is null or opens_at is null or closes_at >= opens_at)
);

create index es_event_rounds_event_idx on public.es_event_rounds (event_id, sort_order);

alter table public.es_event_rounds enable row level security;

create policy "public read rounds of visible events" on public.es_event_rounds
for select to anon, authenticated
using (
  exists (
    select 1 from public.es_events e
    where e.id = event_id and e.status = 'published' and e.visibility = 'public'
  )
  or public.es_can_manage_event(event_id)
  or public.es_is_participant(event_id)
);

create policy "managers manage rounds" on public.es_event_rounds
for insert to authenticated with check (public.es_can_manage_event(event_id));

create policy "managers update rounds" on public.es_event_rounds
for update to authenticated
using (public.es_can_manage_event(event_id))
with check (public.es_can_manage_event(event_id));

create policy "managers delete rounds" on public.es_event_rounds
for delete to authenticated
using (public.es_can_manage_event(event_id));

-- ----------------------------------------------------------------------------
-- Event teams + membership
-- ----------------------------------------------------------------------------
create table public.es_event_teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.es_events (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  leader_user_id uuid not null references public.profiles (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, name)
);

create index es_event_teams_event_idx on public.es_event_teams (event_id);
create index es_event_teams_leader_idx on public.es_event_teams (leader_user_id);

alter table public.es_event_teams enable row level security;

create policy "read event teams" on public.es_event_teams
for select to authenticated
using (
  public.es_can_manage_event(event_id)
  or public.es_is_team_member(id)
  or public.es_is_participant(event_id)
  or exists (
    select 1 from public.es_event_team_members m
    where m.team_id = id and m.user_id = auth.uid()
  )
);

create policy "participants create teams" on public.es_event_teams
for insert to authenticated
with check (
  created_by = auth.uid()
  and leader_user_id = auth.uid()
  and public.es_is_participant(event_id)
  and public.es_rate_ok('es_team_create:' || auth.uid()::text, 10, interval '1 day')
);

create policy "leader & managers update teams" on public.es_event_teams
for update to authenticated
using (
  leader_user_id = auth.uid() or public.es_can_manage_event(event_id)
)
with check (
  leader_user_id = auth.uid() or public.es_can_manage_event(event_id)
);

create policy "leader & managers delete teams" on public.es_event_teams
for delete to authenticated
using (
  (leader_user_id = auth.uid() or public.es_can_manage_event(event_id))
  and not exists (
    select 1 from public.es_submissions s
    where s.team_id = id and s.status in ('submitted', 'resubmitted', 'shortlisted', 'accepted')
  )
);

create table public.es_event_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.es_event_teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('leader', 'member')),
  status text not null default 'invited'
    check (status in ('invited', 'active', 'declined', 'left', 'removed')),
  invited_by uuid not null references public.profiles (id) on delete cascade,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create index es_event_team_members_user_idx on public.es_event_team_members (user_id);

alter table public.es_event_team_members enable row level security;

create policy "read team membership" on public.es_event_team_members
for select to authenticated
using (
  user_id = auth.uid()
  or public.es_is_team_member(team_id)
  or exists (
    select 1 from public.es_event_teams t
    where t.id = team_id
      and (t.leader_user_id = auth.uid() or public.es_can_manage_event(t.event_id))
  )
);

create policy "leader invites members" on public.es_event_team_members
for insert to authenticated
with check (
  user_id <> auth.uid()
  and exists (
    select 1 from public.es_event_teams t
    where t.id = team_id
      and t.leader_user_id = auth.uid()
      and public.es_rate_ok('es_team_invite:' || auth.uid()::text, 30, interval '1 hour')
  )
);

create policy "members manage own membership" on public.es_event_team_members
for update to authenticated
using (
  user_id = auth.uid()  -- accept/decline/leave
  or exists (
    select 1 from public.es_event_teams t
    where t.id = team_id
      and (t.leader_user_id = auth.uid() or public.es_can_manage_event(t.event_id))
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1 from public.es_event_teams t
    where t.id = team_id
      and (t.leader_user_id = auth.uid() or public.es_can_manage_event(t.event_id))
  )
);

create policy "leader removes members" on public.es_event_team_members
for delete to authenticated
using (
  exists (
    select 1 from public.es_event_teams t
    where t.id = team_id
      and (t.leader_user_id = auth.uid() or public.es_can_manage_event(t.event_id))
  )
);

-- Team-size guard + leader integrity on membership change.
create or replace function public.es_validate_team_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.es_events%rowtype;
  v_team public.es_event_teams%rowtype;
  v_active integer;
begin
  select * into v_team from public.es_event_teams where id = coalesce(new.team_id, old.team_id);
  select * into v_event from public.es_events where id = v_team.event_id;

  if new.member_role = 'leader' and new.user_id <> v_team.leader_user_id then
    raise exception 'Only the team leader row may be marked leader';
  end if;

  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    select count(*) into v_active from public.es_event_team_members
    where team_id = v_team.id and status = 'active';
    if v_active >= v_event.max_team_size then
      raise exception 'Team is full (max % members)', v_event.max_team_size;
    end if;
  end if;

  -- invitation acceptance requires the target to hold a registration on the event
  if new.status = 'active' then
    if not exists (
      select 1 from public.es_registrations r
      where r.event_id = v_event.id and r.user_id = new.user_id
        and r.status in ('registered', 'pending', 'waitlisted')
    ) then
      raise exception 'Member must be registered for the event first';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger es_team_members_validate before insert or update on public.es_event_team_members
for each row execute function public.es_validate_team_membership();

-- ----------------------------------------------------------------------------
-- Registrations
-- ----------------------------------------------------------------------------
create table public.es_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.es_events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  participation_type text not null check (participation_type in ('individual', 'team')),
  team_id uuid references public.es_event_teams (id) on delete set null,
  status text not null default 'registered'
    check (status in ('registered', 'pending', 'waitlisted', 'withdrawn', 'cancelled', 'rejected')),
  answers jsonb not null default '[]'::jsonb,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index es_registrations_event_idx on public.es_registrations (event_id, status);
create index es_registrations_user_idx on public.es_registrations (user_id);
create trigger es_registrations_updated_at before update on public.es_registrations
for each row execute procedure moddatetime (updated_at);

-- Registration guard: window, capacity, approval flow, event settings.
create or replace function public.es_validate_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.es_events%rowtype;
  v_count integer;
begin
  select * into v_event from public.es_events where id = new.event_id;

  if v_event.status <> 'published' then
    raise exception 'Event is not published';
  end if;
  if not v_event.registration_enabled or not v_event.registration_open then
    raise exception 'Registration is closed';
  end if;
  if (tg_op = 'INSERT') then
    if v_event.registration_opens_at is not null and now() < v_event.registration_opens_at then
      raise exception 'Registration has not opened yet';
    end if;
    if v_event.registration_closes_at is not null and now() > v_event.registration_closes_at then
      raise exception 'Registration deadline has passed';
    end if;
    select count(*) into v_count from public.es_registrations
      where event_id = v_event.id and status in ('registered', 'pending', 'waitlisted');
    if v_event.registration_capacity is not null and v_count >= v_event.registration_capacity then
      if v_event.registration_capacity is not null and v_event.registration_approval then
        new.status := 'waitlisted';
      else
        raise exception 'Registration is full';
      end if;
    elsif v_event.registration_approval then
      new.status := 'pending';
    end if;
    if new.participation_type = 'team' then
      if v_event.participation = 'individual' then
        raise exception 'This event accepts individual participation only';
      end if;
      if new.team_id is null then
        raise exception 'Team registration requires a team';
      end if;
      if not exists (
        select 1 from public.es_event_team_members m
        where m.team_id = new.team_id and m.user_id = new.user_id and m.status = 'active'
      ) then
        raise exception 'Only active team members can register the team';
      end if;
    else
      if v_event.participation = 'team' then
        raise exception 'This event requires team participation';
      end if;
      new.team_id := null;
    end if;
    -- answers limited in size (no arbitrary payload flooding)
    if pg_column_size(new.answers) > 16000 then
      raise exception 'Registration answers too large';
    end if;
  else
    -- updates: only organiser may move out of pending/waitlisted; user may withdraw
    if old.status in ('withdrawn', 'cancelled', 'rejected')
       and new.status in ('registered', 'pending', 'waitlisted') then
      -- allow re-registration only while the window is still open
      if v_event.registration_opens_at is not null and now() < v_event.registration_opens_at then
        raise exception 'Registration has not opened yet';
      end if;
      if v_event.registration_closes_at is not null and now() > v_event.registration_closes_at then
        raise exception 'Registration deadline has passed';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger es_registrations_validate before insert or update on public.es_registrations
for each row execute function public.es_validate_registration();

alter table public.es_registrations enable row level security;

create policy "participants & organisers read registrations" on public.es_registrations
for select to authenticated
using (
  user_id = auth.uid()
  or public.es_can_manage_event(event_id)
  or exists (
    select 1 from public.es_event_team_members m
    where m.team_id = es_registrations.team_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

create policy "users register themselves" on public.es_registrations
for insert to authenticated
with check (
  user_id = auth.uid()
  and public.es_rate_ok('es_register:' || auth.uid()::text, 20, interval '1 hour')
);

create policy "users withdraw own registration" on public.es_registrations
for update to authenticated
using (
  user_id = auth.uid()
  or public.es_can_manage_event(event_id)
)
with check (
  user_id = auth.uid()
  or public.es_can_manage_event(event_id)
);

create policy "managers delete registrations" on public.es_registrations
for delete to authenticated
using (public.es_can_manage_event(event_id));

-- ----------------------------------------------------------------------------
-- Submissions (+ immutable snapshots)
-- ----------------------------------------------------------------------------
create table public.es_submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.es_events (id) on delete cascade,
  round_id uuid references public.es_event_rounds (id) on delete set null,
  owner_type text not null check (owner_type in ('individual', 'team')),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  team_id uuid references public.es_event_teams (id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'under_review', 'revision_requested',
                      'resubmitted', 'shortlisted', 'accepted', 'rejected', 'withdrawn')),
  data jsonb not null default '{}'::jsonb,
  snapshot jsonb,
  snapshot_version integer not null default 0,
  declarations jsonb not null default '{}'::jsonb,
  linked_project_kind text check (linked_project_kind in ('solution', 'hardware_project')),
  linked_project_id uuid,
  submitted_at timestamptz,
  revision_reason text check (char_length(revision_reason) <= 2000),
  review_note text check (char_length(review_note) <= 4000),
  shortlisted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, owner_type, owner_user_id),
  constraint es_submissions_owner_shape check (
    (owner_type = 'individual' and team_id is null)
    or (owner_type = 'team' and team_id is not null)
  )
);

create index es_submissions_event_idx on public.es_submissions (event_id, status);
create index es_submissions_owner_idx on public.es_submissions (owner_user_id);
create index es_submissions_team_idx on public.es_submissions (team_id);
create trigger es_submissions_updated_at before update on public.es_submissions
for each row execute procedure moddatetime (updated_at);

-- Submit workflow: snapshot immutability + deadline authority.
create or replace function public.es_submit_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.es_events%rowtype;
begin
  select * into v_event from public.es_events where id = new.event_id;

  if tg_op = 'UPDATE' then
    -- Ownership may never move.
    if new.owner_user_id <> old.owner_user_id or new.team_id is distinct from old.team_id
       or new.owner_type <> old.owner_type or new.event_id <> old.event_id then
      raise exception 'Submission ownership cannot be changed';
    end if;

    if new.status = 'draft' and old.status <> 'draft' and old.status <> 'revision_requested' then
      raise exception 'Only draft or revision-requested submissions can be edited';
    end if;

    if new.status in ('submitted', 'resubmitted') then
      if not public.es_submission_window_open(v_event.id) then
        raise exception 'Submission window is closed';
      end if;
      if v_event.evaluation_enabled then
        if v_event.judging_open then
          raise exception 'Judging already started; submissions are locked';
        end if;
      end if;
      if coalesce(pg_column_size(new.data), 0) > 200000 then
        raise exception 'Submission payload too large';
      end if;
      if coalesce(jsonb_array_length(new.declarations -> 'checks'), 0) = 0
         and (new.declarations ->> 'originality') is distinct from 'true' then
        raise exception 'Originality declaration is required to submit';
      end if;
      new.snapshot := new.data;
      new.snapshot_version := old.snapshot_version + 1;
      new.submitted_at := now();
    end if;

    -- Only organisers may set organiser-controlled statuses/notes.
    if (new.status in ('under_review', 'revision_requested', 'shortlisted', 'accepted', 'rejected'))
       and not public.es_can_manage_event(v_event.id) then
      raise exception 'Only the organiser can change review status';
    end if;
    if (new.review_note is distinct from old.review_note
        or new.revision_reason is distinct from old.revision_reason
        or new.shortlisted_at is distinct from old.shortlisted_at)
       and not public.es_can_manage_event(v_event.id) then
      raise exception 'Only the organiser can set review notes';
    end if;
    if new.status = 'withdrawn' and public.es_can_manage_event(v_event.id) then
      raise exception 'Organisers cannot withdraw a submission on behalf of participants';
    end if;
  else
    -- INSERT: must be a draft, owned by the caller, with a valid registration.
    if new.status <> 'draft' then
      raise exception 'New submissions start as drafts';
    end if;
    if new.owner_user_id <> auth.uid() then
      raise exception 'Submissions are created by their owner';
    end if;
    if not exists (
      select 1 from public.es_registrations r
      where r.event_id = new.event_id and r.user_id = auth.uid()
        and r.status in ('registered', 'pending', 'waitlisted')
    ) then
      raise exception 'Register for the event before submitting';
    end if;
    if new.owner_type = 'team' then
      if v_event.participation = 'individual' then
        raise exception 'This event accepts individual submissions only';
      end if;
      if not public.es_is_team_member(new.team_id) then
        raise exception 'Only active team members can create the team submission';
      end if;
    elsif v_event.participation = 'team' then
      raise exception 'This event requires team submissions';
    end if;
    if not public.es_rate_ok('es_submission_create:' || auth.uid()::text, 20, interval '1 day') then
      raise exception 'Too many submission attempts; try later';
    end if;
  end if;
  return new;
end;
$$;

create trigger es_submissions_guard before insert or update on public.es_submissions
for each row execute function public.es_submit_submission();

alter table public.es_submissions enable row level security;

create policy "stakeholders read submissions" on public.es_submissions
for select to authenticated
using (public.es_can_read_submission(id));

create policy "participants create own drafts" on public.es_submissions
for insert to authenticated
with check (
  owner_user_id = auth.uid()
  and public.es_is_participant(event_id)
);

create policy "owners & organisers update submissions" on public.es_submissions
for update to authenticated
using (public.es_is_submission_owner(id) or public.es_can_manage_event(event_id))
with check (public.es_is_submission_owner(id) or public.es_can_manage_event(event_id));

create policy "owners & organisers delete submissions" on public.es_submissions
for delete to authenticated
using (
  (public.es_is_submission_owner(id) and status = 'draft')
  or public.es_can_manage_event(event_id)
);

-- Immutable submission snapshots (append-only; organisers & judges read).
create table public.es_submission_snapshots (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.es_submissions (id) on delete cascade,
  version integer not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (submission_id, version)
);

create index es_submission_snapshots_sub_idx on public.es_submission_snapshots (submission_id, version desc);

alter table public.es_submission_snapshots enable row level security;

create policy "stakeholders read snapshots" on public.es_submission_snapshots
for select to authenticated
using (public.es_can_read_submission(submission_id));

-- No insert/update/delete policies for regular roles: snapshots are written
-- only by the SECURITY DEFINER trigger below.

create or replace function public.es_record_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.snapshot is not null and (tg_op = 'INSERT' or new.snapshot is distinct from old.snapshot) then
    insert into public.es_submission_snapshots (submission_id, version, data)
      values (new.id, new.snapshot_version, new.snapshot)
      on conflict (submission_id, version) do nothing;
  end if;
  return null;
end;
$$;

create trigger es_submissions_snapshot after insert or update on public.es_submissions
for each row execute function public.es_record_snapshot();

-- ----------------------------------------------------------------------------
-- Submission files (private bucket objects; path = "{submissionId}/{uuid}-name")
-- ----------------------------------------------------------------------------
create table public.es_submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.es_submissions (id) on delete cascade,
  storage_path text not null unique check (
    char_length(storage_path) <= 500
    and storage_path like 'es_submission_files/%'
  ),
  object_key text not null check (char_length(object_key) <= 400),
  file_name text not null check (char_length(file_name) between 1 and 200),
  mime_type text not null check (mime_type in (
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip'
  )),
  size_bytes integer not null check (size_bytes between 1 and 52428800),
  kind text not null default 'supporting'
    check (kind in ('presentation', 'document', 'screenshot', 'supporting')),
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index es_submission_files_sub_idx on public.es_submission_files (submission_id);

alter table public.es_submission_files enable row level security;

create policy "stakeholders read file metadata" on public.es_submission_files
for select to authenticated
using (public.es_can_read_submission(submission_id));

create policy "owners upload files" on public.es_submission_files
for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and public.es_is_submission_owner(submission_id)
  and public.es_rate_ok('es_file_up:' || auth.uid()::text, 60, interval '1 hour')
);

create policy "owners manage own file rows" on public.es_submission_files
for delete to authenticated
using (
  uploaded_by = auth.uid()
  and public.es_is_submission_owner(submission_id)
);

create policy "owners replace file rows" on public.es_submission_files
for update to authenticated
using (
  uploaded_by = auth.uid()
  and public.es_is_submission_owner(submission_id)
)
with check (
  uploaded_by = auth.uid()
  and public.es_is_submission_owner(submission_id)
);

-- ----------------------------------------------------------------------------
-- Judge assignments + evaluations
-- ----------------------------------------------------------------------------
create table public.es_judge_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.es_events (id) on delete cascade,
  judge_user_id uuid not null references public.profiles (id) on delete cascade,
  submission_id uuid not null references public.es_submissions (id) on delete cascade,
  status text not null default 'assigned'
    check (status in ('assigned', 'in_progress', 'completed', 'removed')),
  assigned_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (submission_id, judge_user_id)
);

create index es_judge_assignments_judge_idx on public.es_judge_assignments (judge_user_id, status);
create index es_judge_assignments_event_idx on public.es_judge_assignments (event_id);

alter table public.es_judge_assignments enable row level security;

create policy "judge & organiser read assignments" on public.es_judge_assignments
for select to authenticated
using (
  judge_user_id = auth.uid()
  or public.es_can_manage_event(event_id)
);

create policy "organisers assign judges" on public.es_judge_assignments
for insert to authenticated
with check (
  assigned_by = auth.uid()
  and public.es_can_manage_event(event_id)
  and exists (
    select 1 from public.es_submissions s
    where s.id = submission_id and s.event_id = event_id
      and s.status in ('submitted', 'resubmitted', 'under_review', 'shortlisted')
  )
);

create policy "organisers update assignments" on public.es_judge_assignments
for update to authenticated
using (public.es_can_manage_event(event_id) or judge_user_id = auth.uid())
with check (public.es_can_manage_event(event_id) or judge_user_id = auth.uid());

create policy "organisers revoke assignments" on public.es_judge_assignments
for delete to authenticated
using (public.es_can_manage_event(event_id));

create table public.es_evaluations (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.es_judge_assignments (id) on delete cascade,
  scores jsonb not null default '[]'::jsonb,
  total_score numeric(5, 2),
  private_notes text check (char_length(private_notes) <= 6000),
  feedback text check (char_length(feedback) <= 6000),
  recommendation text check (recommendation in ('none', 'shortlist', 'accept', 'reject')),
  is_draft boolean not null default true,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index es_evaluations_assignment_idx on public.es_evaluations (assignment_id);
create trigger es_evaluations_updated_at before update on public.es_evaluations
for each row execute procedure moddatetime (updated_at);

alter table public.es_evaluations enable row level security;

create policy "judge reads own evaluation" on public.es_evaluations
for select to authenticated
using (
  exists (
    select 1 from public.es_judge_assignments a
    where a.id = assignment_id
      and (a.judge_user_id = auth.uid() or public.es_can_manage_event(a.event_id))
  )
);

create policy "assigned judge writes evaluation" on public.es_evaluations
for insert to authenticated
with check (
  exists (
    select 1 from public.es_judge_assignments a
    where a.id = assignment_id
      and a.judge_user_id = auth.uid()
      and a.status <> 'removed'
  )
  and public.es_rate_ok('es_eval:' || auth.uid()::text, 200, interval '1 hour')
);

create policy "assigned judge updates own evaluation" on public.es_evaluations
for update to authenticated
using (
  exists (
    select 1 from public.es_judge_assignments a
    where a.id = assignment_id and a.judge_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.es_judge_assignments a
    where a.id = assignment_id and a.judge_user_id = auth.uid()
  )
);

-- Evaluation scoring authority: server recomputes the weighted total from the
-- event rubric; a final evaluation must score every criterion.
create or replace function public.es_validate_evaluation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.es_judge_assignments%rowtype;
  v_event public.es_events%rowtype;
  v_total numeric;
  v_expected integer;
begin
  select * into v_assignment from public.es_judge_assignments where id = new.assignment_id;
  select * into v_event from public.es_events where id = v_assignment.event_id;

  if v_event.evaluation_criteria is null or jsonb_array_length(v_event.evaluation_criteria) = 0 then
    raise exception 'Event has no evaluation criteria configured';
  end if;

  select sum((c ->> 'score')::numeric * (r ->> 'weight')::numeric / 10)
    into v_total
  from jsonb_array_elements(new.scores) s
  join jsonb_array_elements(v_event.evaluation_criteria) r
    on r ->> 'name' = s ->> 'criterion'
  join jsonb_array_elements(v_event.evaluation_criteria) c
    on c ->> 'name' = s ->> 'criterion';

  if v_total is null then
    raise exception 'Scores must use the event rubric criterion names';
  end if;

  select count(*) into v_expected from jsonb_array_elements(v_event.evaluation_criteria);

  if not new.is_draft and (
    select count(*) from jsonb_array_elements(new.scores) s
    where (s ->> 'score') is not null
  ) < v_expected then
    raise exception 'Final evaluation must score every criterion';
  end if;

  new.total_score := round(v_total, 2);

  if not new.is_draft then
    new.submitted_at := now();
    update public.es_judge_assignments set status = 'completed' where id = new.assignment_id;
  else
    update public.es_judge_assignments set status = 'in_progress'
      where id = new.assignment_id and status = 'assigned';
  end if;
  return new;
end;
$$;

create trigger es_evaluations_validate before insert or update on public.es_evaluations
for each row execute function public.es_validate_evaluation();

-- ----------------------------------------------------------------------------
-- Awards + results
-- ----------------------------------------------------------------------------
create table public.es_awards (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.es_events (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  description text check (char_length(description) <= 2000),
  category text not null default 'custom'
    check (category in ('winner', 'runner_up', 'second_runner_up', 'best_innovation',
                        'best_prototype', 'best_research', 'special_recognition', 'custom')),
  prize_text text check (char_length(prize_text) <= 1000),
  certificate_text text check (char_length(certificate_text) <= 1000),
  sponsor text check (char_length(sponsor) <= 200),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index es_awards_event_idx on public.es_awards (event_id, sort_order);

alter table public.es_awards enable row level security;

create policy "public read awards of public events" on public.es_awards
for select to anon, authenticated
using (
  exists (
    select 1 from public.es_events e
    where e.id = event_id and e.status = 'published' and e.visibility = 'public'
  )
  or public.es_can_manage_event(event_id)
  or public.es_is_participant(event_id)
);

create policy "managers manage awards" on public.es_awards
for insert to authenticated with check (public.es_can_manage_event(event_id));

create policy "managers update awards" on public.es_awards
for update to authenticated
using (public.es_can_manage_event(event_id))
with check (public.es_can_manage_event(event_id));

create policy "managers delete awards" on public.es_awards
for delete to authenticated
using (public.es_can_manage_event(event_id));

create table public.es_results (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.es_events (id) on delete cascade,
  award_id uuid not null references public.es_awards (id) on delete cascade,
  submission_id uuid not null references public.es_submissions (id) on delete cascade,
  position integer check (position between 1 and 100),
  note text check (char_length(note) <= 1000),
  published boolean not null default false,
  published_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (award_id, submission_id)
);

create index es_results_event_idx on public.es_results (event_id);

alter table public.es_results enable row level security;

create policy "managers manage results" on public.es_results
for select to authenticated
using (public.es_can_manage_event(event_id));

create policy "organisers create results" on public.es_results
for insert to authenticated
with check (
  created_by = auth.uid()
  and public.es_can_manage_event(event_id)
  and exists (
    select 1 from public.es_submissions s
    where s.id = submission_id and s.event_id = event_id
  )
);

create policy "managers update results" on public.es_results
for update to authenticated
using (public.es_can_manage_event(event_id))
with check (public.es_can_manage_event(event_id));

create policy "managers delete results" on public.es_results
for delete to authenticated
using (public.es_can_manage_event(event_id));

-- Public results view: only published results of published events, and only
-- showcase-safe project fields — never private payloads or judge data.
create view public.es_public_results
with (security_invoker = true) as
select
  r.id, r.event_id, r.award_id, r.submission_id, r.position, r.note,
  a.name as award_name, a.category as award_category,
  e.title as event_title, e.slug as event_slug,
  sh.approved_title, sh.approved_summary, sh.approved_demo_url, sh.approved_github_url,
  sh.team_attribution, sh.image_path, sh.status as showcase_status
from public.es_results r
join public.es_awards a on a.id = r.award_id
join public.es_events e on e.id = r.event_id
left join public.es_showcases sh on sh.submission_id = r.submission_id
where r.published = true
  and e.status in ('published', 'completed', 'archived')
  and e.results_published = true;

grant select on public.es_public_results to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Announcements
-- ----------------------------------------------------------------------------
create table public.es_announcements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.es_events (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 160),
  body text not null check (char_length(body) between 1 and 5000),
  audience text not null default 'participants'
    check (audience in ('participants', 'judges', 'all')),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index es_announcements_event_idx on public.es_announcements (event_id, created_at desc);

alter table public.es_announcements enable row level security;

create policy "stakeholders read announcements" on public.es_announcements
for select to authenticated
using (
  public.es_is_participant(event_id)
  or public.es_can_manage_event(event_id)
  or public.es_is_assigned_judge_announcements(event_id)
);

create policy "managers create announcements" on public.es_announcements
for insert to authenticated
with check (created_by = auth.uid() and public.es_can_manage_event(event_id));

create policy "managers manage announcements" on public.es_announcements
for update to authenticated
using (public.es_can_manage_event(event_id))
with check (public.es_can_manage_event(event_id));

create policy "managers delete announcements" on public.es_announcements
for delete to authenticated
using (public.es_can_manage_event(event_id));

-- helper used above (judges can read judge-audience announcements)
create or replace function public.es_is_assigned_judge_announcements(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.es_judge_assignments ja
    where ja.event_id = p_event_id and ja.judge_user_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- Showcase (owner-approved, organiser-published)
-- ----------------------------------------------------------------------------
create table public.es_showcases (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.es_events (id) on delete cascade,
  submission_id uuid not null unique references public.es_submissions (id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'pending_approval', 'owner_approved', 'published', 'unpublished')),
  approved_title text not null check (char_length(approved_title) between 4 and 180),
  approved_summary text not null check (char_length(approved_summary) between 20 and 3000),
  approved_problem text check (char_length(approved_problem) <= 3000),
  approved_solution text check (char_length(approved_solution) <= 3000),
  team_attribution jsonb not null default '[]'::jsonb,
  image_path text check (char_length(image_path) <= 400),
  approved_demo_url text check (char_length(approved_demo_url) <= 400 and approved_demo_url ~ '^https?://[^[:space:]]+$'),
  approved_github_url text check (char_length(approved_github_url) <= 400 and approved_github_url ~ '^https?://[^[:space:]]+$'),
  owner_approved_by uuid references public.profiles (id) on delete set null,
  owner_approved_at timestamptz,
  published_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint es_showcase_publish_requires_owner
    check (status <> 'published' or (owner_approved_by is not null and published_at is not null))
);

create index es_showcases_event_idx on public.es_showcases (event_id, status);

alter table public.es_showcases enable row level security;

create policy "public read published showcases" on public.es_showcases
for select to anon
using (
  status = 'published'
  and exists (
    select 1 from public.es_events e
    where e.id = event_id and e.status in ('published', 'completed', 'archived')
      and e.visibility = 'public'
  )
);

create policy "auth read showcases" on public.es_showcases
for select to authenticated
using (
  status = 'published'
  or public.es_is_submission_owner(submission_id)
  or public.es_can_manage_event(event_id)
  or public.is_platform_admin()
);

create policy "owners create showcase drafts" on public.es_showcases
for insert to authenticated
with check (
  created_by = auth.uid()
  and public.es_is_submission_owner(submission_id)
  and exists (
    select 1 from public.es_submissions s
    where s.id = submission_id and s.status in ('accepted', 'shortlisted')
  )
);

create policy "owners & organisers update showcases" on public.es_showcases
for update to authenticated
using (
  public.es_is_submission_owner(submission_id)
  or public.es_can_manage_event(event_id)
)
with check (
  public.es_is_submission_owner(submission_id)
  or public.es_can_manage_event(event_id)
);

-- State machine guard: only the OWNER can mark owner-approved; only the
-- ORGANISER can publish; publishing requires owner approval first.
create or replace function public.es_validate_showcase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status <> 'draft' then
    raise exception 'Showcases start as drafts';
  end if;
  if tg_op = 'UPDATE' then
    if new.status = 'owner_approved' and old.status <> 'owner_approved' then
      if not exists (
        select 1 from public.es_submissions s
        where s.id = new.submission_id
          and (
            (s.owner_type = 'individual' and s.owner_user_id = auth.uid())
            or (s.owner_type = 'team' and s.team_id is not null and public.es_is_team_member(s.team_id))
          )
      ) then
        raise exception 'Only the project owner/team can approve their showcase';
      end if;
      new.owner_approved_by := auth.uid();
      new.owner_approved_at := now();
    end if;
    if new.status = 'published' then
      if not public.es_can_manage_event(new.event_id) then
        raise exception 'Only the organiser can publish a showcase';
      end if;
      if new.owner_approved_by is null then
        raise exception 'Owner approval is required before publishing';
      end if;
      new.published_by := auth.uid();
      new.published_at := now();
    end if;
    if new.status = 'unpublished' and not (
      public.es_can_manage_event(new.event_id)
      or public.es_is_submission_owner(new.submission_id)
    ) then
      raise exception 'Only the organiser or owner can unpublish';
    end if;
  end if;
  return new;
end;
$$;

create trigger es_showcases_validate before insert or update on public.es_showcases
for each row execute function public.es_validate_showcase();

-- Public showcase listing view (showcase-safe fields only).
create view public.es_public_showcases
with (security_invoker = true) as
select
  s.id, s.event_id, s.submission_id, s.approved_title, s.approved_summary,
  s.approved_problem, s.approved_solution, s.team_attribution, s.image_path,
  s.approved_demo_url, s.approved_github_url, s.published_at,
  e.title as event_title, e.slug as event_slug, e.category as event_category
from public.es_showcases s
join public.es_events e on e.id = s.event_id
where s.status = 'published'
  and e.status in ('published', 'completed', 'archived')
  and e.visibility = 'public';

grant select on public.es_public_showcases to anon, authenticated;

-- ----------------------------------------------------------------------------
-- content_reports: additively allow reporting EventSpace content
-- ----------------------------------------------------------------------------
alter table public.content_reports drop constraint content_reports_subject_type_check;
alter table public.content_reports add constraint content_reports_subject_type_check
  check (subject_type in (
    'problem', 'solution', 'hardware_project', 'company_project', 'opportunity',
    'comment', 'es_event', 'es_submission', 'es_showcase'
  ));

-- ----------------------------------------------------------------------------
-- PRIVATE storage bucket for submission files
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'es_submission_files', 'es_submission_files', false, 52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Objects are stored as "es_submission_files/{submissionId}/{uuid}-{filename}".
-- Access is re-derived server-side from the submission id via helpers, so a
-- crafted path can never reach another participant's files.
create policy "stakeholders read submission files" on storage.objects
for select to authenticated
using (
  bucket_id = 'es_submission_files'
  and public.es_can_read_submission(
    ((storage.foldername(name))[1])::uuid
  )
);

create policy "owners upload submission files" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'es_submission_files'
  and public.es_is_submission_owner(
    ((storage.foldername(name))[1])::uuid
  )
);

create policy "owners replace submission files" on storage.objects
for update to authenticated
using (
  bucket_id = 'es_submission_files'
  and public.es_is_submission_owner(
    ((storage.foldername(name))[1])::uuid
  )
)
with check (
  bucket_id = 'es_submission_files'
  and public.es_is_submission_owner(
    ((storage.foldername(name))[1])::uuid
  )
);

create policy "owners & organisers delete submission files" on storage.objects
for delete to authenticated
using (
  bucket_id = 'es_submission_files'
  and (
    public.es_is_submission_owner(((storage.foldername(name))[1])::uuid)
    or public.es_can_review_submission(((storage.foldername(name))[1])::uuid)
  )
);

-- ----------------------------------------------------------------------------
-- Audit note: event administration writes to the existing audit_logs table via
-- the client (writeAuditLog) with actions prefixed "es_"; RLS on audit_logs
-- already restricts reads to platform admins.
-- ============================================================================

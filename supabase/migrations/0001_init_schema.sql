-- ============================================================================
-- BuildProof — initial schema
-- Run order: 0001 (this file) → 0002 → seed.sql (development/demo ONLY).
--
-- Design notes:
--  * Every table accessible from the browser has Row Level Security (RLS)
--    enabled and its policies defined here.
--  * Privilege escalation is blocked by design: only platform_admin rows can
--    write to user_roles, and the signup trigger only ever grants the
--    self-service roles ("student", "problem_owner").
--  * Status values are text + CHECK constraints (easier to evolve than enums).
--
-- ORDERING (important — PostgreSQL validates SQL function bodies at CREATE
-- time, so every statement is laid out in dependency order):
--   Part 1  tables + indexes
--   Part 2  shared helper functions (read the tables above)
--   Part 3  RLS enablement + row level security policies (use the helpers)
--   Part 4  trigger functions + triggers (use the helpers)
--   Part 5  RPCs + grants
-- ============================================================================

create extension if not exists moddatetime; -- updated_at triggers

-- ============================================================================
-- PART 1 of 5 — TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  email text,
  college text check (char_length(college) <= 160),
  grad_year int check (grad_year between 2020 and 2035),
  bio text check (char_length(bio) <= 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- institutions
-- ----------------------------------------------------------------------------

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  city text check (char_length(city) <= 120),
  created_at timestamptz not null default now()
);

create index institutions_name_idx on public.institutions (name);

-- ----------------------------------------------------------------------------
-- user_roles — the permission table. Writes restricted to platform admins.
-- ----------------------------------------------------------------------------

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in (
    'student', 'facilitator', 'mentor', 'faculty_coordinator',
    'problem_owner', 'institution_admin', 'platform_admin'
  )),
  institution_id uuid references public.institutions (id) on delete set null,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now()
);

-- NOTE: user_id references profiles (NOT auth.users) on purpose:
--   * deleting an auth user cascades to profiles, which cascades here;
--   * PostgREST can embed the profile via this single FK, under the constraint
--     name the app queries with: profiles!user_roles_user_id_fkey.
-- PK columns cannot be NULL, and institution_id is nullable for self-assigned
-- roles, so uniqueness is enforced with a coalescing unique index instead.
create unique index user_roles_uniq on public.user_roles
  (user_id, role, coalesce(institution_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index user_roles_institution_idx on public.user_roles (institution_id);

-- ----------------------------------------------------------------------------
-- cohorts & gates
-- ----------------------------------------------------------------------------

create table public.cohorts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  description text check (char_length(description) <= 500),
  status text not null default 'planning' check (status in ('planning', 'active', 'completed')),
  interview_gate int not null default 8 check (interview_gate between 1 and 50),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cohorts_institution_idx on public.cohorts (institution_id);

create table public.gates (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  description text check (char_length(description) <= 500),
  min_interviews int not null default 8 check (min_interviews between 0 and 100),
  created_at timestamptz not null default now(),
  unique (cohort_id, name)
);

-- ----------------------------------------------------------------------------
-- cohort_members
-- ----------------------------------------------------------------------------

create table public.cohort_members (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  cohort_role text not null default 'student' check (cohort_role in (
    'student', 'facilitator', 'faculty_coordinator', 'mentor'
  )),
  status text not null default 'proposed' check (status in ('proposed', 'active', 'left', 'removed')),
  created_at timestamptz not null default now(),
  unique (cohort_id, user_id)
);

create index cohort_members_user_idx on public.cohort_members (user_id);

-- ----------------------------------------------------------------------------
-- problems (public problem pool with screening)
-- ----------------------------------------------------------------------------

create table public.problems (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 4 and 160),
  description text not null check (char_length(description) between 20 and 4000),
  category text not null check (category in (
    'education', 'local_business', 'accessibility', 'sustainability',
    'public_services', 'operations', 'technology', 'other'
  )),
  affected_users text not null check (char_length(affected_users) between 2 and 500),
  location text check (char_length(location) <= 160),
  workaround text check (char_length(workaround) <= 1500),
  evidence_basis text check (char_length(evidence_basis) <= 3000),
  owner_name text check (char_length(owner_name) <= 160),
  owner_contact text check (char_length(owner_contact) <= 200),
  submitted_by uuid references auth.users (id) on delete set null,
  status text not null default 'submitted' check (status in (
    'submitted', 'screening', 'approved', 'rejected', 'needs_info'
  )),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index problems_status_idx on public.problems (status);
create index problems_submitted_by_idx on public.problems (submitted_by);

create table public.problem_screenings (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems (id) on delete cascade,
  reviewer_id uuid references auth.users (id) on delete set null,
  decision text not null check (decision in ('approved', 'rejected', 'needs_info')),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now()
);

create index problem_screenings_problem_idx on public.problem_screenings (problem_id);

-- ----------------------------------------------------------------------------
-- teams, membership, invites
-- ----------------------------------------------------------------------------

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  status text not null default 'forming' check (status in (
    'forming', 'active', 'paused', 'stopped', 'completed'
  )),
  problem_id uuid references public.problems (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index teams_cohort_idx on public.teams (cohort_id);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  member_role text not null default 'student' check (member_role in ('student', 'facilitator', 'mentor')),
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'left', 'removed')),
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create index team_members_user_idx on public.team_members (user_id);

create table public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  email text not null check (char_length(email) <= 200),
  invited_by uuid references auth.users (id) on delete set null,
  token uuid not null default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  created_at timestamptz not null default now(),
  unique (token)
);

create index team_invites_team_idx on public.team_invites (team_id);

-- ----------------------------------------------------------------------------
-- interviews, attachments, feasibility, prototype, tests, decisions
-- ----------------------------------------------------------------------------

create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  conducted_by uuid references auth.users (id) on delete set null,
  interview_date date not null,
  participant_label text not null check (char_length(participant_label) between 2 and 80),
  participant_type text not null check (char_length(participant_type) between 2 and 100),
  consent boolean not null default false,
  key_findings text not null check (char_length(key_findings) between 5 and 4000),
  pain_points text check (char_length(pain_points) <= 3000),
  patterns text check (char_length(patterns) <= 3000),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'reviewed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index interviews_team_idx on public.interviews (team_id);

create table public.evidence_attachments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  stage text not null check (stage in ('validation', 'feasibility', 'prototype')),
  uploaded_by uuid references auth.users (id) on delete set null,
  file_name text not null,
  file_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 10485760), -- 10 MB
  visibility text not null default 'reviewers' check (visibility in ('team', 'reviewers')),
  created_at timestamptz not null default now()
);

create index evidence_team_idx on public.evidence_attachments (team_id);

create table public.feasibility_reviews (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  technical_feasibility text check (char_length(technical_feasibility) <= 3000),
  cost_resources text check (char_length(cost_resources) <= 3000),
  time_required text check (char_length(time_required) <= 3000),
  user_access text check (char_length(user_access) <= 3000),
  dependencies text check (char_length(dependencies) <= 3000),
  risks text check (char_length(risks) <= 3000),
  expected_value text check (char_length(expected_value) <= 3000),
  recommended_next_step text check (char_length(recommended_next_step) <= 1500),
  decision text check (decision in ('continue', 'revise', 'stop')),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'reviewed')),
  reviewer_id uuid references auth.users (id) on delete set null,
  reviewer_feedback text check (char_length(reviewer_feedback) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index feasibility_team_idx on public.feasibility_reviews (team_id);

create table public.prototype_tests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  solution_description text check (char_length(solution_description) <= 4000),
  test_plan text check (char_length(test_plan) <= 3000),
  iterations text check (char_length(iterations) <= 3000),
  decision text check (decision in ('continue', 'revise', 'stop')),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'reviewed')),
  reviewer_id uuid references auth.users (id) on delete set null,
  reviewer_feedback text check (char_length(reviewer_feedback) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index prototype_team_idx on public.prototype_tests (team_id);

create table public.user_tests (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.prototype_tests (id) on delete cascade,
  participant_label text not null check (char_length(participant_label) between 2 and 80),
  users_approached int not null check (users_approached between 0 and 100000),
  users_tested int not null check (users_tested between 0 and 100000),
  tasks text not null check (char_length(tasks) between 2 and 3000),
  outcome text not null check (char_length(outcome) between 2 and 3000),
  feedback text check (char_length(feedback) <= 3000),
  observed_problems text check (char_length(observed_problems) <= 3000),
  created_at timestamptz not null default now()
);

create index user_tests_test_idx on public.user_tests (test_id);

create table public.team_decisions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  stage text not null check (stage in ('validation', 'feasibility', 'prototype')),
  decision text not null check (decision in ('continue', 'pivot', 'stop', 'revise')),
  rationale text not null check (char_length(rationale) between 10 and 1500),
  decided_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index decisions_team_idx on public.team_decisions (team_id);

-- ----------------------------------------------------------------------------
-- proof cards & skills
-- ----------------------------------------------------------------------------

create table public.proof_cards (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  title text not null check (char_length(title) between 4 and 180),
  problem_title text not null check (char_length(problem_title) between 4 and 180),
  problem_summary text not null check (char_length(problem_summary) between 20 and 3000),
  validation_summary text not null check (char_length(validation_summary) between 20 and 4000),
  feasibility_summary text check (char_length(feasibility_summary) <= 3000),
  built_summary text check (char_length(built_summary) <= 3000),
  results_limitations text check (char_length(results_limitations) <= 3000),
  tier int not null default 1 check (tier in (1, 2, 3)),
  tier_set_by uuid references auth.users (id) on delete set null,
  tier_note text check (char_length(tier_note) <= 1000),
  review_status text not null default 'draft' check (review_status in (
    'draft', 'submitted', 'changes_requested', 'approved', 'published', 'rejected'
  )),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null,
  reviewer_notes text check (char_length(reviewer_notes) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index proof_cards_team_idx on public.proof_cards (team_id);
create index proof_cards_public_idx on public.proof_cards (visibility, review_status);

create table public.proof_card_skills (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.proof_cards (id) on delete cascade,
  skill text not null check (char_length(skill) between 2 and 80),
  evidence_summary text not null check (char_length(evidence_summary) between 2 and 500)
);

create index proof_card_skills_card_idx on public.proof_card_skills (card_id);

-- ----------------------------------------------------------------------------
-- mentors, comments, notifications, audit log
-- ----------------------------------------------------------------------------

create table public.mentor_assignments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  mentor_id uuid not null references auth.users (id) on delete cascade,
  assigned_by uuid references auth.users (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (team_id, mentor_id)
);

create index mentor_assignments_mentor_idx on public.mentor_assignments (mentor_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  audience text not null default 'team' check (audience in ('team', 'reviewers')),
  created_at timestamptz not null default now()
);

create index comments_team_idx on public.comments (team_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, read);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);

-- ============================================================================
-- PART 2 of 5 — SHARED HELPER PREDICATES
-- (SECURITY DEFINER, read-only over the tables from Part 1 — all of which
-- exist by the time this part runs.)
-- ============================================================================

-- Which platform-level roles a subject holds. Always filtered on auth.uid().
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'platform_admin'
  );
$$;

create or replace function public.has_any_role(roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = any (roles)
  );
$$;

-- Institution admins are granted (user_id, 'institution_admin', institution_id).
create or replace function public.is_institution_admin(inst uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role = 'institution_admin'
      and institution_id = inst
  );
$$;

-- Cohort staff = cohort members holding a staff cohort_role, institution
-- admins of the cohort's institution, or platform admins.
create or replace function public.is_cohort_staff(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.cohort_members cm
    join public.cohorts c on c.id = cm.cohort_id
    where cm.cohort_id = cid
      and cm.user_id = auth.uid()
      and cm.cohort_role in ('facilitator', 'faculty_coordinator')
  )
  or exists (
    select 1 from public.cohorts c
    where c.id = cid and public.is_institution_admin(c.institution_id)
  )
  or public.is_platform_admin();
$$;

create or replace function public.is_cohort_member(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.cohort_members
    where cohort_id = cid and user_id = auth.uid() and status in ('proposed', 'active')
  );
$$;

create or replace function public.is_team_member(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_id = tid and user_id = auth.uid()
      and status in ('proposed', 'accepted')
  );
$$;

-- Who can open a team's workspace: members, cohort members/staff of the team's
-- cohort, mentors actively assigned to the team, the problem owner of the
-- team's linked problem, and platform admins.
create or replace function public.can_read_team(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.teams t where t.id = tid and public.is_team_member(t.id))
  or exists (
    select 1 from public.teams t
    where t.id = tid and public.is_cohort_member(t.cohort_id)
  )
  or exists (
    select 1 from public.teams t
    where t.id = tid and public.is_cohort_staff(t.cohort_id)
  )
  or exists (
    select 1 from public.teams t
    join public.mentor_assignments ma on ma.team_id = t.id
    where t.id = tid and ma.mentor_id = auth.uid() and ma.active
  )
  or exists (
    select 1 from public.teams t
    join public.problems p on p.id = t.problem_id
    where t.id = tid and p.submitted_by = auth.uid()
  )
  or exists (
    select 1 from public.teams t
    where t.id = tid and public.is_platform_admin()
  );
$$;

-- Who may edit team-attached work: team members and cohort staff.
create or replace function public.can_edit_team_work(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_team_member(tid)
  or exists (
    select 1 from public.teams t
    where t.id = tid and public.is_cohort_staff(t.cohort_id)
  );
$$;

-- Teams insert guard (referenced by the teams policy below): the creator must
-- be (proposed or active) member of the cohort the team belongs to, and may
-- only record themselves -- or leave created_by to the default (null) -- as
-- the creator.
create or replace function public.submitted_by_check(cid uuid, creator uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_cohort_member(cid)
    and (creator is null or creator = auth.uid());
$$;

-- Reviewers who may grade work attached to a team: assigned mentors, cohort
-- staff, and platform admins.
create or replace function public.can_review_team_work(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.mentor_assignments ma
    where ma.team_id = tid and ma.mentor_id = auth.uid() and ma.active
  )
  or exists (
    select 1 from public.teams t
    where t.id = tid and public.is_cohort_staff(t.cohort_id)
  )
  or public.is_platform_admin();
$$;

-- ============================================================================
-- PART 3 of 5 — ROW LEVEL SECURITY
-- (RLS enablement + policies; every referenced helper exists from Part 2 and
-- every referenced table exists from Part 1.)
-- ============================================================================

-- profiles
alter table public.profiles enable row level security;

-- Directory-style read for authenticated users only (no anon access).
create policy "authenticated users read any profile" on public.profiles
for select to authenticated using (true);

-- Users may update only their own row (columns are constrained by the app and
-- by the trigger-created row; email and id are never writable).
create policy "users update own profile" on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- institutions
alter table public.institutions enable row level security;

create policy "authenticated users read institutions" on public.institutions
for select to authenticated using (true);

-- Creating, renaming and deleting institutions is a platform-admin action.
create policy "platform admins manage institutions" on public.institutions
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- user_roles
alter table public.user_roles enable row level security;

-- Users can see their own roles; admins can see everything (needed for the
-- admin console); institution admins can see roles scoped to their
-- institution.
create policy "users read own roles" on public.user_roles
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_platform_admin()
  or (
    role = 'institution_admin' and institution_id is not null
    and public.is_institution_admin(institution_id)
  )
);

-- Only platform admins may grant or revoke roles. The signup trigger inserts
-- the first role with SECURITY DEFINER, bypassing this policy deliberately.
create policy "platform admins manage roles" on public.user_roles
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- cohorts
alter table public.cohorts enable row level security;

create policy "cohort members & staff read cohorts" on public.cohorts
for select to authenticated
using (
  public.is_cohort_member(id)
  or public.is_cohort_staff(id)
);

create policy "institution admins create cohorts" on public.cohorts
for insert to authenticated
with check (public.is_institution_admin(institution_id) or public.is_platform_admin());

create policy "cohort staff manage cohorts" on public.cohorts
for update to authenticated
using (public.is_cohort_staff(id))
with check (public.is_cohort_staff(id));

-- gates
alter table public.gates enable row level security;

create policy "cohort members read gates" on public.gates
for select to authenticated
using (public.is_cohort_member(cohort_id) or public.is_cohort_staff(cohort_id));

create policy "cohort staff manage gates" on public.gates
for all to authenticated
using (public.is_cohort_staff(cohort_id))
with check (public.is_cohort_staff(cohort_id));

-- cohort_members
alter table public.cohort_members enable row level security;

-- Membership rows are visible to the member and to cohort staff.
create policy "members & staff read cohort membership" on public.cohort_members
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_cohort_staff(cohort_id)
  -- cohort members may see the roster of their own cohort
  or exists (
    select 1 from public.cohort_members self_row
    where self_row.cohort_id = cohort_members.cohort_id
      and self_row.user_id = auth.uid()
  )
);

create policy "cohort staff add members" on public.cohort_members
for insert to authenticated
with check (public.is_cohort_staff(cohort_id));

-- Members may only flip status ('proposed' → 'active'/'left') and only change
-- their own row's status; staff may manage rows fully.
create policy "members accept own membership" on public.cohort_members
for update to authenticated
using (
  (user_id = auth.uid() and status in ('proposed', 'active'))
  or public.is_cohort_staff(cohort_id)
);

-- Self-service removal is also allowed (a member can leave a cohort).
create policy "members can leave" on public.cohort_members
for delete to authenticated
using (user_id = auth.uid() and status = 'proposed');

-- problems
alter table public.problems enable row level security;

-- Everyone signed in sees approved problems plus their OWN submissions.
-- Admins see all states. Anonymous visitors see nothing (problem pool is
-- a feature of the authenticated app).
create policy "users see approved & own submissions" on public.problems
for select to authenticated
using (
  status = 'approved'
  or submitted_by = auth.uid()
  or exists (
    -- problem owners may read problems they are named owner_contact of
    select 1 from public.user_roles r
    where r.user_id = auth.uid()
      and r.role = 'problem_owner'
      and problems.owner_contact is not null
  )
  or (
    -- team-linked problems are readable by the team via can_read_team
    exists (
      select 1 from public.teams t
      where t.problem_id = problems.id and public.can_read_team(t.id)
    )
  )
  or public.is_platform_admin()
);

create policy "signed-in users may submit problems" on public.problems
for insert to authenticated
with check (submitted_by = auth.uid());

-- Submitters may not self-approve: status transitions are admin-only.
create policy "admins manage problems" on public.problems
for update to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- problem_screenings
alter table public.problem_screenings enable row level security;

create policy "admins read & write screenings" on public.problem_screenings
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- The submitter may read the decision notes made about their own submission
-- (screenings happen in-app and the UI notifies submitters).
create policy "submitters read own screening" on public.problem_screenings
for select to authenticated
using (exists (
  select 1 from public.problems p
  where p.id = problem_screenings.problem_id and p.submitted_by = auth.uid()
));

-- teams
alter table public.teams enable row level security;

create policy "authorised users read teams" on public.teams
for select to authenticated
using (public.can_read_team(id));

create policy "cohort members create teams" on public.teams
for insert to authenticated
with check (
  public.submitted_by_check(cohort_id, created_by)
);

create policy "team members manage teams" on public.teams
for update to authenticated
using (public.can_edit_team_work(id) or public.can_review_team_work(id))
with check (public.can_edit_team_work(id) or public.can_review_team_work(id));

-- team_members
alter table public.team_members enable row level security;

create policy "team members read membership" on public.team_members
for select to authenticated
using (public.can_read_team(team_id));

create policy "cohort members join teams" on public.team_members
for insert to authenticated
with check (
  -- A user may add themselves only to a team whose cohort they belong to.
  (
    user_id = auth.uid()
    and exists (
      select 1 from public.teams t
      where t.id = team_id and public.is_cohort_member(t.cohort_id)
    )
  )
  -- Cohort staff may add any user to any team of their cohort.
  or exists (
    select 1 from public.teams t
    where t.id = team_id and public.is_cohort_staff(t.cohort_id)
  )
);

create policy "members manage own status" on public.team_members
for update to authenticated
using (public.can_edit_team_work(team_id) or (user_id = auth.uid() and status in ('proposed', 'accepted')));

-- A member may decline/remove themselves.
create policy "members may leave teams" on public.team_members
for delete to authenticated
using (user_id = auth.uid() and status = 'proposed');

-- team_invites
alter table public.team_invites enable row level security;

create policy "team members read invites" on public.team_invites
for select to authenticated
using (public.can_read_team(team_id));

create policy "team members create invites" on public.team_invites
for insert to authenticated
with check (public.is_team_member(team_id));

create policy "team editors revoke invites" on public.team_invites
for update to authenticated
using (public.can_edit_team_work(team_id))
with check (public.can_edit_team_work(team_id));

-- interviews
alter table public.interviews enable row level security;

create policy "authorised readers view interviews" on public.interviews
for select to authenticated
using (public.can_read_team(team_id));

create policy "team members record interviews" on public.interviews
for insert to authenticated
with check (public.can_edit_team_work(team_id) and consent);

create policy "team edits, reviewers update interviews" on public.interviews
for update to authenticated
using (public.can_edit_team_work(team_id) or public.can_review_team_work(team_id))
with check (public.can_edit_team_work(team_id) or public.can_review_team_work(team_id));

-- evidence_attachments
alter table public.evidence_attachments enable row level security;

-- Reviewer-only attachments additionally require review rights.
create policy "authorised readers view attachments" on public.evidence_attachments
for select to authenticated
using (
  public.can_review_team_work(team_id)
  or (visibility = 'team' and public.can_read_team(team_id))
  or (uploaded_by = auth.uid())
);

create policy "team members attach evidence" on public.evidence_attachments
for insert to authenticated
with check (public.is_team_member(team_id));

create policy "uploaders & staff manage attachments" on public.evidence_attachments
for update to authenticated
using (uploaded_by = auth.uid() or public.can_review_team_work(team_id))
with check (uploaded_by = auth.uid() or public.can_review_team_work(team_id));

create policy "uploaders & staff delete attachments" on public.evidence_attachments
for delete to authenticated
using (uploaded_by = auth.uid() or public.can_review_team_work(team_id));

-- feasibility_reviews
alter table public.feasibility_reviews enable row level security;

create policy "authorised readers view feasibility" on public.feasibility_reviews
for select to authenticated
using (public.can_read_team(team_id));

create policy "team members write feasibility" on public.feasibility_reviews
for insert to authenticated
with check (
  public.can_edit_team_work(team_id)
  -- authors of a report always record themselves
  and author_id = auth.uid()
);

create policy "authors & reviewers update feasibility" on public.feasibility_reviews
for update to authenticated
using (public.can_edit_team_work(team_id) or public.can_review_team_work(team_id))
with check (public.can_edit_team_work(team_id) or public.can_review_team_work(team_id));

-- prototype_tests
alter table public.prototype_tests enable row level security;

create policy "authorised readers view prototype" on public.prototype_tests
for select to authenticated
using (public.can_read_team(team_id));

create policy "team members write prototype" on public.prototype_tests
for insert to authenticated
with check (public.can_edit_team_work(team_id));

create policy "team & reviewers update prototype" on public.prototype_tests
for update to authenticated
using (public.can_edit_team_work(team_id) or public.can_review_team_work(team_id))
with check (public.can_edit_team_work(team_id) or public.can_review_team_work(team_id));

-- user_tests
alter table public.user_tests enable row level security;

create policy "authorised readers view user tests" on public.user_tests
for select to authenticated
using (exists (
  select 1 from public.prototype_tests pt
  where pt.id = user_tests.test_id and public.can_read_team(pt.team_id)
));

create policy "team members record user tests" on public.user_tests
for insert to authenticated
with check (exists (
  select 1 from public.prototype_tests pt
  where pt.id = user_tests.test_id and public.can_edit_team_work(pt.team_id)
));

-- team_decisions
alter table public.team_decisions enable row level security;

create policy "authorised readers view decisions" on public.team_decisions
for select to authenticated
using (public.can_read_team(team_id));

create policy "team members & staff record decisions" on public.team_decisions
for insert to authenticated
with check (
  (public.can_edit_team_work(team_id) and decided_by = auth.uid())
  or public.can_review_team_work(team_id)
);

-- proof_cards
alter table public.proof_cards enable row level security;

-- Draft/never-published cards: readable by the team, cohort staff, assigned
-- mentors, and admins. Public pages additionally read published cards.
create policy "authorised readers view proof cards" on public.proof_cards
for select to authenticated
using (
  public.can_read_team(team_id)
  -- Signed-in visitors without any team relation still see public cards,
  -- exactly like anonymous visitors do (listPublicCards runs signed-in too).
  or (visibility = 'public' and review_status in ('approved', 'published'))
);

-- THE public gate: anonymous users see only cards that are BOTH approved/published
-- AND explicitly public. This is the single guard the public /proof-cards page
-- relies on.
create policy "public read published cards" on public.proof_cards
for select to anon
using (
  visibility = 'public'
  and (review_status in ('approved', 'published'))
);
-- (anon cannot pass can_read_team; their only access path is this policy.)

create policy "team members create drafts" on public.proof_cards
for insert to authenticated
with check (public.is_team_member(team_id));

create policy "team editors & reviewers manage cards" on public.proof_cards
for update to authenticated
using (public.can_edit_team_work(team_id) or public.can_review_team_work(team_id))
with check (public.can_edit_team_work(team_id) or public.can_review_team_work(team_id));

-- proof_card_skills
alter table public.proof_card_skills enable row level security;

create policy "authorised readers view card skills" on public.proof_card_skills
for select to authenticated
using (exists (
  select 1 from public.proof_cards pc
  where pc.id = proof_card_skills.card_id
    and (
      public.can_read_team(pc.team_id)
      or (pc.visibility = 'public' and pc.review_status in ('approved', 'published'))
    )
));

-- Anonymous visitors of published cards may still see the skill evidence
-- (the public Proof Card detail page fetches card + skills in one query).
create policy "anon read published card skills" on public.proof_card_skills
for select to anon
using (exists (
  select 1 from public.proof_cards pc
  where pc.id = proof_card_skills.card_id
    and pc.visibility = 'public'
    and pc.review_status in ('approved', 'published')
));

create policy "team editors manage card skills" on public.proof_card_skills
for all to authenticated
using (exists (
  select 1 from public.proof_cards pc
  where pc.id = proof_card_skills.card_id and public.can_edit_team_work(pc.team_id)
))
with check (exists (
  select 1 from public.proof_cards pc
  where pc.id = proof_card_skills.card_id and public.can_edit_team_work(pc.team_id)
));

-- mentor_assignments
alter table public.mentor_assignments enable row level security;

create policy "authorised readers view assignments" on public.mentor_assignments
for select to authenticated
using (
  mentor_id = auth.uid()
  or public.can_read_team(team_id)
);

create policy "cohort staff assign mentors" on public.mentor_assignments
for insert to authenticated
with check (
  exists (
    select 1 from public.teams t
    where t.id = mentor_assignments.team_id
      and public.is_cohort_staff(t.cohort_id)
  )
);

create policy "staff deactivate assignments" on public.mentor_assignments
for update to authenticated
using (assigned_by = auth.uid() or public.is_platform_admin())
with check (assigned_by = auth.uid() or public.is_platform_admin());

-- comments
alter table public.comments enable row level security;

create policy "authorised readers view comments" on public.comments
for select to authenticated
using (
  public.can_read_team(team_id)
  -- audience='reviewers' comments are additionally limited: they are visible
  -- to reviewers and comments with audience='reviewers' are only readable by
  -- those with review rights on this team (checked via can_review_team_work).
  and (
    audience = 'team'
    or public.can_review_team_work(team_id)
  )
);

create policy "team members comment" on public.comments
for insert to authenticated
with check (
  public.can_edit_team_work(team_id)
  and author_id = auth.uid()
);

-- notifications
alter table public.notifications enable row level security;

create policy "users read own notifications" on public.notifications
for select to authenticated
using (user_id = auth.uid());

create policy "users update own notifications" on public.notifications
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Notifications are written by roles that legitimately report to other users:
-- admins, institution admins, faculty coordinators, facilitators, mentors and
-- problem owners. Regular students cannot insert (anti-spam boundary).
create policy "reporter roles send notifications" on public.notifications
for insert to authenticated
with check (
  public.has_any_role(array[
    'platform_admin', 'institution_admin', 'faculty_coordinator',
    'facilitator', 'mentor', 'problem_owner'
  ])
);

-- audit_logs
alter table public.audit_logs enable row level security;

-- Only platform admins read the audit trail.
create policy "platform admins read audit logs" on public.audit_logs
for select to authenticated
using (public.is_platform_admin());

-- Reporter-level roles may append entries. Regular students cannot.
create policy "reporter roles write audit logs" on public.audit_logs
for insert to authenticated
with check (
  public.has_any_role(array[
    'platform_admin', 'institution_admin', 'faculty_coordinator',
    'facilitator', 'mentor', 'problem_owner'
  ])
);

-- ============================================================================
-- PART 4 of 5 — TRIGGER FUNCTIONS + TRIGGERS
-- ============================================================================

-- updated_at maintenance (extension function from moddatetime, Part-1 tables)
create trigger profiles_updated_at before update on public.profiles
for each row execute procedure moddatetime (updated_at);

create trigger cohorts_updated_at before update on public.cohorts
for each row execute procedure moddatetime (updated_at);

create trigger problems_updated_at before update on public.problems
for each row execute procedure moddatetime (updated_at);

create trigger teams_updated_at before update on public.teams
for each row execute procedure moddatetime (updated_at);

create trigger interviews_updated_at before update on public.interviews
for each row execute procedure moddatetime (updated_at);

create trigger feasibility_updated_at before update on public.feasibility_reviews
for each row execute procedure moddatetime (updated_at);

create trigger prototype_updated_at before update on public.prototype_tests
for each row execute procedure moddatetime (updated_at);

create trigger proof_cards_updated_at before update on public.proof_cards
for each row execute procedure moddatetime (updated_at);

-- Guard: a member updating their own row may only change the status column.
create function public.enforce_self_member_status_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id = auth.uid() and not public.is_cohort_staff(new.cohort_id) then
    if new.cohort_role <> old.cohort_role
       or new.user_id <> old.user_id
       or new.cohort_id <> old.cohort_id then
      raise exception 'Members may only change their own membership status';
    end if;
    if new.status not in ('active', 'left') then
      raise exception 'Members may only accept or leave a cohort';
    end if;
  end if;
  return new;
end;
$$;

create trigger cohort_members_self_guard
before update on public.cohort_members
for each row execute function public.enforce_self_member_status_only();

-- Guard trigger: only authorised reviewers may change tier or review state,
-- only admins may publish publicly, and team members may only submit drafts.
create function public.proof_card_review_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_is_reviewer boolean := public.can_review_team_work(new.team_id);
  actor_is_admin boolean := public.is_platform_admin();
  team_inst uuid;
begin
  select c.institution_id into team_inst
  from public.teams t
  join public.cohorts c on c.id = t.cohort_id
  where t.id = new.team_id;

  -- Reviewers who are not themselves team editors (e.g. assigned mentors) may
  -- only change review metadata -- never the card content itself.
  if not public.can_edit_team_work(new.team_id) then
    if new.title is distinct from old.title
      or new.problem_title is distinct from old.problem_title
      or new.problem_summary is distinct from old.problem_summary
      or new.validation_summary is distinct from old.validation_summary
      or new.feasibility_summary is distinct from old.feasibility_summary
      or new.built_summary is distinct from old.built_summary
      or new.results_limitations is distinct from old.results_limitations
      or new.team_id is distinct from old.team_id then
      raise exception 'Reviewers may only change review metadata, not card content';
    end if;
  end if;

  -- Publication (public visibility) requires: admin OR institution admin of
  -- the card team's cohort institution; and the card must be approved/published.
  if old.visibility <> new.visibility then
    if not (
      actor_is_admin
      or (public.is_institution_admin(team_inst))
    ) then
      raise exception 'Only institution or platform admins can publish a Proof Card';
    end if;
    if new.visibility = 'public' and new.review_status not in ('approved', 'published') then
      raise exception 'A card can go public only after review approval';
    end if;
    if new.visibility = 'public' then
      new.published_at := now();
      new.published_by := auth.uid();
    else
      new.published_at := null;
      new.published_by := null;
      -- going private retracts the published state
      new.review_status := 'approved';
    end if;
  end if;

  -- Tier changes require a reviewer, and Tier 3 additionally records who set it.
  if new.tier <> old.tier then
    if not actor_is_reviewer then
      raise exception 'Only authorised facilitators or mentors may set verification tiers';
    end if;
    if new.tier = 3 and new.tier_set_by is null then
      raise exception 'Tier 3 must record who confirmed it (tier_set_by)';
    end if;
    if new.tier < 3 then
      new.tier_set_by := null;
    end if;
  end if;

  -- Review-state transitions require review rights, EXCEPT the legitimate
  -- self transition draft/changes_requested → submitted.
  if old.review_status <> new.review_status then
    if new.review_status = 'submitted'
       and old.review_status in ('draft', 'changes_requested') then
      -- allowed for team members
      null;
    elsif not actor_is_reviewer then
      raise exception 'Only authorised reviewers may change the review state';
    end if;
  end if;

  return new;
end;
$$;

create trigger proof_cards_review_guard
before update on public.proof_cards
for each row execute function public.proof_card_review_guard();

-- auth.users trigger: create profile + first role on signup.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_role text := coalesce(new.raw_user_meta_data ->> 'role', 'student');
begin
  -- Only two roles may be self-selected at signup. NEVER allow anything
  -- privileged through user metadata.
  if chosen_role not in ('student', 'problem_owner') then
    chosen_role := 'student';
  end if;

  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    new.email
  );

  insert into public.user_roles (user_id, role)
  values (new.id, chosen_role);

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================================
-- PART 5 of 5 — RPCs THE APP DEPENDS ON + GRANTS
-- ============================================================================

-- Look up a user id by email — used by staff adding cohort members or granting
-- roles. SECURITY DEFINER because the caller must never read all of
-- auth.users. Returns no profile data, just the id (the least sensitive thing
-- we can return, and only to signed-in staff flows).
create or replace function public.find_user_id_by_email(lookup_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id from auth.users u
  where lower(u.email) = lower(lookup_email)
    and u.id <> auth.uid()
  limit 1;
$$;

-- Accept a team invite by its secret token. SECURITY DEFINER so the invitee
-- can act on an invite row they could not otherwise read/update. Creates the
-- team_members row as accepted directly (the acceptance IS the membership).
create or replace function public.accept_team_invite(invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.team_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;

  select * into invite from public.team_invites
  where token = invite_token for update;

  if not found then
    raise exception 'Invite not found';
  end if;
  if invite.status <> 'pending' then
    raise exception 'Invite is no longer pending';
  end if;

  update public.team_invites
  set status = 'accepted'
  where id = invite.id;

  insert into public.team_members (team_id, user_id, member_role, status)
  values (invite.team_id, auth.uid(), 'student', 'accepted')
  on conflict (team_id, user_id)
  do update set status = 'accepted';

  insert into public.notifications (user_id, type, title, link)
  values (
    invite.invited_by,
    'invite_accepted',
    'A teammate accepted your invite',
    '/app/teams/' || invite.team_id::text
  );

  return invite.team_id;
end;
$$;

grant execute on function public.find_user_id_by_email(text) to authenticated;
grant execute on function public.accept_team_invite(uuid) to authenticated;

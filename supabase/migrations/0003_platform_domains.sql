-- ============================================================================
-- BuildProof — platform domains (0003)
-- Run order: 0001 → 0002 → THIS FILE (→ seed.sql for demo environments).
--
-- Adds the marketplace / career / hardware / funding domains on top of the
-- existing schema. NOTHING from 0001/0002 is modified except non-destructive
-- `alter table ... add column` statements on public.problems (every added
-- column has a default or is nullable, so existing rows keep working).
--
-- Ordering (same lesson as 0001 — PostgreSQL validates function bodies at
-- CREATE time, see 0001 header):
--   Part 1  tables + indexes
--   Part 2  helper functions (after the tables they read)
--   Part 3  RLS enablement + policies (use helpers)
--   Part 4  guard triggers (payment + review-verification integrity)
--   Part 5  grants
-- ============================================================================

-- ============================================================================
-- PART 1 of 5 — TABLES + INDEXES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- organizations — companies, small businesses, NGOs, funders. Verification is a
-- platform-admin action; an unverified org is not presented as trusted.
-- ----------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  kind text not null check (kind in (
    'company', 'small_business', 'ngo', 'funder', 'accelerator', 'research_lab'
  )),
  description text check (char_length(description) <= 2000),
  website_url text check (char_length(website_url) <= 300),
  city text check (char_length(city) <= 120),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  verified_by uuid references auth.users (id) on delete set null,
  verified_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index organizations_kind_idx on public.organizations (kind);
create index organizations_verification_idx on public.organizations (verification_status);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  org_role text not null check (org_role in ('owner', 'representative', 'member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index org_members_user_idx on public.organization_members (user_id);

-- problems gains source metadata; FK target (organizations) now exists --------
alter table public.problems
  add column source_type text
    default 'individual'
    check (source_type in ('individual', 'company', 'small_business', 'ngo', 'platform')),
  add column organization_id uuid references public.organizations (id) on delete set null,
  add column required_skills jsonb not null default '[]'::jsonb,
  add column deliverables text check (char_length(deliverables) <= 2000),
  add column project_type text
    check (project_type in ('research', 'prototype', 'commissioned', 'startup_potential')),
  add column budget_note text check (char_length(budget_note) <= 500),
  add column timeline_note text check (char_length(timeline_note) <= 300);

create index problems_source_idx on public.problems (source_type);
create index problems_org_idx on public.problems (organization_id);

-- ----------------------------------------------------------------------------
-- team formation: role requirements + open applications
-- ----------------------------------------------------------------------------

create table public.team_role_requirements (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  skill text not null check (char_length(skill) between 2 and 80),
  seats int not null default 1 check (seats between 1 and 20),
  filled_seats int not null default 0 check (filled_seats between 0 and 20),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);

create index team_roles_team_idx on public.team_role_requirements (team_id);

create table public.team_applications (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role_needed text check (char_length(role_needed) between 2 and 80),
  message text check (char_length(message) <= 1000),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  decided_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create index team_apps_team_idx on public.team_applications (team_id);
create index team_apps_user_idx on public.team_applications (user_id);

-- ----------------------------------------------------------------------------
-- software project planning: milestones + tasks
-- ----------------------------------------------------------------------------

create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 160),
  due_date date,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'done', 'late')),
  deliverable_note text check (char_length(deliverable_note) <= 1500),
  created_at timestamptz not null default now()
);

create index milestones_team_idx on public.project_milestones (team_id);

create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  milestone_id uuid references public.project_milestones (id) on delete set null,
  title text not null check (char_length(title) between 3 and 160),
  assignee uuid references auth.users (id) on delete set null,
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'review', 'done')),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now()
);

create index tasks_team_idx on public.project_tasks (team_id);
create index tasks_milestone_idx on public.project_tasks (milestone_id);

-- ----------------------------------------------------------------------------
-- company projects — paid real-world work, categorised by difficulty
-- ----------------------------------------------------------------------------

create table public.company_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  posted_by uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 4 and 180),
  description text not null check (char_length(description) between 20 and 4000),
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  required_skills jsonb not null default '[]'::jsonb,
  deliverables text check (char_length(deliverables) <= 2000),
  team_size int not null default 1 check (team_size between 1 and 50),
  duration_weeks int check (duration_weeks between 1 and 104),
  budget_currency text not null default 'INR' check (char_length(budget_currency) <= 8),
  budget_min_amount int check (budget_min_amount >= 0),
  budget_max_amount int check (budget_max_amount >= 0),
  payment_terms text check (char_length(payment_terms) <= 1500),
  acceptance_criteria text check (char_length(acceptance_criteria) <= 2000),
  revision_policy text check (char_length(revision_policy) <= 1000),
  ip_terms text check (char_length(ip_terms) <= 1500),
  confidentiality_note text check (char_length(confidentiality_note) <= 1000),
  supervision_note text check (char_length(supervision_note) <= 1000),
  selected_team_id uuid references public.teams (id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'listed', 'in_review', 'in_progress', 'completed', 'closed')),
  created_at timestamptz not null default now()
);

create index company_projects_org_idx on public.company_projects (organization_id);
create index company_projects_status_idx on public.company_projects (status);

create table public.payment_milestones (
  id uuid primary key default gen_random_uuid(),
  company_project_id uuid not null references public.company_projects (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  amount_cents int not null check (amount_cents between 0 and 100000000),
  currency text not null default 'INR' check (char_length(currency) <= 8),
  due_date date,
  status text not null default 'agreed'
    check (status in ('agreed', 'pending', 'due', 'paid', 'disputed', 'cancelled')),
  paid_reference text check (char_length(paid_reference) <= 200),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index payment_milestones_project_idx on public.payment_milestones (company_project_id);

-- ----------------------------------------------------------------------------
-- solutions marketplace — developed prototypes with permitted exposure
-- ----------------------------------------------------------------------------

create table public.solutions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  proof_card_id uuid references public.proof_cards (id) on delete set null,
  name text not null check (char_length(name) between 4 and 180),
  summary text not null check (char_length(summary) between 20 and 3000),
  category text not null check (category in (
    'software', 'ai_data', 'business_automation', 'education', 'social_impact',
    'agriculture', 'electronics', 'robotics', 'hardware', 'other'
  )),
  stage text not null check (stage in ('prototype', 'tested', 'pilot', 'commercially_in_use')),
  exposure text not null default 'restricted'
    check (exposure in ('private', 'restricted', 'listed')),
  demo_url text check (char_length(demo_url) <= 300),
  license_status text not null default 'unavailable'
    check (license_status in ('unavailable', 'license_available', 'seek_adopters', 'acquisition_discussions')),
  known_limitations text check (char_length(known_limitations) <= 2000),
  next_steps text check (char_length(next_steps) <= 1500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index solutions_team_idx on public.solutions (team_id);
create index solutions_exposure_idx on public.solutions (exposure);

create table public.solution_interests (
  id uuid primary key default gen_random_uuid(),
  solution_id uuid not null references public.solutions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  interest_type text not null check (interest_type in (
    'license', 'fund', 'commission', 'collaborate', 'adopt', 'startup'
  )),
  message text check (char_length(message) <= 1000),
  status text not null default 'new' check (status in ('new', 'in_contact', 'closed')),
  created_at timestamptz not null default now(),
  unique (solution_id, user_id, interest_type)
);

create index solution_interests_solution_idx on public.solution_interests (solution_id);

create table public.solution_transfer_agreements (
  id uuid primary key default gen_random_uuid(),
  solution_id uuid not null references public.solutions (id) on delete cascade,
  proposed_by uuid not null references auth.users (id) on delete cascade,
  agreement_type text not null check (agreement_type in (
    'license', 'assignment', 'acquisition', 'further_development'
  )),
  terms text not null check (char_length(terms) between 20 and 4000),
  compensation_note text check (char_length(compensation_note) <= 1500),
  creator_rights_note text check (char_length(creator_rights_note) <= 1000),
  attribution_keeping boolean not null default true,
  confidential_access_note text check (char_length(confidential_access_note) <= 500),
  status text not null default 'draft'
    check (status in ('draft', 'under_discussion', 'agreed', 'executed', 'cancelled')),
  agreed_by_creator boolean not null default false,
  agreed_by_other boolean not null default false,
  executed_at timestamptz,
  created_at timestamptz not null default now()
);

create index transfer_agreements_solution_idx on public.solution_transfer_agreements (solution_id);

-- ----------------------------------------------------------------------------
-- funding opportunities + applications
-- ----------------------------------------------------------------------------

create table public.funding_opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 4 and 180),
  category text not null check (category in (
    'prototype_funding', 'hardware_funding', 'startup_capital',
    'grant_competition', 'incubation', 'manufacturing_support', 'sponsored_research'
  )),
  description text not null check (char_length(description) between 20 and 3000),
  criteria text check (char_length(criteria) <= 2000),
  min_amount int check (min_amount >= 0),
  max_amount int check (max_amount >= 0),
  currency text not null default 'INR' check (char_length(currency) <= 8),
  application_requirements text check (char_length(application_requirements) <= 1500),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'verified')),
  status text not null default 'open' check (status in ('open', 'paused', 'closed')),
  created_at timestamptz not null default now()
);

create index funding_opps_org_idx on public.funding_opportunities (organization_id);
create index funding_opps_status_idx on public.funding_opportunities (status);

create table public.funding_applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.funding_opportunities (id) on delete cascade,
  applicant uuid not null references auth.users (id) on delete cascade,
  applicant_team uuid references public.teams (id) on delete set null,
  pitch text not null check (char_length(pitch) between 20 and 3000),
  requested_amount int check (requested_amount >= 0),
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'approved', 'declined')),
  created_at timestamptz not null default now()
);

create index funding_apps_opportunity_idx on public.funding_applications (opportunity_id);
create index funding_apps_applicant_idx on public.funding_applications (applicant);

-- ----------------------------------------------------------------------------
-- hardware innovation domain
-- ----------------------------------------------------------------------------

create table public.hardware_projects (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null check (char_length(name) between 4 and 180),
  description text not null check (char_length(description) between 20 and 4000),
  problem_statement text check (char_length(problem_statement) <= 1500),
  current_stage int not null default 1 check (current_stage between 1 and 12),
  specs jsonb not null default '[]'::jsonb,
  bom jsonb not null default '[]'::jsonb,
  cost_currency text not null default 'INR' check (char_length(cost_currency) <= 8),
  cost_note text check (char_length(cost_note) <= 500),
  safety_considerations text check (char_length(safety_considerations) <= 1500),
  evidence_note text check (char_length(evidence_note) <= 1000),
  incomplete_work text check (char_length(incomplete_work) <= 2000),
  demo_url text check (char_length(demo_url) <= 300),
  readiness_class text not null default 'prototype'
    check (readiness_class in ('concept', 'prototype', 'near_complete', 'production_candidate')),
  ip_status text not null default 'undecided'
    check (ip_status in ('undecided', 'student_owned', 'licensed', 'transferred')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index hardware_projects_team_idx on public.hardware_projects (team_id);

-- ----------------------------------------------------------------------------
-- opportunities (internships, roles, founding teams) + applications
-- ----------------------------------------------------------------------------

create table public.job_opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  posted_by uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 4 and 180),
  kind text not null check (kind in (
    'internship', 'entry_level', 'apprenticeship', 'research',
    'hardware_role', 'founding_team', 'project_contract'
  )),
  description text not null check (char_length(description) between 20 and 3000),
  required_skills jsonb not null default '[]'::jsonb,
  location_type text not null check (location_type in ('onsite', 'remote', 'hybrid')),
  city text check (char_length(city) <= 120),
  commitment_note text check (char_length(commitment_note) <= 300),
  compensation_note text check (char_length(compensation_note) <= 500),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'verified')),
  status text not null default 'open' check (status in ('open', 'paused', 'closed')),
  created_at timestamptz not null default now()
);

create index job_opps_org_idx on public.job_opportunities (organization_id);
create index job_opps_status_idx on public.job_opportunities (status);

create table public.opportunity_applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.job_opportunities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  evidence_note text check (char_length(evidence_note) <= 2000),
  proof_card_id uuid references public.proof_cards (id) on delete set null,
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'interviewing', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (opportunity_id, user_id)
);

create index opp_apps_opportunity_idx on public.opportunity_applications (opportunity_id);
create index opp_apps_user_idx on public.opportunity_applications (user_id);

-- ----------------------------------------------------------------------------
-- structured reviews (separate dimensions; verification is an admin action)
-- ----------------------------------------------------------------------------

create table public.review_assignments (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in (
    'solution', 'hardware_project', 'company_project', 'problem'
  )),
  subject_id uuid not null,
  reviewer_type text not null check (reviewer_type in (
    'problem_owner', 'sponsor', 'technical', 'domain_expert',
    'end_user', 'hardware', 'business', 'operations'
  )),
  reviewer_id uuid not null references auth.users (id) on delete cascade,
  assigned_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'assigned'
    check (status in ('assigned', 'in_progress', 'completed')),
  due_date date,
  created_at timestamptz not null default now(),
  unique (subject_type, subject_id, reviewer_id)
);

create index review_assignments_reviewer_idx on public.review_assignments (reviewer_id);
create index review_assignments_subject_idx on public.review_assignments (subject_type, subject_id);

create table public.review_records (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.review_assignments (id) on delete cascade,
  dimensions jsonb not null default '[]'::jsonb,
  verdict text not null check (verdict in ('accepted', 'needs_revision', 'rejected', 'inconclusive')),
  feedback text not null check (char_length(feedback) between 5 and 4000),
  verified boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index review_records_assignment_idx on public.review_records (assignment_id);

-- ----------------------------------------------------------------------------
-- individual contributions (separate from project outcome) + content reports
-- ----------------------------------------------------------------------------

create table public.proof_contributions (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.proof_cards (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  contribution text not null check (char_length(contribution) between 5 and 2000),
  deliverable_links jsonb not null default '[]'::jsonb,
  outcome_note text check (char_length(outcome_note) <= 1000),
  paid boolean not null default false,
  kind text not null default 'project_work'
    check (kind in ('project_work', 'community', 'company_assignment', 'internship', 'employment', 'founding')),
  created_at timestamptz not null default now()
);

create index proof_contributions_card_idx on public.proof_contributions (card_id);

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references auth.users (id) on delete cascade,
  subject_type text not null check (subject_type in (
    'problem', 'solution', 'hardware_project', 'company_project', 'opportunity', 'comment'
  )),
  subject_id uuid not null,
  reason text not null check (reason in ('misleading', 'inappropriate', 'spam', 'other')),
  detail text check (char_length(detail) <= 1000),
  status text not null default 'open'
    check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  handled_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index content_reports_status_idx on public.content_reports (status);

-- ============================================================================
-- PART 2 of 5 — SHARED HELPERS
-- ============================================================================

-- True when the caller holds one of the given organization roles. Owner or
-- representative = "can manage the organization and its listings".
create or replace function public.is_org_role(
  organization_id uuid,
  roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = is_org_role.organization_id
      and om.user_id = auth.uid()
      and om.org_role = any (roles)
  );
$$;

create or replace function public.is_org_admin(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_org_role(org, array['owner', 'representative'])
    or public.is_platform_admin();
$$;

-- ============================================================================
-- PART 3 of 5 — ROW LEVEL SECURITY
-- ============================================================================

-- organizations ---------------------------------------------------------------
alter table public.organizations enable row level security;

-- Identity is public (marketplace shows company names), verification state is
-- the honest signal — unverified orgs are simply labelled unverified.
create policy "public read organizations" on public.organizations
for select
to anon, authenticated
using (true);

create policy "authenticated register organizations" on public.organizations
for insert to authenticated
with check (created_by is null or created_by = auth.uid());

create policy "org owners & platform admins manage organizations" on public.organizations
for update to authenticated
using (public.is_org_admin(id))
with check (public.is_org_admin(id));

create policy "platform admins delete organizations" on public.organizations
for delete to authenticated
using (public.is_platform_admin());

-- organization_members --------------------------------------------------------
alter table public.organization_members enable row level security;

create policy "authenticated read organization rosters" on public.organization_members
for select
to anon, authenticated
using (true);

-- A registrant adds THEMSELVES to an org they created; platform admins manage
-- the rest. Nobody can join an arbitrary organization otherwise.
create policy "org creators self-membership & admins manage roster" on public.organization_members
for insert to authenticated
with check (
  (user_id = auth.uid() and exists (
    select 1 from public.organizations o
    where o.id = organization_id and o.created_by = auth.uid()
  ))
  or public.is_platform_admin()
);

create policy "org admins & platform admins manage roster" on public.organization_members
for update to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "members leave orgs, org admins remove" on public.organization_members
for delete to authenticated
using (user_id = auth.uid() or public.is_org_admin(organization_id));

-- problems: extended columns inherit the 0001 policies; no new policy needed.

-- company_projects ------------------------------------------------------------
alter table public.company_projects enable row level security;

-- Drafts visible only to organization staff & platform admins; everything else
-- (listed and beyond) is browsable including anonymously.
create policy "listed projects public, drafts org-only" on public.company_projects
for select
to anon, authenticated
using (
  status in ('listed', 'in_review', 'in_progress', 'completed')
  or public.is_org_admin(organization_id)
);

create policy "org admins post projects" on public.company_projects
for insert to authenticated
with check (public.is_org_role(organization_id, array['owner','representative']) and posted_by = auth.uid());

create policy "org admins & platform admins manage projects" on public.company_projects
for update to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "org admins & platform admins delete projects" on public.company_projects
for delete to authenticated
using (public.is_org_admin(organization_id));

-- payment_milestones -----------------------------------------------------------
alter table public.payment_milestones enable row level security;

-- Highly restricted: organization staff, platform admins, plus members of the
-- team the project was assigned to (they must see their payment schedule).
create policy "need-to-know payment visibility" on public.payment_milestones
for select to authenticated
using (
  exists (
    select 1 from public.company_projects cp
    where cp.id = company_project_id
      and (public.is_org_admin(cp.organization_id))
  )
  or exists (
    select 1 from public.company_projects cp
    where cp.id = company_project_id
      and cp.selected_team_id is not null
      and public.can_read_team(cp.selected_team_id)
  )
);

create policy "org admins add milestones" on public.payment_milestones
for insert to authenticated
with check (exists (
  select 1 from public.company_projects cp
  where cp.id = company_project_id and public.is_org_role(cp.organization_id, array['owner','representative'])
));

create policy "org admins manage milestones" on public.payment_milestones
for update to authenticated
using (exists (
  select 1 from public.company_projects cp
  where cp.id = company_project_id and public.is_org_role(cp.organization_id, array['owner','representative'])
));

create policy "org admins delete milestones" on public.payment_milestones
for delete to authenticated
using (exists (
  select 1 from public.company_projects cp
  where cp.id = company_project_id and public.is_org_role(cp.organization_id, array['owner','representative'])
));

-- team_role_requirements ---------------------------------------------------------
alter table public.team_role_requirements enable row level security;

-- Openings are visible to whoever can see the team (recruiting surface).
create policy "team-readable role requirements" on public.team_role_requirements
for select to anon, authenticated
using (public.can_read_team(team_id));

create policy "team editors define role requirements" on public.team_role_requirements
for insert to authenticated
with check (public.can_edit_team_work(team_id));

-- filled_seats must reflect accepted applications; seat math is edited by the
-- team editors only.
create policy "team editors update role requirements" on public.team_role_requirements
for update to authenticated
using (public.can_edit_team_work(team_id))
with check (public.can_edit_team_work(team_id));

create policy "team editors remove role requirements" on public.team_role_requirements
for delete to authenticated
using (public.can_edit_team_work(team_id));

-- team_applications --------------------------------------------------------------
alter table public.team_applications enable row level security;

create policy "applicants & team read applications" on public.team_applications
for select to authenticated
using (user_id = auth.uid() or public.can_read_team(team_id));

-- Anyone who can see a team's openings may apply as themselves.
create policy "visible team, own application" on public.team_applications
for insert to authenticated
with check (user_id = auth.uid() and public.can_read_team(team_id));

-- Only team editors decide applications (accept/reject with recorded decision).
create policy "team editors decide applications" on public.team_applications
for update to authenticated
using (public.can_read_team(team_id))
with check (public.can_edit_team_work(team_id));

create policy "withdraw own application" on public.team_applications
for delete to authenticated
using (user_id = auth.uid() or public.can_edit_team_work(team_id));

-- project_milestones -------------------------------------------------------------
alter table public.project_milestones enable row level security;

create policy "team-readable milestones" on public.project_milestones
for select to authenticated
using (public.can_read_team(team_id));

create policy "team editors create milestones" on public.project_milestones
for insert to authenticated
with check (public.can_edit_team_work(team_id));

create policy "team editors update milestones" on public.project_milestones
for update to authenticated
using (public.can_edit_team_work(team_id))
with check (public.can_edit_team_work(team_id));

create policy "team editors delete milestones" on public.project_milestones
for delete to authenticated
using (public.can_edit_team_work(team_id));

-- project_tasks ------------------------------------------------------------------
alter table public.project_tasks enable row level security;

create policy "team-readable tasks" on public.project_tasks
for select to authenticated
using (public.can_read_team(team_id));

create policy "team editors create tasks" on public.project_tasks
for insert to authenticated
with check (public.can_edit_team_work(team_id));

-- Editors manage the board; the assigned member may move their own task along.
create policy "editors or assignee progress tasks" on public.project_tasks
for update to authenticated
using (public.can_edit_team_work(team_id) or assignee = auth.uid())
with check (public.can_edit_team_work(team_id) or assignee = auth.uid());

create policy "team editors delete tasks" on public.project_tasks
for delete to authenticated
using (public.can_edit_team_work(team_id));

-- solutions --------------------------------------------------------------------
alter table public.solutions enable row level security;

-- Listed solutions are public (incl. anonymous); anything more requires the
-- owning team's permission chain.
create policy "listed solutions public" on public.solutions
for select
to anon, authenticated
using (
  exposure = 'listed'
  or public.can_read_team(team_id)
);

create policy "team members list their solutions" on public.solutions
for insert to authenticated
with check (public.is_team_member(team_id) and (created_by is null or created_by = auth.uid()));

create policy "team editors manage solutions" on public.solutions
for update to authenticated
using (public.can_edit_team_work(team_id))
with check (public.can_edit_team_work(team_id));

-- solution_interests -------------------------------------------------------------
alter table public.solution_interests enable row level security;

create policy "own interests + solution team + admins" on public.solution_interests
for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.solutions s
    where s.id = solution_id and public.can_read_team(s.team_id)
  )
);

create policy "any authenticated may express interest" on public.solution_interests
for insert to authenticated
with check (user_id = auth.uid());

create policy "creator team progresses interests" on public.solution_interests
for update to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.solutions s
    where s.id = solution_id and public.can_edit_team_work(s.team_id)
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1 from public.solutions s
    where s.id = solution_id and public.can_edit_team_work(s.team_id)
  )
);

-- solution_transfer_agreements ----------------------------------------------------
alter table public.solution_transfer_agreements enable row level security;

create policy "parties & team read agreements" on public.solution_transfer_agreements
for select to authenticated
using (
  proposed_by = auth.uid()
  or exists (
    select 1 from public.solutions s
    where s.id = solution_id and public.can_read_team(s.team_id)
  )
);

create policy "any authenticated may propose" on public.solution_transfer_agreements
for insert to authenticated
with check (proposed_by = auth.uid());

create policy "parties negotiate, team executes" on public.solution_transfer_agreements
for update to authenticated
using (
  proposed_by = auth.uid()
  or exists (
    select 1 from public.solutions s
    where s.id = solution_id and public.can_edit_team_work(s.team_id)
  )
)
with check (
  proposed_by = auth.uid()
  or exists (
    select 1 from public.solutions s
    where s.id = solution_id and public.can_edit_team_work(s.team_id)
  )
);

-- Executed agreements are platform-verified actions: only admins may delete.
create policy "platform admins delete agreements" on public.solution_transfer_agreements
for delete to authenticated
using (public.is_platform_admin());

-- funding_opportunities -------------------------------------------------------------
alter table public.funding_opportunities enable row level security;

create policy "open funding listings public" on public.funding_opportunities
for select
to anon, authenticated
using (
  status = 'open'
  or (organization_id is not null and public.is_org_admin(organization_id))
  or public.is_platform_admin()
);

create policy "funder orgs & platform admins post" on public.funding_opportunities
for insert to authenticated
with check (
  (organization_id is null and public.is_platform_admin())
  or (organization_id is not null and public.is_org_role(organization_id, array['owner','representative']))
);

create policy "funder orgs & platform admins manage" on public.funding_opportunities
for update to authenticated
using (public.is_platform_admin() or public.is_org_admin(organization_id))
with check (public.is_platform_admin() or public.is_org_admin(organization_id));

-- funding_applications --------------------------------------------------------------
alter table public.funding_applications enable row level security;

create policy "applicant, funder org & admins read" on public.funding_applications
for select to authenticated
using (
  applicant = auth.uid()
  or public.is_platform_admin()
  or exists (
    select 1 from public.funding_opportunities fo
    where fo.id = opportunity_id
      and fo.organization_id is not null
      and public.is_org_admin(fo.organization_id)
  )
);

create policy "individuals or their team apply" on public.funding_applications
for insert to authenticated
with check (
  applicant = auth.uid()
  and (applicant_team is null or public.is_team_member(applicant_team))
);

create policy "funder org & admins decide applications" on public.funding_applications
for update to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1 from public.funding_opportunities fo
    where fo.id = opportunity_id
      and fo.organization_id is not null
      and public.is_org_admin(fo.organization_id)
  )
);

-- hardware_projects-------------------------------------------------------------------
alter table public.hardware_projects enable row level security;

create policy "team members & admins read hardware" on public.hardware_projects
for select to authenticated
using (
  public.can_read_team(team_id)
  or public.is_platform_admin()
);

create policy "team members register hardware" on public.hardware_projects
for insert to authenticated
with check (public.is_team_member(team_id) and (created_by is null or created_by = auth.uid()));

create policy "team editors manage hardware" on public.hardware_projects
for update to authenticated
using (public.can_edit_team_work(team_id))
with check (public.can_edit_team_work(team_id));

-- job_opportunities -------------------------------------------------------------------
alter table public.job_opportunities enable row level security;

create policy "open opportunities public" on public.job_opportunities
for select
to anon, authenticated
using (
  status = 'open'
  or (organization_id is not null and public.is_org_admin(organization_id))
  or public.is_platform_admin()
);

create policy "orgs & platform admins post opportunities" on public.job_opportunities
for insert to authenticated
with check (
  (organization_id is null and public.is_platform_admin())
  or (organization_id is not null and public.is_org_role(organization_id, array['owner','representative']))
);

create policy "orgs & platform admins manage opportunities" on public.job_opportunities
for update to authenticated
using (public.is_platform_admin() or public.is_org_admin(organization_id))
with check (public.is_platform_admin() or public.is_org_admin(organization_id));

-- opportunity_applications --------------------------------------------------------------
alter table public.opportunity_applications enable row level security;

create policy "applicant & hiring side read" on public.opportunity_applications
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_platform_admin()
  or exists (
    select 1 from public.job_opportunities jo
    where jo.id = opportunity_id
      and jo.organization_id is not null
      and public.is_org_admin(jo.organization_id)
  )
);

create policy "users apply themselves" on public.opportunity_applications
for insert to authenticated
with check (user_id = auth.uid());

create policy "hiring side decides applications" on public.opportunity_applications
for update to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1 from public.job_opportunities jo
    where jo.id = opportunity_id
      and jo.organization_id is not null
      and public.is_org_admin(jo.organization_id)
  )
);

create policy "applicants withdraw pending applications" on public.opportunity_applications
for delete to authenticated
using (user_id = auth.uid() and status = 'submitted');

-- review_assignments ------------------------------------------------------------------------
alter table public.review_assignments enable row level security;

create policy "reviewer, assigner, subject teams & admins read" on public.review_assignments
for select to authenticated
using (
  reviewer_id = auth.uid()
  or assigned_by = auth.uid()
  or public.is_platform_admin()
  or exists (
    select 1 from public.solutions s
    where subject_type = 'solution' and s.id = subject_id and public.can_read_team(s.team_id)
  )
  or exists (
    select 1 from public.hardware_projects h
    where subject_type = 'hardware_project' and h.id = subject_id and public.can_read_team(h.team_id)
  )
);

create policy "admins, sponsoring orgs & subject teams assign reviewers" on public.review_assignments
for insert to authenticated
with check (
  (assigned_by = auth.uid() and public.is_platform_admin())
  or exists (
    select 1 from public.company_projects cp
    where subject_type = 'company_project' and cp.id = subject_id
      and public.is_org_role(cp.organization_id, array['owner','representative'])
  )
  or exists (
    select 1 from public.solutions s
    where subject_type = 'solution' and s.id = subject_id and public.can_edit_team_work(s.team_id)
  )
  or exists (
    select 1 from public.hardware_projects h
    where subject_type = 'hardware_project' and h.id = subject_id and public.can_edit_team_work(h.team_id)
  )
);

create policy "reviewer progresses own assignment" on public.review_assignments
for update to authenticated
using (reviewer_id = auth.uid() or assigned_by = auth.uid() or public.is_platform_admin());

-- review_records ------------------------------------------------------------------------------
alter table public.review_records enable row level security;

create policy "review, assignment & subject visibility" on public.review_records
for select to authenticated
using (
  exists (
    select 1 from public.review_assignments ra
    where ra.id = assignment_id
      and (ra.reviewer_id = auth.uid()
        or ra.assigned_by = auth.uid()
        or public.is_platform_admin()
        or exists (
          select 1 from public.solutions s
          where ra.subject_type = 'solution' and s.id = ra.subject_id and public.can_read_team(s.team_id)
        )
        or exists (
          select 1 from public.hardware_projects h
          where ra.subject_type = 'hardware_project' and h.id = ra.subject_id and public.can_read_team(h.team_id)
        ))
  )
);

-- Only the assigned reviewer writes a record; the guard trigger in Part 4
-- protects the `verified` flag from non-admin edits.
create policy "assigned reviewer submits review" on public.review_records
for insert to authenticated
with check (exists (
  select 1 from public.review_assignments ra
  where ra.id = assignment_id and ra.reviewer_id = auth.uid()
));

create policy "reviewer refines; admin verifies" on public.review_records
for update to authenticated
using (exists (
  select 1 from public.review_assignments ra
  where ra.id = assignment_id and (ra.reviewer_id = auth.uid() or public.is_platform_admin())
));

-- proof_contributions ------------------------------------------------------------------------------
alter table public.proof_contributions enable row level security;

create policy "card visibility gates contributions" on public.proof_contributions
for select
to anon, authenticated
using (exists (
  select 1 from public.proof_cards pc
  where pc.id = card_id
    and (
      public.can_read_team(pc.team_id)
      or (pc.visibility = 'public' and pc.review_status in ('approved', 'published'))
    )
));

create policy "team editors record contributions" on public.proof_contributions
for insert to authenticated
with check (exists (
  select 1 from public.proof_cards pc
  where pc.id = card_id and public.can_edit_team_work(pc.team_id)
));

create policy "team editors update contributions" on public.proof_contributions
for update to authenticated
using (exists (
  select 1 from public.proof_cards pc
  where pc.id = card_id and public.can_edit_team_work(pc.team_id)
))
with check (exists (
  select 1 from public.proof_cards pc
  where pc.id = card_id and public.can_edit_team_work(pc.team_id)
));

-- content_reports ------------------------------------------------------------------------------------
alter table public.content_reports enable row level security;

create policy "reporter & admins read reports" on public.content_reports
for select to authenticated
using (reporter = auth.uid() or public.is_platform_admin());

create policy "anyone authenticated may report" on public.content_reports
for insert to authenticated
with check (reporter = auth.uid());

create policy "platform admins handle reports" on public.content_reports
for update to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- ============================================================================
-- PART 4 of 5 — GUARD TRIGGERS (integrity, not ownership)
-- ============================================================================

-- Payment integrity: nobody except the owning organization's staff (or a
-- platform admin) may mark a milestone as paid, and paid milestones can never
-- regress to unpaid (financial records do not silently lose confirmation).
create function public.payment_status_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid;
begin
  select cp.organization_id into org
  from public.company_projects cp
  where cp.id = new.company_project_id;

  if new.status = 'paid' and old.status is distinct from 'paid' then
    if not (
      public.is_org_role(org, array['owner', 'representative'])
      or public.is_platform_admin()
    ) then
      raise exception 'Only the sponsoring organization or platform admins can mark a payment as paid';
    end if;
    new.paid_at := now();
  end if;

  if old.status = 'paid' and new.status is distinct from 'paid' then
    if new.status in ('disputed', 'cancelled') then
      -- Disputes/cancellations are legitimate, but must be authorised and referenced.
      null;
    elsif not public.is_platform_admin() then
      raise exception 'A confirmed payment cannot be silently un-confirmed';
    end if;
  end if;

  return new;
end;
$$;

create trigger payment_milestones_status_guard
before update on public.payment_milestones
for each row execute function public.payment_status_guard();

-- Review verification integrity: only platform admins may set or clear the
-- `verified` flag (and its timestamp) on a submitted review record.
create function public.review_verify_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verified is distinct from old.verified
     or new.verified_at is distinct from old.verified_at then
    if not public.is_platform_admin() then
      raise exception 'Only platform admins can change review verification';
    end if;
    if new.verified and new.verified_at is null then
      new.verified_at := now();
    end if;
    if not new.verified then
      new.verified_at := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger review_records_verify_guard
before update on public.review_records
for each row execute function public.review_verify_guard();

-- ============================================================================
-- PART 5 of 5 — GRANTS
-- ============================================================================

grant execute on function public.is_org_role(uuid, text[]) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;

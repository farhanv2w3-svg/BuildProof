-- ============================================================================
-- BuildProof — 0019_grants_repair_and_rls_recursion.sql  (additive)
--
-- TWO production defects found in practical post-deploy testing (2026-11-16,
-- during an authenticated session on /app/eventspace):
--
-- DEFECT 1 — "permission denied" (403) on core platform tables
--   0005_grants_fix.sql documents the intended least-privilege grant matrix,
--   but its statements never took effect on the live database (authenticated
--   has no SELECT on profiles/user_roles/notifications, etc.). Because the
--   public schema runs deny-by-default default-privileges
--   (anon/authenticated keep only TRUNCATE/REFERENCES/TRIGGER/MAINTAIN),
--   every un-granted table fails BEFORE RLS is evaluated. Part A below
--   re-applies 0005's exact grant matrix. Grants never widen RLS: without a
--   matching policy a granted privilege still returns zero rows.
--
-- DEFECT 2 — "infinite recursion detected in policy for relation
--             es_event_team_members" (500)
--   The SELECT policy of es_event_teams inlined an EXISTS over
--   es_event_team_members, while es_event_team_members policies inlined
--   EXISTS over es_event_teams — a policy cycle that Postgres aborts.
--   Part B replaces the invoker-context inline subqueries with SECURITY
--   DEFINER helpers (which bypass RLS as table owner), preserving exactly
--   the same access semantics. This also unblocks es_registrations, whose
--   read policy inlines a members EXISTS that re-entered the cycle.
--
-- No data is modified (except the 0005 storage-bucket alignment, which is
-- idempotent). No policy becomes more permissive than 0015/0016 intended.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PART B helpers first (referenced by rewritten policies below)
-- ---------------------------------------------------------------------------
create or replace function public.es_is_team_member_any(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Any membership row for the caller (invited or active).
  select exists (
    select 1 from public.es_event_team_members m
    where m.team_id = p_team_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.es_is_team_leader(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.es_event_teams t
    where t.id = p_team_id and t.leader_user_id = auth.uid()
  );
$$;

create or replace function public.es_can_manage_team(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.es_event_teams t
    where t.id = p_team_id
      and (t.leader_user_id = auth.uid() or public.es_can_manage_event(t.event_id))
  );
$$;

revoke all on function public.es_is_team_member_any(uuid) from public, anon;
revoke all on function public.es_is_team_leader(uuid)    from public, anon;
revoke all on function public.es_can_manage_team(uuid)   from public, anon;
grant execute on function public.es_is_team_member_any(uuid) to authenticated;
grant execute on function public.es_is_team_leader(uuid)     to authenticated;
grant execute on function public.es_can_manage_team(uuid)    to authenticated;

-- FIX the cycle, edge 1: es_event_teams read policy
drop policy "read event teams" on public.es_event_teams;
create policy "read event teams" on public.es_event_teams
for select to authenticated
using (
  public.es_can_manage_event(event_id)
  or public.es_is_team_member(id)
  or public.es_is_participant(event_id)
  or public.es_is_team_member_any(id)
);

-- FIX the cycle, edge 2: es_event_team_members policies
drop policy "read team membership" on public.es_event_team_members;
create policy "read team membership" on public.es_event_team_members
for select to authenticated
using (
  user_id = auth.uid()
  or public.es_is_team_member(team_id)
  or public.es_can_manage_team(team_id)
);

drop policy "leader invites members" on public.es_event_team_members;
create policy "leader invites members" on public.es_event_team_members
for insert to authenticated
with check (
  user_id <> auth.uid()
  and public.es_is_team_leader(team_id)
  and public.es_rate_ok('es_team_invite:' || auth.uid()::text, 30, interval '1 hour')
);

drop policy "members manage own membership" on public.es_event_team_members;
create policy "members manage own membership" on public.es_event_team_members
for update to authenticated
using (
  user_id = auth.uid()
  or public.es_can_manage_team(team_id)
)
with check (
  user_id = auth.uid()
  or public.es_can_manage_team(team_id)
);

drop policy "leader removes members" on public.es_event_team_members;
create policy "leader removes members" on public.es_event_team_members
for delete to authenticated
using (public.es_can_manage_team(team_id));

-- Same-cycle collateral: es_registrations read policy inlined the members
-- EXISTS; express it via the existing definer helper (identical predicate:
-- active membership of the caller on the registration's team).
drop policy "participants & organisers read registrations" on public.es_registrations;
create policy "participants & organisers read registrations" on public.es_registrations
for select to authenticated
using (
  user_id = auth.uid()
  or public.es_can_manage_event(event_id)
  or public.es_is_team_member(team_id)
);

-- ---------------------------------------------------------------------------
-- PART A — re-apply the 0005 least-privilege grant matrix (verbatim intent)
-- ---------------------------------------------------------------------------

-- Layer 1: anonymous SELECT on the 11 tables whose policies intend anon reads.
grant select on
  public.proof_cards,
  public.proof_card_skills,
  public.proof_contributions,
  public.organizations,
  public.organization_members,
  public.company_projects,
  public.team_role_requirements,
  public.solutions,
  public.funding_opportunities,
  public.job_opportunities,
  public.events
to anon;

-- Helpers invoked inside anon-evaluated SELECT policies.
grant execute on
  function public.can_read_team(uuid),
  public.is_org_admin(uuid),
  public.is_platform_admin()
to anon;

-- Private storage limits — keep client validation and server config aligned.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv'
    ]
where id = 'evidence' and public is false;

-- Layer 2: authenticated DML matrix.
grant select on all tables in schema public to authenticated;

grant insert on
  public.institutions, public.user_roles, public.cohorts, public.gates,
  public.cohort_members, public.problems, public.problem_screenings,
  public.teams, public.team_members, public.team_invites, public.interviews,
  public.evidence_attachments, public.feasibility_reviews, public.prototype_tests,
  public.user_tests, public.team_decisions, public.proof_cards,
  public.proof_card_skills, public.mentor_assignments, public.comments,
  public.notifications, public.audit_logs, public.organizations,
  public.organization_members, public.team_role_requirements,
  public.team_applications, public.project_milestones, public.project_tasks,
  public.company_projects, public.payment_milestones, public.solutions,
  public.solution_interests, public.solution_transfer_agreements,
  public.funding_opportunities, public.funding_applications,
  public.hardware_projects, public.job_opportunities,
  public.opportunity_applications, public.review_assignments,
  public.review_records, public.proof_contributions, public.content_reports,
  public.events
to authenticated;

grant update on
  public.profiles, public.cohorts, public.cohort_members, public.problems,
  public.team_members, public.team_invites, public.interviews,
  public.feasibility_reviews, public.prototype_tests, public.proof_cards,
  public.notifications, public.organizations, public.team_applications,
  public.project_milestones, public.project_tasks, public.company_projects,
  public.payment_milestones, public.solutions, public.solution_interests,
  public.solution_transfer_agreements, public.funding_opportunities,
  public.funding_applications, public.hardware_projects,
  public.job_opportunities, public.opportunity_applications,
  public.review_assignments, public.review_records, public.content_reports,
  public.events
to authenticated;

grant delete on
  public.user_roles, public.evidence_attachments, public.proof_card_skills,
  public.organization_members, public.team_role_requirements,
  public.project_milestones, public.project_tasks,
  public.opportunity_applications, public.proof_contributions, public.events
to authenticated;

-- Layer 3: EXECUTE on every policy-internal helper for authenticated.
grant execute on
  function public.is_team_member(uuid),
  public.is_cohort_member(uuid),
  public.is_cohort_staff(uuid),
  public.is_institution_admin(uuid),
  public.has_any_role(text[]),
  public.can_read_team(uuid),
  public.can_edit_team_work(uuid),
  public.can_review_team_work(uuid),
  public.submitted_by_check(uuid, uuid),
  public.is_org_role(uuid, text[]),
  public.is_org_admin(uuid),
  public.is_platform_admin()
to authenticated;

-- Client-invoked RPCs (re-asserted; idempotent).
grant execute on
  function public.accept_team_invite(uuid),
  public.find_user_id_by_email(text)
to authenticated;

-- Hardening: trigger functions never need role EXECUTE.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.proof_card_review_guard() from public, anon, authenticated;
revoke execute on function public.payment_status_guard() from public, anon, authenticated;
revoke execute on function public.review_verify_guard() from public, anon, authenticated;
revoke execute on function public.enforce_self_member_status_only() from public, anon, authenticated;

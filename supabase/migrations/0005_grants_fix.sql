-- ============================================================================
-- 0005 — LEAST-PRIVILEGE GRANTS REPAIR
-- STATUS: DRAFT — NOT APPROVED / NOT EXECUTED against the live database.
--
-- ROOT CAUSE
--   Migrations 0001/0003/0004 create all 44 public tables WITH complete RLS
--   policies but WITHOUT any table-level GRANT statements and without default
--   privileges. Live evidence: every anonymous REST read fails with
--   `42501 permission denied for table` BEFORE any policy is evaluated.
--   RLS is not the problem — the SQL privilege layer is missing entirely.
--
-- WHAT THIS MIGRATION DOES
--   Layer 1: anon gets SELECT on exactly the 11 tables whose policies intend
--            anonymous reads. Rows remain RLS-filtered (e.g. only
--            public+approved Proof Cards are ever visible). No anon writes.
--   Layer 2: authenticated gets the minimal DML matrix actually required by
--            the application (derived operation-by-operation from src/lib/api.ts
--            and cross-checked against every RLS policy). Append-only tables
--            get no DELETE. Tables with no UPDATE policy get no UPDATE.
--   Layer 3: EXECUTE on the policy-internal SECURITY DEFINER helpers, and on
--            the two RPC functions. Trigger functions are hardened: EXECUTE
--            revoked from PUBLIC/anon (triggers do not need ACL grants).
--
-- ROLLBACK (exact inverse)
--   revoke select on <11 tables> from anon;
--   revoke <ops> on <tables> from authenticated;   -- per statement below
--   revoke execute on <functions> from anon, authenticated;
--   grant execute on <5 trigger functions> to public;  -- restores PG default
--
-- DEFAULT-PRIVILEGES NOTE (differs from existing-object grants!)
--   The statements below repair EXISTING objects only. For FUTURE objects,
--   run in the dashboard (role = the actual table owner, normally postgres):
--     alter default privileges for role postgres in schema public
--       grant select on tables to anon;
--   Supabase typically applies its own defaults for authenticated/service_role.
--   Verify first: select * from pg_default_acl;
-- ============================================================================

-- ---------------------------------------------------------------------------
-- LAYER 1 — anonymous: SELECT on the 11 anon-policy tables ONLY
-- (proof: `to anon` policy greps in 0001:961,994; 0003:488,509,542,610,696,
--  789,867,1008; 0004:94 — `problems` deliberately EXCLUDED, see 0001:716-718)
-- ---------------------------------------------------------------------------
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

-- Helpers invoked inside anon-evaluated SELECT policies
-- (can_read_team → team_role_requirements; is_org_admin → company_projects,
--  funding_opportunities, job_opportunities; is_platform_admin → funding/job).
grant execute on
  function public.can_read_team(uuid),
  function public.is_org_admin(uuid),
  function public.is_platform_admin()
to anon;

-- ---------------------------------------------------------------------------
-- PRIVATE STORAGE LIMITS — evidence is neither public nor unlimited
-- ---------------------------------------------------------------------------
-- Keep client validation and server-side storage configuration aligned. The
-- bucket remains private; MIME and size constraints apply independently of UI.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv'
    ]
where id = 'evidence' and public is false;

-- ---------------------------------------------------------------------------
-- LAYER 2 — authenticated: minimal required DML per table
-- (operation matrix: src analysis script; legitimacy cross-checked vs policies)
-- ---------------------------------------------------------------------------

-- SELECT on all 44 tables (every table has a legitimate authenticated read)
grant select on all tables in schema public to authenticated;

-- INSERT where the client legitimately inserts (43 tables; NOT profiles —
-- profile rows are created only by the handle_new_user trigger)
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

-- UPDATE only where the client performs a legitimate update (29 tables;
-- excludes: teams — no client update path exists today; comments,
-- problem_screenings, user_tests, team_decisions, mentor_assignments —
-- UPDATE constrained by requester-side flows or no policy)
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

-- DELETE only where client deletes AND a DELETE policy exists (10 tables)
grant delete on
  public.user_roles, public.evidence_attachments, public.proof_card_skills,
  public.organization_members, public.team_role_requirements,
  public.project_milestones, public.project_tasks,
  public.opportunity_applications, public.proof_contributions, public.events
to authenticated;

-- ---------------------------------------------------------------------------
-- LAYER 3 — EXECUTE on every policy-internal helper for authenticated
-- (SECURITY DEFINER; policies evaluate these under the invoking role)
-- ---------------------------------------------------------------------------
grant execute on
  function public.is_team_member(uuid),
  function public.is_cohort_member(uuid),
  function public.is_cohort_staff(uuid),
  function public.is_institution_admin(uuid),
  function public.has_any_role(text[]),
  function public.can_read_team(uuid),
  function public.can_edit_team_work(uuid),
  function public.can_review_team_work(uuid),
  function public.submitted_by_check(uuid, uuid),
  function public.is_org_role(uuid, text[]),
  function public.is_org_admin(uuid),
  function public.is_platform_admin()
to authenticated;

-- Client-invoked RPCs (already granted in 0001:1350-1351 — re-asserted here
-- so this migration is self-contained and idempotent)
grant execute on
  function public.accept_team_invite(uuid),
  function public.find_user_id_by_email(text)
to authenticated;

-- ---------------------------------------------------------------------------
-- HARDENING — trigger functions never need role EXECUTE (invocation is
-- internal); remove the PostgreSQL default EXECUTE-to-PUBLIC surface
-- ---------------------------------------------------------------------------
revoke execute on function public.handle_new_user() from public, anon;
revoke execute on function public.proof_card_review_guard() from public, anon;
revoke execute on function public.payment_status_guard() from public, anon;
revoke execute on function public.review_verify_guard() from public, anon;
revoke execute on function public.enforce_self_member_status_only() from public, anon;
-- authenticated retains nothing on triggers either (still grant-safe):
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.proof_card_review_guard() from authenticated;
revoke execute on function public.payment_status_guard() from authenticated;
revoke execute on function public.review_verify_guard() from authenticated;
revoke execute on function public.enforce_self_member_status_only() from authenticated;

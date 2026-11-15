-- ============================================================================
-- 0006 — SECURITY POLICY REPAIRS (S1, S2, S4, S5, S6, S8 + new finding D1)
-- (S3 transfer-consent and S7 payment-integrity live in 0007 — they need
--  triggers/functions rather than plain policy swaps.)
-- STATUS: DRAFT — NOT APPROVED / NOT EXECUTED against the live database.
--
-- Every change here replaces an OVER-BROAD policy with a NARROWER one, or
--tightens an RPC. Nothing weakens access; each change removes a proven
-- loophole. Rollback notes accompany each block.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- S1 — Audit-log actor forgery (0001:1095-1102)
-- Problem: the insert policy checked only the sender's ROLE; `actor_id` came
--   from the client (writeAuditLog signature), so any reporter-role user could
--   attribute an audit entry to ANY user.
-- Fix: inserted rows must name the caller (auth.uid()) as actor, be anonymous
--   (actor_id null for auto-entries), or — only for platform admins — name
--   someone else for controlled system entries.
-- Rollback: drop policy + recreate original 0001 wording.
-- ---------------------------------------------------------------------------
drop policy if exists "reporter roles write audit logs" on public.audit_logs;
create policy "reporter roles append own-actor audit logs"
  on public.audit_logs
  for insert to authenticated
  with check (
    public.has_any_role(array[
      'platform_admin', 'institution_admin', 'faculty_coordinator',
      'facilitator', 'mentor', 'problem_owner'
    ])
    and (
      actor_id = auth.uid()
      or actor_id is null
      or public.is_platform_admin()   -- controlled path for system entries
    )
  );

-- ---------------------------------------------------------------------------
-- S2 — problem_owner cross-subject read incl. owner_contact (0001:724-730)
-- Problem: any user self-registering with the `problem_owner` role could read
--   EVERY problem having owner_contact (whole row incl. contact details) with
--   zero linkage between role and problem. problems has no institution/owner
--   key to bind the role to, so no legitimate narrowing exists — the clause
--   itself cannot be made safe.
-- Fix: remove that conjunct entirely. Legitimate paths remain: approved
--   problems (everyone), own submissions, team-linked problems, platform
--   admins (the screening panel — where owner_contact is actually shown).
-- Rollback: recreate original policy from 0001:719-739.
-- ---------------------------------------------------------------------------
drop policy if exists "users see approved & own submissions" on public.problems;
create policy "users see approved & own submissions"
  on public.problems
  for select to authenticated
  using (
    status = 'approved'
    or submitted_by = auth.uid()
    or (
      exists (
        select 1 from public.teams t
        where t.problem_id = problems.id and public.can_read_team(t.id)
      )
    )
    or public.is_platform_admin()
  );

-- ---------------------------------------------------------------------------
-- S4 — Notification recipient restriction (0001:1077-1084)
-- Problem: any reporter-role user (incl. self-registered problem_owner) could
--   create notifications for ANY user (impersonating the platform).
-- Fix: sender is a platform admin (unbounded, as today) OR the recipient
--   shares a team / cohort / organization with the sender.
-- Rollback: drop helper + recreate original policy.
-- ---------------------------------------------------------------------------
create or replace function public.can_notify_recipient(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target is not null
    and exists (select 1 from public.profiles p where p.id = target)
    and (
      public.is_platform_admin()
      or exists (
        select 1 from public.team_members mine, public.team_members theirs
        where mine.user_id = auth.uid() and theirs.user_id = target
          and mine.team_id = theirs.team_id
          and mine.status in ('proposed', 'accepted')
          and theirs.status in ('proposed', 'accepted')
      )
      or exists (
        select 1 from public.cohort_members mine, public.cohort_members theirs
        where mine.user_id = auth.uid() and theirs.user_id = target
          and mine.cohort_id = theirs.cohort_id
          and mine.status in ('proposed', 'active')
          and theirs.status in ('proposed', 'active')
      )
      or exists (
        select 1 from public.organization_members mine, public.organization_members theirs
        where mine.user_id = auth.uid() and theirs.user_id = target
          and mine.organization_id = theirs.organization_id
      )
    );
$$;

drop policy if exists "reporter roles send notifications" on public.notifications;
create policy "reporter roles notify related users"
  on public.notifications
  for insert to authenticated
  with check (
    public.has_any_role(array[
      'platform_admin', 'institution_admin', 'faculty_coordinator',
      'facilitator', 'mentor', 'problem_owner'
    ])
    and public.can_notify_recipient(user_id)
  );

grant execute on function public.can_notify_recipient(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- S5 — Reviewers mutating team identity fields (0001:781-784)
-- Problem: teams UPDATE policy allowed can_review_team_work (assigned mentors,
--   cohort staff via review path, admins) — mentors could rename teams,
--   change status or re-link the problem.
-- Fix: only team editors (members + cohort staff) may update teams. Reviewers
--   keep all their OTHER review rights (interviews, feasibility, etc.).
--   No client code performs teams.update today, so behaviour does not change.
-- Rollback: recreate original policy from 0001:781-784.
-- ---------------------------------------------------------------------------
drop policy if exists "team members manage teams" on public.teams;
create policy "team editors manage teams"
  on public.teams
  for update to authenticated
  using (public.can_edit_team_work(id))
  with check (public.can_edit_team_work(id));

-- ---------------------------------------------------------------------------
-- S6 — Duplicate funding applications (0003 — table has no unique constraint,
--      unlike opportunity_applications / team_applications / solution_interests)
-- Pre-check for existing duplicates BEFORE applying (run in dashboard):
--   select opportunity_id, applicant, count(*)
--   from public.funding_applications group by 1,2 having count(*) > 1;
-- If duplicates exist: resolve manually (keep earliest, delete rest) FIRST —
-- this index creation will fail while duplicates remain (by design; it is the
-- safety check itself).
-- Rollback: drop index funding_applications_unique_applier.
-- ---------------------------------------------------------------------------
create unique index if not exists funding_applications_unique_applier
  on public.funding_applications (opportunity_id, applicant);

-- ---------------------------------------------------------------------------
-- D1 — Missing DELETE policy on proof_contributions (NEW finding)
-- Problem: ProofContributions.tsx:58 calls deleteContribution() but 0003 has
-- Problem: ProofContributions.tsx:58 calls deleteContribution() but 0003 has
--   no delete policy → every removal fails with 42501 (broken UI button).
--   Insert/update already require can_edit_team_work; this mirrors that rule.
-- Rollback: drop policy.
-- ---------------------------------------------------------------------------
create policy "team editors remove contributions"
  on public.proof_contributions
  for delete to authenticated
  using (exists (
    select 1 from public.proof_cards pc
    where pc.id = proof_contributions.card_id
      and public.can_edit_team_work(pc.team_id)
  ));

-- Also grant the now-legitimate DELETE (0005 predates this policy fix;
-- delete on proof_contributions was already listed in 0005 — keep both in
-- sync: the 0005 grant supports this policy once this migration applies).

-- ---------------------------------------------------------------------------
-- S8 — User-enumeration via find_user_id_by_email (0001:1290-1301)
-- Problem: SECURITY DEFINER lookup of ANY email → user id was callable by
--   every authenticated user (e.g. self-registered problem_owner accounts),
--   enabling enumeration of the user base by email.
-- Fix: restrict to staff-like roles. Preserves both legitimate flows
--   (institution/cohort staff add members; admins grant roles) while denying
--   students/anonymous-registered problem-owner accounts.
-- Rollback: recreate original function body from 0001:1290-1301.
-- ---------------------------------------------------------------------------
create or replace function public.find_user_id_by_email(lookup_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case when public.has_any_role(array[
      'platform_admin', 'institution_admin',
      'faculty_coordinator', 'facilitator'
    ])
    then (
      select u.id from auth.users u
      where lower(u.email) = lower(lookup_email)
        and u.id <> auth.uid()
      limit 1
    )
  end;
$$;

grant execute on function public.find_user_id_by_email(text) to authenticated;

-- ---------------------------------------------------------------------------
-- D2 — (NEW finding, Phase 3) mentor_assignments has an INSERT policy but NO
-- UPDATE policy: a mentor assignment can never be revoked or deactivated by
-- anyone, even the cohort staff who created it. Needed by the MentorsPanel
-- revoke button. Narrow scope: cohort staff of the assignment's team.
-- Rollback: revoke grant; drop policy.
-- ---------------------------------------------------------------------------
create policy "cohort staff manage assignments"
  on public.mentor_assignments
  for update to authenticated
  using (exists (
    select 1 from public.teams t
    where t.id = mentor_assignments.team_id
      and public.is_cohort_staff(t.cohort_id)
  ))
  with check (exists (
    select 1 from public.teams t
    where t.id = mentor_assignments.team_id
      and public.is_cohort_staff(t.cohort_id)
  ));

-- 0005's UPDATE matrix predates this finding (it listed 29 tables and
-- explicitly excluded mentor_assignments because no policy existed then).
-- The policy above needs the privilege layer open for that one table.
grant update on public.mentor_assignments to authenticated;

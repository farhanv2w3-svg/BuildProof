-- ============================================================================
-- 0007 — S3 TRANSFER-AGREEMENT CONSENT + S7 PAYMENT STATUS INTEGRITY
-- STATUS: DRAFT — NOT APPROVED / NOT EXECUTED against the live database.
--
-- DEPENDENCIES: S3 changes what clients are ALLOWED to send. The companion
--   frontend change (TeamSolutionsPage consent buttons split per party) must
--   ship with this migration; deploying one without the other breaks the
--   transfer workflow.
-- All changes are additive (new columns are nullable; triggers only constrain
--   previously-invalid transitions).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- S3 — One-party transfer-agreement consent
-- Model: `agreed_by_creator` = the SOLUTION OWNER TEAM consents to transfer;
--        `agreed_by_other`  = the PROPOSER (proposed_by) consents.
-- Problem (0003:764-779 + TeamSolutionsPage:243-244): one UPDATE could set
--   BOTH flags — a single actor could manufacture mutual consent.
-- Fix: BEFORE UPDATE trigger checks, per flag moving false→true, that the
--   acting user (auth.uid()) IS that party. Adds consent timestamps.
-- Rollback: drop trigger + function; alter table drop column both *_at.
-- ---------------------------------------------------------------------------
alter table public.solution_transfer_agreements
  add column if not exists agreed_by_creator_at timestamptz,
  add column if not exists agreed_by_other_at timestamptz;

create or replace function public.transfer_consent_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if new.status in ('agreed', 'executed') and not (new.agreed_by_creator is true and new.agreed_by_other is true) then
    raise exception 'Both parties must consent before an agreement can be agreed or executed';
  end if;

  -- Creator-side consent may only be given by a member/editor of the team
  -- that owns the solution.
  if new.agreed_by_creator is true and old.agreed_by_creator is not true then
    if actor is null or not exists (
      select 1 from public.solutions s
      where s.id = new.solution_id
        and public.can_edit_team_work(s.team_id)
    ) then
      raise exception 'Only the solution owner team may confirm creator consent';
    end if;
    new.agreed_by_creator_at := coalesce(old.agreed_by_creator_at, now());
  end if;

  -- Other-party consent may only be given by the proposer themselves.
  if new.agreed_by_other is true and old.agreed_by_other is not true then
    if actor is null or new.proposed_by is distinct from actor then
      raise exception 'Only the proposing party may confirm their own consent';
    end if;
    new.agreed_by_other_at := coalesce(old.agreed_by_other_at, now());
  end if;

  -- Who confirmed what is recorded in the audit trail (SECURITY DEFINER
  -- insert bypasses the RLS policy deliberately).
  if new.agreed_by_creator is true and old.agreed_by_creator is not true
     or new.agreed_by_other is true and old.agreed_by_other is not true then
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (
      actor,
      'transfer_consent',
      'solution_transfer_agreement',
      new.id,
      jsonb_build_object(
        'creator_consented', new.agreed_by_creator,
        'other_consented',   new.agreed_by_other
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists transfer_consent_guard on public.solution_transfer_agreements;
create trigger transfer_consent_guard
  before update on public.solution_transfer_agreements
  for each row execute function public.transfer_consent_guard();

revoke execute on function public.transfer_consent_guard() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- S7 — Payment milestone state machine + audit (0003:1061-1099)
-- Problems:
--   (a) the existing guard deliberately left paid→cancelled/disputed
--       UNAUTHORISED (explicit `null;` placeholder at 0003:1087);
--   (b) platform admins have NO update policy on payment_milestones, so the
--       guard's admin branch is unreachable and admin oversight impossible;
--   (c) no financial state change is audited.
-- Fix:
--   1. paid → cancelled/disputed requires PLATFORM ADMIN (org staff escalate
--      disputes through support; per the repair instruction "require
--      platform-level authorization for disputed or reversed states").
--   2. Any status transition writes an audit_logs row (actor, from, to).
--   3. Platform admins get an update policy (oversight + dispute handling).
-- Rollback: recreate 0003 guard + drop new policy; rows stay intact.
-- ---------------------------------------------------------------------------
create or replace function public.payment_status_guard()
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
    -- Disputes/cancellations of a CONFIRMED payment are a platform decision.
    if new.status in ('disputed', 'cancelled') then
      if not public.is_platform_admin() then
        raise exception 'Cancelling or disputing a paid milestone requires a platform admin';
      end if;
    elsif new.status <> 'paid' and not public.is_platform_admin() then
      raise exception 'A confirmed payment cannot be silently un-confirmed';
    end if;
  end if;

  -- Audit every status transition (append-only; owner bypasses RLS here).
  if new.status is distinct from old.status then
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (
      auth.uid(),
      'payment_milestone_status',
      'payment_milestone',
      new.id,
      jsonb_build_object('from', old.status, 'to', new.status, 'paid_at', new.paid_at)
    );
  end if;

  return new;
end;
$$;

-- Trigger functions do not need direct role EXECUTE.
revoke execute on function public.payment_status_guard() from public, anon, authenticated;

-- Platform-admin oversight path (UPDATE was previously impossible for admins)
drop policy if exists "platform admins oversee payment milestones" on public.payment_milestones;
create policy "platform admins oversee payment milestones"
  on public.payment_milestones
  for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

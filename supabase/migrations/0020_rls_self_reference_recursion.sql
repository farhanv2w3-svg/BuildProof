-- ============================================================================
-- BuildProof — 0020_rls_self_reference_recursion.sql  (additive)
--
-- DEFECT — "infinite recursion detected in policy for relation X" (42P17)
--   Found via the authenticated programme dashboard (/app) after 0019
--   restored table grants: `cohort_members` returns 500 because its SELECT
--   policy contains an inline EXISTS that queries `cohort_members` itself.
--   A policy on relation X that reads relation X re-enters its own policy
--   evaluation, which Postgres always aborts. The defect has existed since
--   0001 but was masked until now by the missing table grants (requests
--   failed at the privilege layer with 403 before any policy ran).
--
--   The same pattern exists latently in 0015's "managers update events"
--   policy on es_events: its WITH CHECK re-reads es_events to compare
--   created_by. Never exercised yet (es_events is empty) but would 42P17 on
--   the first manager edit.
--
-- FIX — replace both invoker-context self-references with SECURITY DEFINER
--   helpers (which read the table as owner, bypassing RLS), preserving the
--   exact access semantics:
--     * roster visibility for ANY membership row of the caller (the inline
--       EXISTS had no status filter, unlike is_cohort_member);
--     * ownership transfer remains impossible (NEW.created_by must equal
--       the stored created_by).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper: any membership row for the caller on a cohort (any status).
-- The 0001 inline EXISTS had no status filter, so preserve that exactly.
-- ---------------------------------------------------------------------------
create or replace function public.is_cohort_member_any(p_cohort_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.cohort_members cm
    where cm.cohort_id = p_cohort_id
      and cm.user_id = auth.uid()
  );
$$;

revoke all on function public.is_cohort_member_any(uuid) from public, anon;
grant execute on function public.is_cohort_member_any(uuid) to authenticated;

-- cohort_members read policy: drop the self-referential EXISTS.
drop policy "members & staff read cohort membership" on public.cohort_members;
create policy "members & staff read cohort membership" on public.cohort_members
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_cohort_staff(cohort_id)
  -- cohort members may see the roster of their own cohort
  or public.is_cohort_member_any(cohort_id)
);

-- ---------------------------------------------------------------------------
-- Helper: stored owner of an event (definer read of es_events).
-- ---------------------------------------------------------------------------
create or replace function public.es_event_owner(p_event_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.created_by from public.es_events e where e.id = p_event_id;
$$;

revoke all on function public.es_event_owner(uuid) from public, anon;
grant execute on function public.es_event_owner(uuid) to authenticated;

-- es_events update policy: same predicates, self-query replaced by helper.
drop policy "managers update events" on public.es_events;
create policy "managers update events" on public.es_events
for update to authenticated
using (public.es_can_manage_event(id))
with check (
  public.es_can_manage_event(id)
  and (created_by = auth.uid() or public.is_platform_admin())
  and created_by = public.es_event_owner(id)
);

-- ============================================================================
-- BuildProof — 0016_eventspace_integrity_fixes.sql  (additive; run AFTER 0015)
--
-- Purpose: fix the five database-integrity issues identified in the EventSpace
-- Phase 0 audit. Migration 0015 is NOT rewritten; every change here is either
-- purely additive or a narrowly-scoped replacement of exactly one function /
-- one view, each documented below.
--
-- Fixes
--   1. es_submission_window_open — resubmit_until no longer keeps the initial
--      submission window open indefinitely. Initial submissions always follow
--      submission_deadline; only a revision-requested submission may resubmit
--      inside resubmit_until. Closed/cancelled events never accept anything.
--   2. es_public_results — recreated as a definer view (security_barrier) with
--      a fixed WHERE so published results of public events are readable by
--      anonymous visitors. es_results itself stays locked to organisers; no
--      policy or grant is added to the base table.
--   3. es_notify_event_audience — SECURITY DEFINER RPC letting an authorised
--      event organiser deliver announcement notifications to this event's
--      registered participants and/or assigned judges. Recipients are derived
--      server-side from the event; arbitrary recipient ids are impossible.
--      Existing notification policies (0001/0006/0012) are untouched.
--   4. es_evaluations_finality_guard — final evaluations are locked for
--      judges; only a platform admin may correct one, only before results are
--      published, and every correction is written to audit_logs.
--   5. Partial unique index — at most one team submission per (event, team),
--      regardless of which team member initiates it. Individual submissions
--      keep the existing (event_id, owner_type, owner_user_id) rule.
--
-- Post-audit review fixes (second review round):
--   6. es_event_organizers had RLS policies in 0015 but RLS was never
--      ENABLEd — the policies were inert and organiser applications
--      (official emails, reasons, verification notes) were readable by
--      anyone holding the default table grant. Enabled here.
--   7. Function execute grants: es_rate_ok is invoked DIRECTLY inside seven
--      RLS policy expressions (organiser application, event creation, team
--      creation, invitations, registration, file upload, evaluation) but was
--      revoked from PUBLIC with no replacement grant — every one of those
--      policies would fail with "permission denied for function es_rate_ok".
--      es_review_organizer and es_withdraw_organizer_application had the same
--      revoke-without-grant gap (their client .rpc() calls would fail).
--      Granted to authenticated. (es_resolve_invitee was already granted
--      by 0015:576.)
--   8. es_public_results now joins es_showcases only when sh.status =
--      'published', so unpublished (draft/pending/owner_approved) showcase
--      content can never surface through a published result. Result rows
--      still appear; project fields are NULL until the showcase itself is
--      published (the UI already falls back to "Winning project").
--   9. Team-membership rows are immutable in team_id and user_id (a member
--      could previously move their membership row into another team without
--      an invitation); member_role/invited_by may only be changed by the
--      team leader or an organiser. 0015's checks are preserved verbatim.
--
-- Third review round fixes:
--   10. Rate-limiter hardening: es_rate_ok honoured caller-supplied max and
--       interval blindly, so an authenticated user could call it with a
--       NEGATIVE interval (the expiry condition then resets the counter on
--       every call — an unlimited bypass) or an oversized maximum. The
--       recreated function now validates: the action must be one of the seven
--       fixed policy actions, max/window must match that action's exact fixed
--       values, and the bucket must address the CALLER's own user id. The
--       authenticated grant stays (0015's policies call it in invoker
--       context) but it is no longer abusable. The announcement RPC's
--       per-event limiter moved to a separate internal es_rate_ok_event()
--       with fixed 30/hour and no authenticated grant, so users can no longer
--       burn an event's announcement quota directly. The bucket format is
--       now fully canonical — EXACTLY '<action>:<caller-uid>' with one
--       colon — so arbitrary suffixes ('es_eval:<uid>:extra'), empty and
--       NULL buckets are rejected and unlimited bucket-minting is closed.
--       The announcement RPC also now explicitly rejects NULL audiences
--       (SQL NOT IN alone evaluates to NULL for NULL input) and accepts
--       ONLY plain in-app paths: external http(s), protocol-relative
--       '//host', javascript:/data:/any scheme, backslashes, control
--       characters and malformed percent-encodings are all rejected.
--   11. Membership status transitions: removed/left/declined members could
--       previously reactivate themselves (removed → active passed the
--       registration + capacity checks). The recreated trigger now enforces
--       the transition matrix: invited→active/declined (invitee or leader),
--       active→left (member or leader), invited/active→removed and
--       declined/left/removed→invited (leader/organiser only). A member can
--       accept, decline or leave, but NEVER self-reactivate.
--   12. es_public_results no longer exposes r.note — a free-text organiser
--       field (up to 1000 chars) with no established public use case.
--       Removed from the view and from the public row type.
--   13. Team creation was RLS-blocked (found during end-to-end review): the
--       only member INSERT policy required user_id <> auth.uid(), but
--       createTeam inserts the leader's own active row. A narrow policy now
--       allows the team creator to add exactly their own leader row.
--
-- Safety
--   * No table is created, altered or recreated; no existing data is modified.
--   * Created/replaced objects: 2 functions (deadline window + submit guard),
--     1 view recreation (views hold no data), 1 RPC, 1 trigger, 1 index.
--   * The whole migration runs in ONE transaction: if any statement fails the
--     transaction rolls back — nothing is partially applied and no error is
--     silently masked.
--   * Index es_submissions_team_unique fails loudly if a live database already
--     contains two team submissions for the same (event, team). Recovery:
--       (a) find duplicates:
--             select event_id, team_id, count(*) from public.es_submissions
--             where owner_type = 'team' and team_id is not null
--             group by 1, 2 having count(*) > 1;
--       (b) keep the submitted/accepted row, delete the extra draft rows,
--       (c) re-run only the CREATE UNIQUE INDEX statement below.
--
-- Time semantics: every es_events date column is timestamptz and is compared
-- against now() (an absolute instant), so comparisons are timezone-safe. The
-- event.timezone column is display-only metadata, exactly as in 0015.
--
-- Application order: 0001 … 0015, then this file. NOT yet applied (the
-- production database must never be pushed from this repository directly;
-- apply via the documented Supabase SQL workflow after review).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FIX 1 — submission window authority
--
-- The one-argument function from 0015 is replaced by a two-argument version.
-- The submit trigger (recreated below, otherwise identical) passes
--   p_is_resubmission := (new.status = 'resubmitted')
-- so the deadline rule is chosen per transition:
--   * initial submit  -> submission_deadline only (resubmit_until NEVER
--                        extends the initial window — this was the bug);
--   * resubmit        -> resubmit_until when set, else submission_deadline;
--   * any state       -> event must be published and submission_open.
-- Boundary: a submission at exactly the deadline instant is still allowed
-- (submission_deadline >= now() / now() <= resubmit_until), matching the
-- client-side rule in src/lib/eventspaceRules.ts.
-- ----------------------------------------------------------------------------
drop function if exists public.es_submission_window_open(uuid);

create or replace function public.es_submission_window_open(
  p_event_id uuid,
  p_is_resubmission boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.es_events e
    where e.id = p_event_id
      and e.status = 'published'            -- draft/completed/cancelled/archived never accept
      and coalesce(e.submission_open, true)
      and (e.submission_opens_at is null or e.submission_opens_at <= now())
      and (
        case
          -- Resubmission (revision-requested work) follows resubmit_until
          -- when the organiser set one, otherwise the normal deadline.
          when p_is_resubmission and e.resubmit_until is not null
            then e.resubmit_until >= now()
          -- Initial submissions are never extended by resubmit_until.
          else e.submission_deadline is null or e.submission_deadline >= now()
        end
      )
  );
$$;

-- Recreated from 0015 (lines 977-1065) with exactly two changes:
--   (a) the window call passes the resubmission flag;
--   (b) a resubmission is only allowed from 'revision_requested' (a submission
--       is "eligible for revision" only when the organiser requested one).
-- NOTE: 'revision_requested' -> 'draft' intentionally drops revision
-- eligibility (the draft would then be governed by the initial deadline).
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

    -- Resubmissions are only permitted for work the organiser sent back.
    if new.status = 'resubmitted' and old.status <> 'revision_requested' then
      raise exception 'Only revision-requested submissions can be resubmitted';
    end if;

    if new.status in ('submitted', 'resubmitted') then
      if not public.es_submission_window_open(v_event.id, new.status = 'resubmitted') then
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

-- ----------------------------------------------------------------------------
-- FIX 2 — public results security
--
-- The 0015 view was security_invoker, but es_results has no anon policy and its
-- authenticated select policy requires es_can_manage_event — so "public"
-- results were invisible to everyone except organisers. Two options existed:
--   (a) add anon/authenticated policies on es_results — REJECTED: RLS cannot
--       distinguish query paths, so anonymous users would be able to read the
--       organiser-only columns (created_by, note, published_at, ...) directly
--       from the base table;
--   (b) recreate the view as a definer view with a fixed WHERE — CHOSEN: the
--       column list stays exactly the 0015 showcase-safe set (no private
--       payloads, no judge data, no organiser identities), the WHERE is fixed
--       server-side, and the base table remains locked to organisers.
-- security_barrier prevents user-supplied quals from being pushed down in
-- leaky ways. security_invoker is deliberately omitted (default definer).
-- The view holds no data, so recreation preserves everything.
--
-- Post-audit correction (finding 3): the es_showcases join now ALSO requires
-- sh.status = 'published'. Without it, a published result could expose the
-- approved_title/summary/urls/image of a showcase that the owner has NOT yet
-- approved or the organiser has NOT yet published — bypassing the two-step
-- showcase workflow. Unpublished showcases contribute NULL project fields;
-- the results row itself still shows (the UI renders "Winning project").
-- Third-review correction: r.note (free-text organiser field, up to 1000
-- chars) is no longer exposed — it has no established public use case.
-- ----------------------------------------------------------------------------
drop view if exists public.es_public_results;

create view public.es_public_results
with (security_barrier = true) as
select
  r.id, r.event_id, r.award_id, r.submission_id, r.position,
  a.name as award_name, a.category as award_category,
  e.title as event_title, e.slug as event_slug,
  sh.approved_title, sh.approved_summary, sh.approved_demo_url, sh.approved_github_url,
  sh.team_attribution, sh.image_path, sh.status as showcase_status
from public.es_results r
join public.es_awards a on a.id = r.award_id
join public.es_events e on e.id = r.event_id
left join public.es_showcases sh
  on sh.submission_id = r.submission_id
 and sh.status = 'published'
where r.published = true
  and e.status in ('published', 'completed', 'archived')
  and e.visibility = 'public'
  and e.results_published = true;

grant select on public.es_public_results to anon, authenticated;

-- Deliberately NOT granted: any direct privilege on public.es_results beyond
-- what 0015 already grants (organisers only).

-- ----------------------------------------------------------------------------
-- FIX 3 — event announcement notifications
--
-- 0006 restricted notification inserts to platform roles that share a
-- team/cohort/org with each recipient, which event organisers can never
-- satisfy — announcement notifications were silently undeliverable. This RPC
-- is the organiser-branch fix:
--   * the caller's organiser permission is verified SERVER-SIDE via
--     es_can_manage_event (never taken from payload);
--   * recipients are derived from THIS event only (registrations and judge
--     assignments) — arbitrary recipient ids cannot be injected and
--     cross-event notification abuse is impossible;
--   * UNION de-duplicates users who are both participants and judges;
--   * existing policies for other platform features (0001/0006/0012) are
--     untouched — the definer insert here is an explicit, narrow authority;
--   * failures RAISE — callers cannot silently swallow delivery errors;
--   * rate-limited per event (30 sends / hour / event) via the internal
--     es_rate_ok_event below — deliberately NOT callable by authenticated
--     users, so nobody can burn an event's announcement quota directly.
-- ----------------------------------------------------------------------------
-- Internal per-event limiter for the announcement RPC. Fixed limits, uuid
-- bucket, and NO grant to authenticated/anon/public: only the SECURITY
-- DEFINER RPC (running as the owner) can reach it. Unlike es_rate_ok this
-- takes no caller-visible tunables beyond the event id.
-- ----------------------------------------------------------------------------
create or replace function public.es_rate_ok_event(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.es_rate_limits;
  v_bucket text := 'es_notify:' || coalesce(p_event_id::text, 'null');
begin
  insert into public.es_rate_limits (bucket, window_start, hits)
  values (v_bucket, now(), 1)
  on conflict (bucket) do update
    set hits = case
          when es_rate_limits.window_start < now() - interval '1 hour' then 1
          else es_rate_limits.hits + 1
        end,
        window_start = case
          when es_rate_limits.window_start < now() - interval '1 hour' then now()
          else es_rate_limits.window_start
        end
    returning * into v_row;
  return v_row.hits <= 30;
end;
$$;
revoke all on function public.es_rate_ok_event(uuid) from public, anon, authenticated;

create or replace function public.es_notify_event_audience(
  p_event_id uuid,
  p_audience text,      -- 'participants' | 'judges' | 'all'
  p_title text,
  p_body text default null,
  p_link text default null
)
returns integer       -- number of recipients actually notified
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notified integer := 0;
begin
  -- Issue C (third review): validate the COMPLETE allowed audience set,
  -- explicitly rejecting NULL — SQL's `x NOT IN (...)` evaluates to NULL for
  -- NULL input, which would quietly pass a bare `if` guard.
  if p_audience is null
     or p_audience not in ('participants', 'judges', 'all') then
    raise exception 'Invalid announcement audience';
  end if;
  if p_title is null or char_length(btrim(p_title)) < 1 or char_length(p_title) > 200 then
    raise exception 'Announcement title must be 1-200 characters';
  end if;
  if p_body is not null and char_length(p_body) > 2000 then
    raise exception 'Announcement body is too long (max 2000 characters)';
  end if;
  -- Issue B (third review): only PLAIN in-app paths are acceptable. This
  -- rejects absolute external URLs (http/https), protocol-relative URLs
  -- ('//host'), javascript:/data:/other schemes, backslashes (Windows-style
  -- path confusion), control characters, and malformed percent-encodings,
  -- while keeping legitimate internal navigation links working.
  if p_link is not null then
    if char_length(btrim(p_link)) = 0
       or char_length(p_link) > 500
       or p_link !~ '^/'                          -- not rooted at /
       or p_link ~ '^//+'                         -- protocol-relative //host
       or strpos(p_link, chr(92)) > 0             -- backslash
       or strpos(p_link, ':') > 0                 -- any scheme/userinfo (js:, https:, tel:)
       or p_link ~ '[[:cntrl:]]'                  -- control characters
       or p_link ~ '%(?![0-9A-Fa-f]{2})'          -- malformed percent-encoding
    then
      raise exception 'Announcement link must be a plain in-app path starting with a single /';
    end if;
  end if;

  if not public.es_can_manage_event(p_event_id) then
    raise exception 'Only this event''s organisers can send announcement notifications';
  end if;

  if not public.es_rate_ok_event(p_event_id) then
    raise exception 'Too many notifications for this event right now; try again later';
  end if;

  with participants as (
    select r.user_id
    from public.es_registrations r
    where r.event_id = p_event_id
      and r.status in ('registered', 'pending', 'waitlisted')
  ),
  judges as (
    select distinct ja.judge_user_id as user_id
    from public.es_judge_assignments ja
    where ja.event_id = p_event_id
      and ja.status <> 'removed'
      and ja.judge_user_id is not null
  ),
  recipients as (
    select user_id from participants where p_audience in ('participants', 'all')
    union
    select user_id from judges where p_audience in ('judges', 'all')
  )
  insert into public.notifications (user_id, type, title, body, link)
  select rc.user_id, 'es_announcement', p_title, p_body,
         coalesce(p_link, '/eventspace/' || e.slug)
  from recipients rc
  join public.es_events e on e.id = p_event_id;

  get diagnostics v_notified = row_count;
  return v_notified;
end;
$$;

revoke execute on function public.es_notify_event_audience(uuid, text, text, text, text)
  from public, anon;
grant execute on function public.es_notify_event_audience(uuid, text, text, text, text)
  to authenticated;

-- ----------------------------------------------------------------------------
-- FIX 4 — final evaluation immutability
--
-- The 0015 update policy let a judge rewrite a FINAL evaluation at any time —
-- even after results were published. This BEFORE UPDATE guard (firing before
-- es_evaluations_updated_at and es_evaluations_validate alphabetically):
--   * leaves drafts freely editable by their judge;
--   * blocks ALL non-admin updates to final evaluations (no silent reopen,
--     no score rewrite, private notes included);
--   * refuses even admin corrections while event results are published —
--     results must first be explicitly unpublished;
--   * allows platform-admin corrections otherwise, writing an audit_logs row
--     for every one of them.
-- RLS (private notes stay judge/organiser-only) is unchanged.
-- ----------------------------------------------------------------------------
create or replace function public.es_guard_evaluation_finality()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_results_published boolean;
begin
  if old.is_draft then
    return new;
  end if;

  select a.event_id, e.results_published
    into v_event_id, v_results_published
  from public.es_judge_assignments a
  join public.es_events e on e.id = a.event_id
  where a.id = old.assignment_id;

  if v_results_published then
    raise exception 'Results are published; unpublish results before correcting an evaluation';
  end if;

  if not public.is_platform_admin() then
    raise exception 'Final evaluations are locked and cannot be modified';
  end if;

  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (
    auth.uid(),
    'es_evaluation_admin_correction',
    'es_evaluations',
    old.id,
    jsonb_build_object(
      'assignment_id', old.assignment_id,
      'event_id', v_event_id,
      'old_is_draft', old.is_draft,
      'new_is_draft', new.is_draft,
      'old_total', old.total_score,
      'new_total', new.total_score
    )
  );

  return new;
end;
$$;

create trigger es_evaluations_finality_guard
  before update on public.es_evaluations
  for each row execute function public.es_guard_evaluation_finality();

-- The 0015 update policy was judge-only, so the audited admin-correction path
-- above could never be reached. Widened to add platform admins; the trigger
-- remains the authority (results-published lock + audit log).
drop policy "assigned judge updates own evaluation" on public.es_evaluations;
create policy "assigned judge or platform admin updates evaluation"
  on public.es_evaluations
  for update to authenticated
  using (
    exists (
      select 1 from public.es_judge_assignments a
      where a.id = assignment_id and a.judge_user_id = auth.uid()
    )
    or public.is_platform_admin()
  )
  with check (
    exists (
      select 1 from public.es_judge_assignments a
      where a.id = assignment_id and a.judge_user_id = auth.uid()
    )
    or public.is_platform_admin()
  );

-- ----------------------------------------------------------------------------
-- FIX 5 — team submission uniqueness
--
-- 0015's unique (event_id, owner_type, owner_user_id) keys on the CREATING
-- user, so two team members could each create a submission for the same team.
-- A partial unique index closes that hole without touching existing rows or
-- the individual-submission rule.
-- ----------------------------------------------------------------------------
create unique index if not exists es_submissions_team_unique
  on public.es_submissions (event_id, team_id)
  where owner_type = 'team' and team_id is not null;

-- ============================================================================
-- FIX 6 — RLS enablement correction (post-audit finding 1)
--
-- 0015 created policies on es_event_organizers but never ENABLEd row level
-- security, so the policies were inert. With Supabase's default table grants,
-- anonymous and ordinary authenticated users could read every organiser
-- application (org name, official email, position, reason, verification
-- notes) and write rows. The definer RPCs (es_review_organizer etc.) are
-- unaffected: the table owner bypasses RLS.
-- ============================================================================
alter table public.es_event_organizers enable row level security;

-- ============================================================================
-- FIX 7 — function execute grants (post-audit finding 2)
--
-- 0015 revoked these SECURITY DEFINER functions from PUBLIC but granted them
-- back to nobody except es_resolve_invitee. Two consequences:
--   * es_rate_ok is called DIRECTLY inside seven RLS policy expressions
--     (0015 lines 246, 463, 661, 720, 920, 1175, 1283). Policy expressions
--     execute with the invoking user's privileges, so every organiser
--     application, event creation, team creation, invitation, registration,
--     file upload and evaluation would fail with "permission denied for
--     function es_rate_ok". (Calls inside SECURITY DEFINER triggers, e.g.
--     0015:1059, were never affected.)
--   * es_review_organizer (admin) and es_withdraw_organizer_application
--     (organiser) are called via .rpc() from the client and would fail the
--     same way.
-- Both functions verify their own authority internally, so granting
-- execute to authenticated is safe; anon/public stay revoked.
--
-- FIX 10 hardening (third review round): the original es_rate_ok honoured the
-- caller's p_max/p_window blindly — a NEGATIVE interval makes the expiry
-- condition true on every call (counter resets: unlimited bypass) and an
-- oversized p_max disables the limit. Recreated below with a fixed-action
-- allow-list: only the seven policy actions exist, their max/window are fixed
-- constants, and the bucket must address the CALLING user. The grant above
-- stays because 0015's policies call it in invoker context — but it is no
-- longer abusable.
-- ============================================================================
grant execute on function public.es_rate_ok(text, integer, interval)
  to authenticated;
grant execute on function public.es_review_organizer(uuid, text, text)
  to authenticated;
grant execute on function public.es_withdraw_organizer_application()
  to authenticated;

create or replace function public.es_rate_ok(p_bucket text, p_max integer, p_window interval)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row    public.es_rate_limits;
  v_parts  text[] := string_to_array(coalesce(p_bucket, ''), ':');
  v_action text;
  v_caller text;
  v_max    integer;
  v_window interval;
begin
  -- The limiter is an internal authority, not a caller-configurable API.
  --
  -- CANONICAL BUCKET FORMAT (third review, issue A): the bucket must be
  -- EXACTLY '<action>:<auth.uid()>'. The complete format is validated — one
  -- colon, an explicitly allowed action, and a suffix that equals the
  -- caller's own id — so extra suffixes ('es_eval:<uid>:anything'), missing
  -- parts, empty strings and NULLs cannot mint unlimited new buckets, and a
  -- user can never consume another user's quota.
  if array_length(v_parts, 1) is distinct from 2 then
    raise exception 'Malformed rate-limit bucket';
  end if;
  v_action := v_parts[1];
  v_caller := v_parts[2];

  case v_action
    when 'es_org_apply'         then v_max := 3;   v_window := interval '1 hour';
    when 'es_event_create'      then v_max := 10;  v_window := interval '1 day';
    when 'es_team_create'       then v_max := 10;  v_window := interval '1 day';
    when 'es_team_invite'       then v_max := 30;  v_window := interval '1 hour';
    when 'es_register'          then v_max := 20;  v_window := interval '1 hour';
    when 'es_submission_create' then v_max := 20;  v_window := interval '1 day';
    when 'es_file_up'           then v_max := 60;  v_window := interval '1 hour';
    when 'es_eval'              then v_max := 200; v_window := interval '1 hour';
    else
      raise exception 'Unknown rate-limit action';
  end case;

  if p_max is distinct from v_max or p_window is distinct from v_window then
    raise exception 'Rate-limit parameters must match the fixed policy for this action';
  end if;
  if v_caller is distinct from auth.uid()::text then
    raise exception 'Rate-limit bucket must address the calling user';
  end if;

  -- 0015 counter logic, preserved verbatim (p_window/p_max are now validated
  -- constants, so the expiry condition can no longer be manipulated).
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

-- ============================================================================
-- FIX 9 — team-membership immutability (post-audit finding 4)
--
-- 0015's "members manage own membership" UPDATE policy lets a member change
-- their own row and the trigger validated capacity/registration but did not
-- pin the row's identity fields. A member could therefore move their
-- membership row into another team (team_id) or reassign it to a different
-- user (user_id) without ever receiving an invitation, and (combined with
-- the move) could even end up marked 'leader' of a team they already lead
-- elsewhere. Recreated with 0015's checks verbatim PLUS:
--   * team_id and user_id are immutable for EVERYONE (leader, organiser
--     included — membership rows belong to one team + one user for life);
--   * member_role and invited_by may only change by the team leader or an
--     event organiser (a member can still accept/decline/leave, i.e. change
--     status and responded_at);
--   * FIX 11: status transitions follow a fixed matrix — invited→active/
--     declined (invitee or leader), active→left (member or leader),
--     invited/active→removed and declined/left/removed→invited (leader or
--     organiser only). Removed/declined/left members cannot self-reactivate;
--     only a fresh invitation leads back to active. New rows must start as
--     'invited' or 'active'.
-- The 0015 trigger definition (es_team_members_validate) keeps firing this
-- function — no trigger recreation needed.
-- ============================================================================
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
  v_is_leader_or_manager boolean;
  v_is_self boolean;
begin
  select * into v_team from public.es_event_teams where id = coalesce(new.team_id, old.team_id);
  select * into v_event from public.es_events where id = v_team.event_id;

  if tg_op = 'INSERT' then
    -- Rows are born invited (leader invitation) or active — but an ACTIVE
    -- row may only be created by/for the user themselves (the team creator's
    -- own leader row, FIX 13). A leader adding ANOTHER registered participant
    -- must go through the invitation flow, so activation stays an
    -- opt-in by the invitee.
    if new.status not in ('invited', 'active') then
      raise exception 'A new membership row must start as invited or active';
    end if;
    if new.status = 'active' and new.user_id is distinct from auth.uid() then
      raise exception 'Members must be invited before they can be activated';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    -- Membership rows are bound to one team and one user for their whole
    -- life; moving them would bypass the invitation workflow entirely.
    if new.team_id is distinct from old.team_id then
      raise exception 'Membership cannot be moved between teams';
    end if;
    if new.user_id is distinct from old.user_id then
      raise exception 'Membership cannot be reassigned to a different user';
    end if;

    v_is_leader_or_manager := exists (
      select 1 from public.es_event_teams t
      where t.id = old.team_id
        and (t.leader_user_id = auth.uid() or public.es_can_manage_event(t.event_id))
    );
    if not v_is_leader_or_manager
       and (new.member_role <> old.member_role
            or new.invited_by is distinct from old.invited_by) then
      raise exception 'Only the team leader or an organiser can change membership role or invitation metadata';
    end if;

    -- FIX 11: status transitions are restricted by WHO performs them. A
    -- member may accept, decline or leave — but can never self-reactivate
    -- after being removed, after declining, or after leaving: only a fresh
    -- leader/organiser invitation can lead back to active.
    v_is_self := new.user_id = auth.uid();
    if new.status is distinct from old.status then
      case
        when old.status = 'invited'
             and new.status in ('active', 'declined')
             and (v_is_self or v_is_leader_or_manager) then null; -- accept / decline
        when old.status = 'active'
             and new.status = 'left'
             and (v_is_self or v_is_leader_or_manager) then null; -- leave
        when old.status in ('invited', 'active')
             and new.status = 'removed'
             and v_is_leader_or_manager then null;                -- remove / cancel invite
        when old.status in ('declined', 'left', 'removed')
             and new.status = 'invited'
             and v_is_leader_or_manager then null;                -- re-invite
        else
          raise exception 'Membership status change from % to % is not permitted',
            old.status, new.status;
      end case;
    end if;
  end if;

  -- ---- 0015 logic, preserved verbatim -------------------------------------
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

-- ============================================================================
-- FIX 13 — team creation was RLS-blocked (found during end-to-end review)
--
-- 0015 has exactly ONE insert policy on es_event_team_members
-- ("leader invites members", 0015:712) whose with-check requires
-- user_id <> auth.uid(). But the app's createTeam flow inserts the LEADER'S
-- OWN row (user_id = auth.uid(), member_role 'leader', status 'active') right
-- after creating the team — RLS rejects it, so team creation failed for every
-- user at runtime. This narrow policy lets the team creator add their own
-- leader row and nothing else: only their own user_id, only as 'leader' +
-- 'active', only with themselves as invited_by, only for a team they both
-- created and lead. All trigger checks (registration, capacity, leader-row
-- integrity) still apply.
-- ============================================================================
create policy "creator adds own leader row" on public.es_event_team_members
for insert to authenticated
with check (
  user_id = auth.uid()
  and member_role = 'leader'
  and status = 'active'
  and invited_by = auth.uid()
  and exists (
    select 1 from public.es_event_teams t
    where t.id = team_id
      and t.leader_user_id = auth.uid()
      and t.created_by = auth.uid()
  )
);

-- ============================================================================
-- End of 0016. Integration checks for this migration live in
-- supabase/tests/0016_eventspace_integrity_checks.sql (manual, non-production).
-- ============================================================================

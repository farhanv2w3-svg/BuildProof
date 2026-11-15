-- ============================================================================
-- 0008 — B2: TRANSACTIONAL TEAM-APPLICATION ACCEPTANCE
-- STATUS: DRAFT — NOT APPROVED / NOT EXECUTED against the live database.
--
-- ROOT CAUSE (audit B2): decideTeamApplication() only updated the application
-- row; accepting NEVER created a team_members row, so an "accepted" applicant
-- gained nothing and no UI existed to apply in the first place (applyToTeam
-- unused). This RPC makes acceptance atomic + complete:
--   decision + membership + notification in one transaction.
--
-- Safety properties:
--   * row-level lock (FOR UPDATE) prevents double-decision races;
--   * only team editors may decide (same predicate as the update policy);
--   * only applications still 'pending' can be decided;
--   * membership insert is idempotent via the unique (team_id, user_id)
--     constraint on team_members (proven row → accepted, never duplicated);
--   * applicant receives a notification;
--   * an audit row records who decided.
--
-- Rollback: drop function + revoke.
-- ============================================================================

create or replace function public.accept_team_application(application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.team_applications%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;

  select * into app from public.team_applications
  where id = application_id for update;

  if not found then
    raise exception 'Application not found';
  end if;
  if app.status <> 'pending' then
    raise exception 'Application is no longer pending';
  end if;
  if not public.can_edit_team_work(app.team_id) then
    raise exception 'Only team editors can decide applications';
  end if;

  update public.team_applications
    set status = 'accepted',
        decided_by = auth.uid()
  where id = app.id;

  -- The acceptance IS the membership (mirrors accept_team_invite semantics).
  insert into public.team_members (team_id, user_id, member_role, status)
  values (app.team_id, app.user_id, 'student', 'accepted')
  on conflict (team_id, user_id)
  do update set status = 'accepted';

  insert into public.notifications (user_id, type, title, link)
  values (
    app.user_id,
    'team_application_accepted',
    'Your team application was accepted',
    '/app/teams/' || app.team_id::text
  );

  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (
    auth.uid(),
    'team_application_accepted',
    'team_application',
    app.id,
    jsonb_build_object('team_id', app.team_id, 'applicant', app.user_id)
  );
end;
$$;

grant execute on function public.accept_team_application(uuid) to authenticated;

-- ============================================================================
-- BuildProof — platform admin bootstrap
-- ⚠ RUN ONCE, after YOUR OWN account exists (you must sign up in the app
--   first so a profile row is created). Do NOT run this for arbitrary users;
--   platform_admin is the highest-privilege role in BuildProof.
--
-- How to run:
--   1. Sign up at your deployed app (or Supabase Auth) with YOUR email.
--   2. Open Supabase Dashboard → SQL editor, paste this file.
--   3. Replace '<YOUR_EMAIL_HERE>' below with the exact email you signed up
--      with (lower-case), then run it.
--   4. Sign out and back in — the Admin page appears for platform admins.
--
-- This script requires nothing outside the normal schema: it works purely
-- through profiles/user_roles, which the SQL editor role may write.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Grant platform_admin to your account (exactly once).
-- ---------------------------------------------------------------------------
do $$
declare
  target uuid;
begin
  select id into target from auth.users where lower(email) = lower('<YOUR_EMAIL_HERE>');

  if target is null then
    raise exception 'No auth user found for <YOUR_EMAIL_HERE> — sign up first, then re-run.';
  end if;

  insert into public.profiles (id, full_name, email)
  values (target, coalesce(
    (select raw_user_meta_data ->> 'full_name' from auth.users where id = target),
    split_part(lower('<YOUR_EMAIL_HERE>'), '@', 1)),
    lower('<YOUR_EMAIL_HERE>'))
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (target, 'platform_admin')
  on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- (optional) Grant institution_admin for a whole institution. Uncomment and
-- fill in after you have created a real institution row (e.g. via the app or
-- the SQL editor as you).
--
-- do $$
-- declare
--   target uuid;
--   inst uuid;
-- begin
--   select id into target from auth.users where lower(email) = lower('<YOUR_EMAIL_HERE>');
--   select id into inst from public.institutions where lower(name) = lower('<INSTITUTION_NAME>');
--   if target is null or inst is null then
--     raise exception 'User or institution not found';
--   end if;
--   insert into public.user_roles (user_id, role, institution_id)
--   values (target, 'institution_admin', inst)
--   on conflict do nothing;
-- end;
-- $$;

-- Verify:
-- select r.role, r.institution_id, p.full_name, p.email
-- from public.user_roles r join public.profiles p on p.id = r.user_id
-- where r.role in ('platform_admin', 'institution_admin');

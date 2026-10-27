-- ============================================================================
-- BuildProof — demo seed data
-- ⚠ DEVELOPMENT / DEMO ENVIRONMENTS ONLY. Do NOT run this in production.
--
-- What this seeds (and deliberately does NOT seed):
--   * ONE clearly-labelled demo institution + demo cohort + 5 sample teams
--     (one of them a stopped project) and sample problems.
--   * Two published Proof Cards (Tier 2 and Tier 3) that show up on the
--     public /proof-cards page, one unpublished approved card, one draft.
--   * NO fake users, NO fake interviews, NO fake test participants.
--     Real people and real interviews are only ever created by real
--     authenticated users through the app. Every row says "(DEMO)".
--
-- This file is safe to run only AFTER 0001 and 0002. Rows use fixed UUIDs so
-- re-running with `on conflict do nothing` is harmless.
-- ============================================================================

-- --------------------------------------------------------------------------
-- institution + cohort (demo-labelled)
-- --------------------------------------------------------------------------
insert into public.institutions (id, name, city)
values (
  '11111111-1111-1111-1111-111111111111',
  'Riverbend Demo University (SAMPLE DATA)',
  'Springfield (DEMO)'
)
on conflict (id) do nothing;

insert into public.cohorts (id, institution_id, name, description, status, interview_gate)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Pilot Program A (DEMO)',
  'Sample cohort for exploring BuildProof. Teams, problems and Proof Cards '
    || 'below are illustrative demo content, not real projects.',
  'active',
  8
)
on conflict (id) do nothing;

-- --------------------------------------------------------------------------
--problems (demo, approved → visible in the authenticated problem pool)
-- --------------------------------------------------------------------------
insert into public.problems
  (id, title, description, category, affected_users, location, workaround, evidence_basis, status, is_public)
values
  ('aaaa0001-0000-0000-0000-000000000001',
   '[DEMO] Lab equipment booking is a paper notebook',
   'Sample problem used for demonstration: students at the demo university '
     || 'reserve shared lab equipment in a paper notebook at the front desk, '
     || 'leading to double bookings and wasted trips. Replace with a real, '
     || 'locally sourced problem when using BuildProof for real.',
   'education',
   'Lab students and technicians at the demo campus (sample)',
   'Demo campus, building C (sample)',
   'Students call the front desk to check availability before walking over.',
   'Illustrative only — in real use this field cites observation notes, '
     || 'photos or links gathered by the submitter.',
   'approved', false),
  ('aaaa0001-0000-0000-0000-000000000002',
   '[DEMO] Night-shift campus shuttle timetable is confusing',
   'Sample problem used for demonstration: after 8 pm the shuttle schedule '
     || 'is a laminated PDF that is often outdated, so students wait at stops '
     || 'for buses that already ran. Replace with a real problem in real use.',
   'public_services',
   'Students living off-campus (sample)',
   'Demo campus shuttle stops (sample)',
   'Students photograph the schedule each term and share it in group chats.',
   'Illustrative only.',
   'approved', false),
  ('aaaa0001-0000-0000-0000-000000000003',
   '[DEMO] Small food stalls track stock by memory',
   'Sample problem used for demonstration: two vendors at the demo market '
     || 'estimate stock from memory and run out mid-day, losing sales.',
   'local_business',
   'Market food-stall owners (sample)',
   'Demo city market (sample)',
   'Vendors write totals on the back of receipts.',
   'Illustrative only.',
   'approved', false),
  ('aaaa0001-0000-0000-0000-000000000004',
   '[DEMO] Recent-graduate alumni have no structured mentoring route',
   'Sample problem used for demonstration: graduates who want to mentor '
     || 'juniors have no organised channel, so mentoring happens ad-hoc.',
   'education',
   'Alumni and final-year students (sample)',
   'Demo university alumni office (sample)',
   'Alumni rely on personal contacts via professors.',
   'Illustrative only.',
   'approved', false),
  ('aaaa0001-0000-0000-0000-000000000005',
   '[DEMO] Campus repair requests disappear into email',
   'Sample problem used for demonstration: dorm repair requests sent by '
     || 'email have no status tracking; students re-send the same request.',
   'operations',
   'Dormitory residents (sample)',
   'Demo campus housing office (sample)',
   'Students email and then follow up in person at the office.',
   'Illustrative only.',
   'approved', false),
  ('aaaa0001-0000-0000-0000-000000000006',
   '[DEMO] Attending two timetabled events is trial and error',
   'Sample problem used for demonstration: elective sessions overlap and '
     || 'the timetable PDF does not show conflicts until registration closes.',
   'education',
   'Final-year students (sample)',
   'Demo university registrar (sample)',
   'Students build personal spreadsheets to detect clashes.',
   'Illustrative only.',
   'approved', false)
on conflict (id) do nothing;

-- --------------------------------------------------------------------------
-- 5 sample teams (one deliberately STOPPED — the "stopped project" story)
-- --------------------------------------------------------------------------
insert into public.teams (id, cohort_id, name, status, problem_id)
values
  ('bbbb0001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
   'Equipment Queue (sample)', 'active', 'aaaa0001-0000-0000-0000-000000000001'),
  ('bbbb0001-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
   'NightRoute (sample)', 'active', 'aaaa0001-0000-0000-0000-000000000002'),
  ('bbbb0001-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222',
   'StallStock (sample)', 'active', 'aaaa0001-0000-0000-0000-000000000003'),
  ('bbbb0001-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222',
   'MentorMatch (sample)', 'active', 'aaaa0001-0000-0000-0000-000000000004'),
  -- The stopped project: validation killed the idea, and that is a GOOD outcome.
  ('bbbb0001-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222',
   'RepairDesk (sample) — stopped after validation', 'stopped', 'aaaa0001-0000-0000-0000-000000000005')
on conflict (id) do nothing;

-- --------------------------------------------------------------------------
-- Proof Cards.
-- Tier meanings (mirrors the app copy):
--   1 = team-reported   2 = mentor-verified  3 = externally confirmed
-- Rows marked "published" appear on the public /proof-cards page.
-- tier_set_by / published_by are NULL because NO fake users exist; real
-- publication in-app would stamp a real admin id via the review guard.
-- --------------------------------------------------------------------------
insert into public.proof_cards
  (id, team_id, title, problem_title, problem_summary, validation_summary,
   feasibility_summary, built_summary, results_limitations, tier,
   review_status, visibility, published_at)
values
  -- Public, published, Tier 2 card
  ('cccc0001-0000-0000-0000-000000000001', 'bbbb0001-0000-0000-0000-000000000001',
   'Equipment Queue — booking clashes removed in pilot (DEMO)',
   '[DEMO] Lab equipment booking is a paper notebook',
   'Sample Proof Card content: paper notebook booking at the demo campus '
     || 'caused frequent double bookings.',
   'Sample summary: the team logged booking conflicts for two teaching '
     || 'weeks and interviewed approved scenarios captured in team sessions '
     || '(counts shown here are illustrative placeholders, not real data).',
   'Sample assessment: a shared queue fits existing campus Wi-Fi and '
     || 'one part-time technician.',
   'Sample build: a simple booking list was mocked for the pilot.',
   'Limitations (sample): figures are placeholders for demonstration only; '
     || 'no real participants were involved in this demo card.',
   2, 'published', 'public', now()),

  -- Public, published, Tier 3 card
  ('cccc0001-0000-0000-0000-000000000002', 'bbbb0001-0000-0000-0000-000000000002',
   'NightRoute — timetable availability confirmed on route (DEMO)',
   '[DEMO] Night-shift campus shuttle timetable is confusing',
   'Sample Proof Card content: the after-8 pm shuttle timetable is '
     || 'frequently outdated at the demo campus.',
   'Sample summary: riders reported checking and misreading the laminated '
     || 'schedule during observed weekday evenings (illustrative placeholder '
     || 'figures only).',
   'Sample assessment: a static web timetable is cheap to host and easy '
     || 'for the transport office to update.',
   'Sample build: a read-only timetable page was prototyped.',
   'Limitations (sample): all counts are placeholders; nothing was '
     || 'measured with real riders. Confirm against a real campus before use.',
   3, 'published', 'public', now()),

  -- Approved but NOT public (institution admin has not published it)
  ('cccc0001-0000-0000-0000-000000000003', 'bbbb0001-0000-0000-0000-000000000003',
   'StallStock — stock-out pattern documented (DEMO)',
   '[DEMO] Small food stalls track stock by memory',
   'Sample Proof Card content: memory-based stock tracking leads to '
     || 'mid-day run-outs at the demo market.',
   'Sample summary of validation sessions captured in team records '
     || '(placeholder figures).',
   null, null,
   'Limitations (sample): illustrative placeholders only.',
   1, 'approved', 'private', null),

  -- Draft card, team-private
  ('cccc0001-0000-0000-0000-000000000004', 'bbbb0001-0000-0000-0000-000000000004',
   'MentorMatch — draft card (DEMO)',
   '[DEMO] Recent-graduate alumni have no structured mentoring route',
   'Sample draft Proof Card content: mentoring currently happens via '
     || 'personal contacts only.',
   'Sample draft notes — not yet reviewed.',
   null, null, null,
   1, 'draft', 'private', null)
on conflict (id) do nothing;

insert into public.proof_card_skills (id, card_id, skill, evidence_summary)
values
  ('dddd0001-0000-0000-0000-000000000001', 'cccc0001-0000-0000-0000-000000000001',
   'Needs validation', 'Sample: booking conflicts were logged across two demo weeks.'),
  ('dddd0001-0000-0000-0000-000000000002', 'cccc0001-0000-0000-0000-000000000001',
   'Workflow mapping', 'Sample: mapped the booking queue from request to return.'),
  ('dddd0001-0000-0000-0000-000000000003', 'cccc0001-0000-0000-0000-000000000002',
   'Field observation', 'Sample: riders were observed checking the printed timetable (demo scenario).'),
  ('dddd0001-0000-0000-0000-000000000004', 'cccc0001-0000-0000-0000-000000000002',
   'Rapid prototyping', 'Sample: static timetable page built and walked through with the demo office.'),
  ('dddd0001-0000-0000-0000-000000000005', 'cccc0001-0000-0000-0000-000000000003',
   'Data collection', 'Sample: stock-out events recorded in team sessions (placeholder).')
on conflict (id) do nothing;

-- A stopped-project decision record tells reviewers the stop was deliberate.
insert into public.team_decisions (id, team_id, stage, decision, rationale, decided_by)
values
  ('eeee0001-0000-0000-0000-000000000001', 'bbbb0001-0000-0000-0000-000000000005',
   'validation', 'stop',
   'Sample decision record: the demo team stopped after validation because '
     || 'the problem pool was judged too narrow to justify a build. Stopping '
     || 'early is a legitimate outcome BuildProof records explicitly.',
   null)  -- decided_by NULL: no fake users
on conflict (id) do nothing;

-- NO interviews, NO user tests, NO notifications, NO roles beyond defaults:
-- real evidence of real people is only ever created by real users in-app.

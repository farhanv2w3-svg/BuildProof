# EventSpace — setup & operations guide

EventSpace is BuildProof's event module (hackathons, ideathons, exhibitions — registration,
teams, private submissions, judging, results, showcase, promotion kit). It uses dedicated
`es_*` tables so it never touches the older college-events module (`events` from migration 0004).

## 1. Database migration (required, not yet applied)

The complete schema lives in `supabase/migrations/0015_eventspace.sql`, followed by
`supabase/migrations/0016_eventspace_integrity_fixes.sql` (run order: 0001 … 0015, then 0016).
0015 creates:

- Helper functions (`es_is_approved_organizer`, `es_can_manage_event`, `es_is_participant`,
  `es_is_team_member`, `es_is_submission_owner`, `es_can_read_submission`,
  `es_is_assigned_judge`, `es_submission_window_open`, `es_rate_ok`, `es_review_organizer`,
  `es_resolve_invitee(event_id, email)`, `es_withdraw_organizer_application`,
  `es_is_assigned_judge_announcements`).
- Tables: `es_event_organizers`, `es_events`, `es_event_staff`, `es_event_rounds`,
  `es_event_teams` + `es_event_team_members`, `es_registrations`, `es_submissions` +
  immutable `es_submission_snapshots`, `es_submission_files`, `es_judge_assignments` +
  `es_evaluations`, `es_awards`, `es_results`, `es_announcements`, `es_showcases`.
- Public views `es_public_results` and `es_public_showcases` (security_invoker, granted to
  `anon` + `authenticated`). All public-facing pages must query these views only.
- Row-level security on every table, plus one storage bucket:
  - `es_submission_files` — **private**, path pattern `{submissionId}/{uuid}-filename`.
    Policies: uploads by submission owners, reads by owners/organisers/assigned judges,
    deletion by owners.
- An extension of the `content_reports.subject_type` CHECK to allow `es_event`,
  `es_submission`, `es_showcase`.

> **This migration is intentionally not applied.** Applying it changes the production
> database and requires explicit approval from the owner:
>
> ```
> supabase db push        # or apply 0015 through the dashboard SQL editor
> ```
>
> The migrations are *fail-loud* (they do not use `if not exists` for new policies) so a
> partial or repeated application stops with an error instead of silently diverging.

### 1a. What migration 0016 changes (not yet applied)

0016 is an additive integrity-fix migration. It does **not** rewrite 0015 and touches no
table structure or data. It contains thirteen fixes:

1. **Submission deadline authority.** `es_submission_window_open(event_id, is_resubmission)`
   now takes the submission context. Initial submissions always follow
   `submission_deadline` (previously, setting `resubmit_until` kept the initial window open
   indefinitely); only a `revision_requested` submission may resubmit inside
   `resubmit_until`. The submit trigger additionally rejects `resubmitted` transitions that
   did not originate from `revision_requested`. Note: saving a `revision_requested`
   submission back to `draft` drops its revision eligibility (by design).
2. **Public results.** `es_public_results` is recreated as a definer view (`security_barrier`)
   with a fixed WHERE (`published` + public event + `results_published`). Published results
   of public events are now readable by anonymous visitors. `es_results` itself stays
   organiser-only — no policy or grant was added to the base table, so organiser-only
   columns (`created_by`, …) cannot be reached directly.
3. **Announcement notifications.** New RPC
   `es_notify_event_audience(event_id, audience, title, body, link) -> int` (SECURITY
   DEFINER, fixed `search_path`). It verifies the caller's organiser permission for that
   exact event server-side, derives recipients from the event's registrations and judge
   assignments (no arbitrary recipient ids possible), de-duplicates, rate-limits 30/hour
   per event, and returns the number delivered. Execution is revoked from `anon`/`public`
   and granted to `authenticated`. The organiser UI now calls this RPC instead of the old
   client-side `notifyMany` loop, and surfaces errors instead of swallowing them. The
   0006 notification policies for other platform features are untouched.
4. **Final evaluation immutability.** New `es_evaluations_finality_guard` trigger: judges
   can edit drafts and submit finals, but a final evaluation can never be reopened or
   rewritten by a judge. Platform admins may correct one only while event results are
   unpublished, and every correction writes an `audit_logs` row
   (`es_evaluation_admin_correction`). The evaluations UPDATE policy was widened from
   judge-only to judge-or-platform-admin so the audited admin path is reachable; the
   trigger remains the authority.
5. **Team submission uniqueness.** Partial unique index `es_submissions_team_unique` on
   `(event_id, team_id) WHERE owner_type = 'team'` — one team submission per team per
   event regardless of which member creates it. Individual submissions keep the existing
   rule. If index creation fails on a live DB due to pre-existing duplicates, resolve them
   (keep the submitted/accepted row, delete extra drafts) and re-run only the
   `CREATE UNIQUE INDEX` statement.
6. **Organiser-registry RLS (post-audit).** 0015 created policies on `es_event_organizers`
   but never ran `ENABLE ROW LEVEL SECURITY`, so the policies were inert: with Supabase's
   default table grants, anyone could read every organiser application (official email,
   reason, verification notes) and write rows. RLS is enabled here.
7. **Function execute grants (post-audit).** `es_rate_ok` is invoked **directly** inside
   seven RLS policy expressions (organiser application, event creation, team creation,
   invitations, registration, file upload, evaluation) but was revoked from `PUBLIC` with
   no replacement grant — every one of those policies would fail at runtime. Same
   revoke-without-grant gap on `es_review_organizer` (admin RPC) and
   `es_withdraw_organizer_application` (organiser RPC). All three are granted to
   `authenticated`; they verify their own authority internally. (`es_resolve_invitee` was
   already granted by 0015.)
8. **Published-showcase join (post-audit).** `es_public_results` joins `es_showcases` only
   when `sh.status = 'published'`. Without it, a published result could expose the approved
   title/summary/links/image of a showcase the owner has not approved or the organiser has
   not published. Unpublished showcases contribute NULL project fields; the result row
   still appears (the UI falls back to "Winning project").
9. **Team-membership immutability (post-audit).** `es_validate_team_membership` is
   recreated: `team_id` and `user_id` are immutable for everyone (a member could
   previously move their membership row into another team without an invitation), and
   `member_role`/`invited_by` may only change by the team leader or an organiser. Members
   can still accept/decline/leave (change `status`). 0015's capacity/registration checks
   are preserved verbatim.
10. **Rate-limiter hardening (third review).** `es_rate_ok` honoured caller-supplied
    max/interval blindly — a negative interval reset the counter on every call (unlimited
    bypass) and an oversized maximum disabled the limit. The recreated function validates:
    the action must be one of the seven fixed policy actions, max/window must equal that
    action's exact fixed values, and the bucket must address the calling user. The
    `authenticated` grant stays (0015's policies call it in invoker context) but it is no
    longer abusable. The announcement RPC's per-event limiter moved to an internal
    `es_rate_ok_event()` (fixed 30/hour, no `authenticated` grant), so users cannot burn an
    event's announcement quota directly.
11. **Membership status transitions (third review).** Removed/left/declined members could
    previously reactivate themselves (removed → active passed registration + capacity
    checks). The trigger now enforces the transition matrix: `invited→active/declined`
    (invitee or leader), `active→left` (member or leader), `invited/active→removed` and
    `declined/left/removed→invited` (leader/organiser only). A member can accept, decline
    or leave but never self-reactivate; new rows must start as `invited` or `active`.
12. **`r.note` removed from the public view (third review).** The free-text organiser note
    (up to 1000 chars) had no established public use case, so `es_public_results` no longer
    selects it and the public row type dropped the field. It was never rendered by the UI.
13. **Team creation was RLS-blocked (end-to-end review).** The only member INSERT policy
    required `user_id <> auth.uid()`, but `createTeam` inserts the leader's own active row
    — team creation failed for every user. A narrow policy now lets the team creator add
    exactly their own leader row; the trigger additionally rejects `active` inserts for
    users other than the caller (leaders must invite others, activation stays opt-in).

Verification script: `supabase/tests/0016_eventspace_integrity_checks.sql` — a manual,
read-mostly fixture script for a **scratch** database (single transaction, rolls back) that
exercises all thirteen fixes including RLS row-visibility as `anon`, `authenticated`
(non-organiser, organiser) and platform admin. Run it after applying 0016 and after any
future change to these policies/triggers. TypeScript unit tests cannot verify RLS.

## 2. Storage buckets

| Bucket | Created by | Visibility | Notes |
| --- | --- | --- | --- |
| `event_posters` | migration 0004 (bucket + policies), 0010 refreshes MIME list | public | event covers/posters/logos, path `{createdBy}/{purpose}-{uuid}-name` |
| `es_submission_files` | migration 0015 (bucket + policies) | **private** | submission files, short-lived signed URLs (300 s) |

Check in the Supabase dashboard → Storage that both buckets exist after the migrations run;
create `event_posters` manually if it was removed earlier (the existing evidence flow already
relies on a similar public bucket pattern).

## 3. What needs external configuration (cannot be done in code)

- **Outbound email.** Registration confirmations and organiser-review outcomes are shown
  in-app; there is no SMTP/email provider configured in this project. If email copies of
  announcements are wanted, configure Supabase Auth SMTP or an edge function — none exists
  today and none was invented.
- **Social publishing is manual by design.** The promotion kit generates graphics, QR codes,
  captions and share deep links only. No account credentials are requested and nothing posts
  automatically.
- **`supabase db push`** needs the owner's explicit approval (see §1).

## 4. Known limitations (documented, honest)

- **Announcement fan-out is now server-side** via `es_notify_event_audience` (0016); the
  old client-side `notifyMany` loop remains in the codebase for other callers but is no
  longer used for event announcements. Rate limit: 30 notification sends per event per
  hour.
- **QR/graphics are generated offline** (SVG string templates + the `qrcode` npm package,
  MIT licence, no network calls). PNG export uses an in-browser canvas rasterisation.
- **No parental-consent flow.** Events involving minors must state their own consent handling
  in the event rules; see the legal notes below.
- **Certificates are never auto-promised.** Award rows can carry `certificate_text`, but
  nothing generates or emails certificates.
- **Judge anonymity** is an organiser toggle (`anonymous_judging`); participants never see
  judge private notes either way.

## 5. Legal review points (needs a human, not code)

1. **Children / minors.** The platform is not directed at children; DPDP Act (India) treats
   under-18s differently and requires verifiable parental consent for processing. The
   eligibility UI lets organisers *describe* age expectations only. Before public launch,
   either restrict events to adults or add a real consent flow (not built).
2. **Originality / IP terms.** Organisers can paste custom originality, IP and
   disqualification terms. These are organiser-authored; a lawyer should review the default
   suggestions and the platform's role (venue vs co-organiser).
3. **Prizes and certificates.** No prize money flows through BuildProof and no certificates
   are issued by the platform; both need legal wording if that ever changes.
4. **Data retention for minors' data, showcase images, and judge notes** — the privacy policy
   draft (PrivacyPage) describes current behaviour honestly; get it reviewed before launch.

## 6. Local verification (what was tested)

- `npm run typecheck` — clean.
- `npm run lint` — 0 errors.
- `npm run test` — 193 tests pass, including 41 new EventSpace rule tests
  (`src/lib/eventspaceRules.test.ts`).
- `npm run build` — succeeds (pre-existing >700 kB chunk-size warning remains).
- Browser smoke test (anon, dev server): `/eventspace` renders the hero, filters and error
  banner gracefully (`Could not find the table 'public.es_events' in the schema cache` — the
  expected message while 0015 is unapplied); `/eventspace/organizer`, `/eventspace/:slug` and
  `/eventspace/:slug/showcase` all render their empty/sign-in states without crashing.
- Functional testing against the real database was **not** possible because migration 0015
  is deliberately unapplied and app-interior pages need authentication. RLS policies were
  reviewed by hand against the SQL, not executed.

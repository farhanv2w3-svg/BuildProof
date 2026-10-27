# Architecture

BuildProof is a single-page application (Vite + React + TypeScript) that talks
directly to Supabase (PostgreSQL + Auth + Storage) using the anon key. There
is no custom server: **the database is the API**, and Row Level Security (RLS)
is the enforcement layer.

```
┌────────────────────────────┐
│  Browser (SPA on CF Pages) │
│  React 19 + React Router   │
└────────────┬───────────────┘
             │  @supabase/supabase-js (anon key, JWT per user)
             ▼
┌────────────────────────────┐
│  Supabase                  │
│  ├─ Auth (email)           │  trigger: profile + first role on signup
│  ├─ Postgres + RLS         │  every table policy-enforced
│  ├─ RPCs (definer-scoped)  │  find_user_id_by_email, accept_team_invite
│  └─ Storage (private)      │  evidence bucket, signed URLs only
└────────────────────────────┘
```

## Frontend

| Layer | File(s) | Responsibility |
|---|---|---|
| Design system | `src/styles/global.css` | Tailwind v4 theme: deep-teal brand palette, amber accent, Manrope/Inter |
| Router | `src/App.tsx` | 15 public pages + 11 `/app` pages, guarded by role |
| App shell | `src/components/AppLayout.tsx` | Role-aware sidebar, notifications bell, mobile drawer |
| Auth state | `src/lib/auth.tsx` | `AuthProvider` — session, profile, roles; listeners |
| Guards | `src/features/auth/guards.tsx` | Route-level access control + `/app/access-denied` |
| Data access | `src/lib/api.ts` | **Single** module through which all Supabase reads/writes/uploads flow |
| Validation | `src/lib/validation.ts` | Zod schemas; single source of truth for form rules |
| RBAC helpers | `src/lib/rbac.ts` | Pure role/logic helpers shared by UI and unit tests |
| Types | `src/types/database.ts` | Row models mirroring the SQL schema |

Principles:

- **One door for data.** Components never call `supabase.from()` directly;
  they import from `api.ts`. Auditing and hardening has one choke point.
- **Fail honestly.** Without `VITE_SUPABASE_URL/ANON_KEY` the app renders a
  "Backend not configured" notice instead of mock data.
- **Validate at the edge.** Forms parse through zod before touching the API;
  the database re-checks what it must.

## Database (0001_init_schema.sql)

**Core entity graph:**

```
institutions ─< cohorts ─< cohort_members
                 │  └─< gates
                 └─< teams ─┬─< team_members
                            ├─< team_invites (email, token)
                            ├─< interviews
                            ├─< evidence_attachments …> storage "evidence"
                            ├─< feasibility_reviews
                            ├─< prototype_tests ─< user_tests
                            ├─< team_decisions
                            ├─< comments
                            ├─< mentor_assignments
                            └─< proof_cards ─< proof_card_skills
problems ─< problem_screenings        problems ─< teams.problem_id
auth.users ─ profiles, user_roles, notifications, audit_logs
```

**Roles live in `user_roles`**, keyed `(user_id, role, institution_id?)`.
Self-service signup can only ever produce `student` or `problem_owner` — the
`handle_new_user` trigger clamps `raw_user_meta_data.role` to that allowlist,
so a malicious signup payload cannot mint an admin.

**Security-definer helpers** (all `stable`, read-only over own tables) keep
policies readable and safe to compose:

`is_platform_admin()`, `has_any_role(text[])`, `is_institution_admin(uuid)`,
`is_cohort_staff(uuid)`, `is_cohort_member(uuid)`, `is_team_member(uuid)`,
`can_read_team(uuid)`, `can_edit_team_work(uuid)`, `can_review_team_work(uuid)`,
`submitted_by_check(cohort_id, created_by)` (teams insert guard).

**Who can read a team** (`can_read_team`) members of it, other members of its
cohort, cohort staff, active assigned mentors, the problem's owner, and
platform admins.

**The 8-stage workflow** is encoded as tables + statuses, not middleware:

1. Problem submitted (any authenticated user) → screening by admins
   (`submitted / screening / approved / rejected / needs_info`).
2. Cohorts & teams formed (cohort-gated; teams insert guarded by
   `submitted_by_check`).
3. Consented interviews recorded (`consent` is a hard CHECK on insert).
4. Validation decision recorded (`team_decisions`; includes explicit `stop`).
5. Feasibility report written and reviewed (`feasibility_reviews`).
6. Prototype plan + user tests recorded (`prototype_tests`, `user_tests`).
7. Proof Card drafted with skill tags.
8. Review ladder: `draft → submitted → changes_requested / approved /
   rejected → (admin publishes) published` with tiers
   1 = team-reported, 2 = mentor-verified, 3 = externally confirmed.

**Proof-card guard trigger** (`proof_card_review_guard`) enforces, at the
database level, what the UI allows:

- Non-editors (e.g. mentors) may change only review metadata, never content.
- Making a card public requires admin or the owning institution's admin **and**
  an approved/published review state; publication stamps `published_at/by`;
  un-publishing retracts it.
- Tier changes require review rights; Tier 3 must record `tier_set_by`.

**RPCs** (security definer, least-privilege):

- `find_user_id_by_email(email) → uuid` — lets staff add members/grant roles
  without exposing `auth.users`.
- `accept_team_invite(token) → team_id` — validates a pending invite, marks it
  accepted, creates the membership, notifies the inviter.

## Storage (0002_storage_policies.sql)

One **private** bucket `evidence`; objects are `{teamId}/{uuid}-{file}`. Every
storage policy re-derives the team id from `(storage.foldername(name))[1]` and
re-checks team membership — a crafted path cannot reach another team's folder.
Downloads happen exclusively through 300-second signed URLs created for
authorised users; there are no public objects.

## CI & deployment

`.github/workflows/ci.yml` runs typecheck, lint, unit tests and the production
build on every push/PR. Cloudflare Pages deploys from `main` (see
`docs/deployment.md`); `public/_redirects` provides the SPA fallback.

## Known limitations

- No server-side rate limiting on notification/audit writes beyond role
  checks (mitigated: only reporter-level roles may write them).
- Proof-card "Tier 3" depends on an honest human confirmation recorded in-app;
  the schema stores *who* confirmed, but external verification is procedural.
- Metrics/pages analytics are not yet wired (responsibility of the deployer).

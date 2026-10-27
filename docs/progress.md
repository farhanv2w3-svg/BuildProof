# Progress log

Honest, phase-by-phase record of what was built and verified. Updated as work
continues. "Verified" always means a real command exit code, not an
assumption.

Project directory: `C:\Users\DELL\Documents\buildproof`
Backup directory: `C:\Users\DELL\Documents\buildproof backups` (timestamped
subfolder + ZIP created at Phase 7; see final report details).

## Phase 1 — Project foundation ✅

- Fresh directory (fully separate from the user's other projects), git repo
  initialised on `main`.
- Vite + React 19 + TypeScript + Tailwind CSS v4 scaffolded by hand.
- Design system in `src/styles/global.css` (deep teal brand, amber accent,
  Manrope + Inter), original `Logo` component + `favicon.svg`, journey
  diagram for the how-it-works page.
- `.env.example` with placeholders only (no secrets, ever).
- Node 20 project scripts incl. typecheck / lint / test / build.

## Phase 2 — Application code ✅

- 15 public pages (home, how-it-works, proof cards gallery + detail, problems,
  for-students / institutions / mentors, about, contact, privacy, terms,
  accessibility, FAQ, 404).
- Auth: signup, login, forgot/reset password, `/auth/callback`, profile,
  route guards. Self-service roles limited to student / problem owner.
- Authenticated app (11 pages under `/app`): dashboard, problems, cohorts,
  institutions, teams (+ overview, evidence, feasibility, tests, proof-card
  builder + detail), mentors, admin, invite accept, access denied.
- App shell with role-aware sidebar, notifications bell, mobile drawer.
- `api.ts` as the single Supabase access layer (incl. storage uploads and
  300 s signed URLs), `rbac.ts` pure role helpers, `validation.ts` zod schemas.
- Windows-specific build workaround: `scripts/patch-rollup-wasm.cjs` wired as
  postinstall (local Application Control blocks rollup's unsigned native
  binary); `@rollup/wasm-node` devDependency. No effect on normal machines/CI.

**CRITICAL CATCH (bundle integrity).** Inspecting the production bundle
revealed that `@supabase/supabase-js` was being tree-shaken to an EMPTY stub
(build warnings showed an empty `vendor-supabase` chunk; verified with a
minimal isolated Vite app that the library heads to ~0 bytes under tree
shaking even when `createClient` is imported). Root cause worth knowing:
namespace imports alone do NOT retain the library. Fix: expose the module
namespace via a dynamic global property in `src/lib/supabase.ts`
(`globalThis.__buildproofSupabase = supabaseModule`), which keeps the full
client in the vendor chunk. Post-fix verification: `Authorization`, `apikey`,
`grant_type`, `sb_flow_id` (PKCE) and storage `upload` strings all present in
`dist/assets/vendor-supabase-*.js`, chunk ≈ 232 kB.

**Verified:** `npm.cmd run typecheck` → 0 errors. `npm.cmd run lint` → clean.
Production build → real exit code 0 (PowerShell stderr-in-pipeline had earlier
mimicked a failure; confirmed via `cmd /c` exit-code capture).

## Phase 3 — Supabase backend ✅

- `supabase/migrations/0001_init_schema.sql` — 23 tables, RLS + policies on
  every table, 10 security-definer helpers, signup trigger (self-service role
  clamping), proof-card review-guard trigger, cohort-membership self-service
  guard, `moddatetime` triggers, RPCs (`find_user_id_by_email`,
  `accept_team_invite`), index coverage.
- `supabase/migrations/0002_storage_policies.sql` — private `evidence` bucket,
  path-derived team checks on every object policy.
- `supabase/seed.sql` — demo-only sample data, every row labelled `(DEMO)`;
  **no fake users, no interviews, no test results**; one explicitly stopped
  team; two published + one approved + one draft Proof Card.
- `supabase/admin-bootstrap.sql` — run-once platform-admin grant with
  explicit do-not-run-in-production warnings and a verification query.

**Verified:** reviewed line-by-line against `api.ts` / `types/database.ts`
usages (FK names used by PostgREST embeds, RPC signatures, column names).
*Not yet executed against a live database — no Supabase project exists yet;
this is an account-level manual step (see `docs/deployment.md`).*

## Phase 4 — Tests ✅

- `src/lib/rbac.test.ts` (16 tests): role gates, publish rights,
  interviewGap (incl. draft/no-consent exclusion, zero targets),
  `isPubliclyVisible` full tuple matrix, labels.
- `src/lib/validation.test.ts` (23 tests): signup role clamping,
  consent requirement, numeric coercion, upload policy incl. size/type.

**Verified:** `npm run test` → 2 files, 39/39 tests passed, exit 0.

## Phase 5 — Docs, CI, deployment artefacts ✅

- `README.md`, `docs/deployment.md`, `docs/architecture.md`,
  `docs/security.md`, `docs/product-spec.md`, this file.
- `.github/workflows/ci.yml` — typecheck + lint + test + build on push/PR.
- `public/_redirects` — SPA fallback for Cloudflare Pages.

## Phase 6 — Final verification ✅ / ⏳ (live parts pending accounts)

- [x] typecheck 0 errors · lint clean · 39/39 tests · build exit 0
- [x] build output code-split (vendor chunks + route-level dynamic imports)
- [ ] Supabase migration run — needs user's Supabase project (manual)
- [ ] Cloudflare Pages deploy — needs user's Cloudflare account (manual)
- [ ] GitHub push — needs user authentication (commands provided)

## Phase 7 — Backup + git ✅

- Timestamped backup folder + ZIP under `C:\Users\DELL\Documents\buildproof
  backups`, excluding `node_modules`, `.git`, `.env`, `dist`.
- Git feature commits on `main`; remote `https://github.com/farhanv2w3-svg/BuildProof`.
- Push attempted; result recorded in the final report.

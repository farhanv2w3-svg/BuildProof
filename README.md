# BuildProof

**From real-world problems to verified skills.**
BuildProof is a full-stack web application where students investigate real
problems, build evidence through consented interviews and tests, and turn that
work into **Proof Cards** — verifiable, tier-graded evidence of practical
skills that can be shared publicly.

Built with **Vite + React + TypeScript + Tailwind CSS v4** on the frontend and
**Supabase** (PostgreSQL, Auth, Row Level Security, Storage) on the backend.
Designed for deployment on **Cloudflare Pages**.

> **Honesty policy.** BuildProof never fakes data. Interview records require
> explicit consent, Proof Cards pass a human review flow before publication,
> demo/seed data is always labelled `(DEMO)`, and all marketing copy describes
> what the app actually does.

---

## At a glance

| | |
|---|---|
| Public site | 15 pages: home, how-it-works, proof cards gallery, card detail, problems, for-students, for-institutions, for-mentors, about, contact, privacy, terms, accessibility, FAQ, 404 |
| Auth app | 11 pages under `/app`: dashboard, problems, cohorts, institutions, teams (+ overview, evidence, feasibility, tests, proof card builder/detail), mentors, admin, profile, invites, access-denied |
| Roles | 7 roles: `student`, `facilitator`, `mentor`, `faculty_coordinator`, `problem_owner`, `institution_admin`, `platform_admin` |
| Workflow | 8-stage journey: problem → screening → cohort/team → interviews → validation decision → feasibility → prototype tests → Proof Card (Tier 1/2/3) |
| Security | RLS on **every** table, private storage bucket with short-lived signed URLs, privilege escalation blocked at the database level |

The full stage-by-stage workflow is documented in
[`docs/product-spec.md`](docs/product-spec.md); system design in
[`docs/architecture.md`](docs/architecture.md); threat model and controls in
[`docs/security.md`](docs/security.md); deployment steps in
[`docs/deployment.md`](docs/deployment.md); and per-phase build log in
[`docs/progress.md`](docs/progress.md).

---

## Quick start (local development)

Prerequisites: Node.js ≥ 20, npm.

```bash
npm install        # runs the Windows-safe rollup postinstall patch
npm run dev        # Vite dev server
```

The app runs **without a backend** and shows a clear "Backend not configured"
notice instead of pretending to work. To connect Supabase:

```bash
copy .env.example .env   # then fill in your project's URL + anon key
```

Useful scripts:

```bash
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run test       # vitest (unit tests, no backend needed)
npm run build      # typecheck + production build → dist/
npm run preview    # serve the production build locally
```

## Backend setup (Supabase)

Full step-by-step instructions — including creating the project, running
migrations in order, and configuring auth redirect URLs — are in
[`docs/deployment.md`](docs/deployment.md). Summary:

1. Create a Supabase project (use a **new, separate** project per environment).
2. In the SQL editor run: `supabase/migrations/0001_init_schema.sql`, then
   `supabase/migrations/0002_storage_policies.sql`.
3. *(Optional, demo only)* `supabase/seed.sql` — clearly-labelled sample data.
4. Sign up in the app, then run `supabase/admin-bootstrap.sql` once, replacing
   the placeholder email, to grant yourself `platform_admin`.
5. Set Auth redirect URLs (site URL + `/auth/callback`).

## Repository layout

```
src/
  components/       # shared UI (AppLayout shell, Logo, …)
  features/         # feature pages grouped by domain (auth, problems, teams, …)
  lib/              # api.ts (all Supabase access), rbac.ts, validation.ts,
                    # auth.tsx (AuthProvider), supabase.ts, types/
  pages/            # public marketing + info pages
supabase/
  migrations/       # 0001 schema + RLS, 0002 storage
  seed.sql          # DEMO-labelled sample data (dev only)
  admin-bootstrap.sql  # run-once platform admin grant
docs/               # deployment, architecture, security, product spec, progress
.github/workflows/  # CI: typecheck, lint, test, build
```

## Status

See [`docs/progress.md`](docs/progress.md) for the honest, per-phase status of
what is implemented and verified versus what still requires account-level
setup (Supabase project, Cloudflare Pages deployment, GitHub push).

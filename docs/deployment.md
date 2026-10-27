# Deployment guide

This walks through taking BuildProof from repository to a live, working
deployment on **Cloudflare Pages** with a **Supabase** backend.

> Paper-trail note: every numbered step that touches an external service is a
> *manual action you perform once*; commands are run from the repo root.

---

## 1. Prerequisites

- Node.js ≥ 20 and npm (Windows users: run npm through `npm.cmd` / `cmd /c`;
  some local policies block `npm.ps1`).
- A Supabase account (<https://supabase.com>).
- A Cloudflare account (<https://dash.cloudflare.com>).
- The GitHub repository: <https://github.com/farhanv2w3-svg/BuildProof>.

## 2. Create a dedicated Supabase project

1. Dashboard → **New project**. Pick a region near your users and a strong
   database password (store it in a password manager).
2. Use a **fresh, separate project** for BuildProof. Do not reuse a project
   that other applications depend on — the migrations below take ownership of
   the schema, storage buckets and auth triggers.

## 3. Run the migrations (in order)

Supabase Dashboard → **SQL editor** → paste each file and **Run**:

| Order | File | Read-only? | What it does |
|---|---|---|---|
| 0 | `supabase/preflight_inspect.sql` | ✅ yes | Inspects the current DB state (existing objects, event triggers, extensions, storage) **before** touching anything. Confirms the failed runs really left `public` empty. |
| 1 | `supabase/migrations/0001_init_schema.sql` | no | All tables, RLS policies on every table, helper/security functions, signup trigger, review-guard triggers, RPCs |
| — | `supabase/verify_migrations.sql` (Section A) | ✅ yes | Confirms 0001 landed completely (23 tables, 64 policies, 15 functions, signup trigger) |
| 2 | `supabase/migrations/0002_storage_policies.sql` | no | Creates the **private** `evidence` storage bucket + object policies |
| — | `supabase/verify_migrations.sql` (Section B) | ✅ yes | Confirms 0002 landed (bucket + 4 object policies) |

If a step errors, stop and re-check the previous step before retrying; both
migration files are written to be run top-to-bottom once (the storage file is
idempotent). Do **not** re-run 0001 after it has partially or fully succeeded —
re-run the preflight instead and compare against the expected results.

## 4. Configure authentication URLs

Supabase Dashboard → **Authentication → URL Configuration**:

- **Site URL**: your final production URL (e.g. `https://buildproof.pages.dev`),
  or `http://localhost:5173` while developing locally.
- **Redirect URLs** — add all of these:
  - `http://localhost:5173/**` (local dev)
  - `https://YOUR-PROJECT.pages.dev/**` (Cloudflare Pages preview + production)

The app's email-confirmation and password-reset links route through
`/auth/callback`, which lives in the SPA.

## 5. (Optional, demo environments only) Seed sample data

Run `supabase/seed.sql` in the SQL editor. It inserts clearly **`(DEMO)`
labelled** institutions, cohorts, teams, problems and two published Proof
Cards — and **no fake users, interviews or test results**. Skip this for
production.

## 6. Deploy to Cloudflare Pages

1. Dashboard → **Workers & Pages → Create → Pages → Connect to Git**, select
   the BuildProof repository.
2. Build settings:
   - Framework preset: **Vite** (or manual):
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Node version: 20 (Environment variable `NODE_VERSION=20`)
3. Environment variables (Production **and** Preview):
   - `VITE_SUPABASE_URL` = Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = Supabase anon/publishable key
   - `VITE_APP_ENV` = `production`
4. Add the SPA fallback so deep links like `/app/teams/…` work on refresh:
   the repo already contains `public/_redirects` (`/*  /index.html  200`)
   which Vite copies into `dist/`.
5. Deploy. Note your production URL(s).

## 7. Point Supabase Auth at the deployed site

After the first Pages deploy, update **Authentication → URL Configuration**:

- Site URL → the production Cloudflare URL.
- Add `https://YOUR-PROD-DOMAIN/**` under Redirect URLs (already done in step 4
  if you used the `*.pages.dev` placeholder after deploy).

## 8. Make yourself the platform admin

1. Open the deployed site and **sign up with your real email**
   (self-service roles: student or problem owner only).
2. Supabase SQL editor → paste `supabase/admin-bootstrap.sql`, replace
   `<YOUR_EMAIL_HERE>` with that exact email, run it once.
3. Sign out and back in — the **Admin** page appears for platform admins.
   From there you can grant every other privileged role to real users. No
   other path grants privileged roles — not the signup form, not user
   metadata, not the API.

## 9. Post-deploy verification checklist

Run through this once per environment:

- [ ] Sign-up with a test account works; confirmation email arrives (if email
      confirmation is enabled) and `/auth/callback` completes cleanly.
- [ ] Logged-out visitor sees published Proof Cards, no drafts, no team data.
- [ ] Logged-in student can create a team and record a consented interview.
- [ ] Privileged roles are absent until granted by the platform admin.
- [ ] A refresh on `/app` (deep link; the dashboard is the index route) does not 404.
- [ ] Uploading evidence attaches to the team and previews via signed URL.
- [ ] A student attempting to self-publish a Proof Card is blocked (DB guard).

## Environment variables

Only these three are read by the app (see `.env.example`):

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (public by design; RLS is the real boundary) |
| `VITE_APP_ENV` | `development` / `production` (banner + behaviour switches) |

**Never** put the service-role key or database password into any `VITE_*`
variable — anything prefixed `VITE_` ships to the browser.

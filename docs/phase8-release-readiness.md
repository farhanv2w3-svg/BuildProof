# Phase 8 release-readiness audit

## Status summary

| Area | Status | Evidence |
|---|---|---|
| Accessible destructive confirmations | VERIFIED FIXED | Three native `window.confirm()` call sites were replaced by `ConfirmDialog` in `src/components/ui.tsx:40`; source scans assert none remain. |
| Two-party transfer consent | VERIFIED FIXED | `TeamSolutionsPage.tsx` records creator and proposer consent independently. Migration `0007` blocks `agreed`/`executed` until both flags are true and restricts trigger execution. |
| Migration 0005 least privilege | NEEDS LIVE ENVIRONMENT VERIFICATION | Draft passes source-lock tests; actual grants and RLS must be checked against Supabase without modifying it. |
| Migration 0006 policy repairs | NEEDS LIVE ENVIRONMENT VERIFICATION | Draft source tests cover S1, S2, S8, D1 and D2; policy effects require a live/staging database. |
| Migration 0007 consent and payments | NEEDS LIVE ENVIRONMENT VERIFICATION | Draft source tests pass. Trigger behavior requires migration execution in an isolated/staging database first. |
| Migration 0008 team application acceptance | NEEDS LIVE ENVIRONMENT VERIFICATION | RPC source tests pass; transactional behavior requires a staging database. |
| Browser/E2E workflows | BLOCKED | No Playwright/Cypress/browser-test dependency exists; no dependency was installed. |
| Monitored support inbox | NOT FIXED | `ApplyPage.tsx`, `LegalShell.tsx`, and `PrivacyPage.tsx` explicitly describe the contact address as a placeholder/unmonitored inbox. |

## Repair-register verification

### A1-A14

A12 notification focus/refetch and A13 profile refresh are covered by passing source tests in `src/lib/repairRegister.test.ts`. A5 public Problems queries are guarded while signed out. Remaining A-items are implementation scans, not runtime database proof; items changed by the local OpenCode handover are preserved unless a conflicting direct check found otherwise.

### B1-B15

B1 team name limits, B6/B7 mounted proof-card/comment UI, B14 Proof Card attachment and B2 transactional team application acceptance have passing local tests. B9 pitch limits, B7 comment limits and team-flow code are present in the application. The remaining B-items require live authentication/RLS/browser verification.

### S1-S8

S1, S2, S8 and D1/D2 have draft migration/source evidence. S3 independent consent and dual-party status guarding are implemented locally. S4 notification recipient scoping, S5 team-editor scope, S6 duplicate application protection and S7 payment integrity are draft migrations awaiting database verification. Migration review is not live execution.

### D1-D2

D1 proof-contribution deletion policy and D2 cohort-staff mentor assignment revocation are draft migration clauses covered by passing tests.

## Local quality results

- TypeScript: passed (`npm run typecheck`).
- ESLint: passed (`npm run lint`).
- Unit/integration tests: 139 passed (`npm run test`).
- Production build: passed (`npm run build`).
- Browser automation: unavailable without an existing browser-test dependency.

## Release configuration

Required environment names (values intentionally omitted):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_ENV` when used by the deployment environment

Supabase dashboard steps:

- Apply migrations only in an approved sequence from `0005` through `0008`, after backups and staging verification.
- Review email confirmation, password reset redirect URLs, Site URL and allowed redirect URLs.
- Verify the storage buckets and upload policies used by events, evidence and Proof Cards.
- Verify that anonymous role has no grant on `public.problems` and no broad SELECT/WRITE matrix changes beyond the draft grants.

Cloudflare Pages:

- Build command: `npm run build`
- Output directory: `dist`
- SPA routing: `_redirects` contains the required fallback
- Configure the public environment variable names above in the Pages environment

## Draft migrations awaiting approval

All are local drafts and have not been executed:

- `supabase/migrations/0005_grants_fix.sql`
- `supabase/migrations/0006_security_policies.sql`
- `supabase/migrations/0007_consent_and_payments.sql`
- `supabase/migrations/0008_accept_team_application.sql`

## Manual release gates

1. Replace the placeholder support address or explicitly defer private onboarding flows until the inbox is monitored.
2. Test authenticated workflows against staging Supabase, including RLS denial cases and each RPC.
3. Confirm two-party agreement consent with both real users and verify that users cannot create the other party's consent.
4. Complete responsive browser checks at mobile and desktop sizes.
5. Configure Supabase Auth redirect allowlists and storage policies.
6. Review and approve migration 0005-0008 before any production execution.
7. Obtain explicit approval before commit, push, deploy, Supabase dashboard changes or live SQL.

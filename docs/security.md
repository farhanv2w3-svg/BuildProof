# Security model

BuildProof stores student work, interview evidence and personal identity
data, so the security posture is designed around **enforcement at the
database**, not in the browser.

## Threat model (what we defend against)

| Threat | Consequence | Defence |
|---|---|---|
| Privilege escalation via signup | Attacker self-grants `platform_admin` | Signup trigger clamps `raw_user_meta_data.role` to `student`/`problem_owner`; only platform admins can write `user_roles` (RLS + CHECK constraint) |
| Forged client calls | Student "publishes" a Proof Card, approves own work | `proof_card_review_guard` trigger + RLS policies; the browser is treated as untrusted everywhere |
| Team data leakage | Cards, interviews, evidence visible to outsiders | `can_read_team()` gates every team-attached table; public pages see only `visibility='public' AND review_status IN ('approved','published')` |
| Evidence hot-linking / scraping | Private files exposed | Private bucket; every storage policy re-derives the team id from the object path; 300-second signed URLs only |
| Cross-team object access | Attacker uploads/deletes into another team's folder | `(storage.foldername(name))[1]::uuid` is re-checked on insert/select/update/delete |
| Invited-but-unauthorised members | Arbitrary users join any team | `team_members` insert: self-add only when you are a member of the team's cohort; staff can add anyone; email invites go through the definer RPC `accept_team_invite` |
| Notification/audit spam | Students spoof system messages | Insert rights limited to reporter-level roles via `has_any_role()` |
| PII over-exposure | Users read others' emails | `profiles` read requires authentication; `find_user_id_by_email` returns only a uuid, never profile fields; `auth.users` is never exposed to clients |
| Key leakage | Service-role key in bundle | Only anon key in `VITE_*`; service-role key never enters frontend code or env |
| Unattended data on deletion | Orphaned rows | Cascading FKs from `auth.users` → profiles → roles/notifications; teams cascade to all evidence |

## Enforcement layers (in order)

1. **Postgres CHECK constraints** — status vocabularies, string lengths, size
   caps (10 MB evidence), interview `consent` hard-required on insert.
2. **RLS policies** — enabled on *every* application table; helpers above are
   `security definer` + `stable` and read only BuildProof's own tables.
3. **Guard triggers**
   - `proof_card_review_guard` — review ladder, tiers, publication rules.
   - `enforce_self_member_status_only` — members can't self-promote to
     facilitator inside a cohort.
   - `moddatetime` triggers — `updated_at` integrity.
4. **Signup trigger** — profile + first role, self-service roles only.
5. **Application layer** — zod schemas (mirrors DB rules), single API module,
   role-aware routing so users don't see screens they can't use.
6. **Storage policies** — see above.

The layers are independent: compromising the React app does not bypass 2–4.

## Secrets & credentials

- `.env.example` documents the only three variables the app reads; real
  values live in `.env` (**git-ignored, never committed, excluded from
  backups**) and in Cloudflare Pages env settings.
- The anon key is *designed* to be public; RLS is the actual boundary.
- Database password and service-role key exist only in the Supabase
  dashboard and the owner's password manager.

## Privacy & consent

- Interviews require explicit `consent = true` at insert; form copy states
  only consented adult interviews may be recorded. Participants are stored as
  anonymised labels (`Participant A`), not identities.
- Profile data is viewable only by authenticated users; no public directory.
- Audit logs capture admin/reviewer actions for accountability; readable by
  platform admins only.
- Demo/seed data is labelled `(DEMO)` end to end and contains no personal
  information, no fake users, no fabricated interview outcomes.

## Reporting a vulnerability

Please open a GitHub issue marked *security* or contact the repository owner
 directly; avoid posting exploit details publicly until triage.

## Known residual risks (honest list)

- Email confirmation/enforcement strength depends on Supabase Auth
  configuration (see `docs/deployment.md` step 4).
- Signed URLs are bearer tokens for 300 seconds — acceptable for review
  material; not appropriate for ultra-sensitive documents.
- Tier 3 "externally confirmed" is a recorded human attestation, not a
  cryptographic proof chain.

# BuildProof platform feature audit

Audit date: 2026-11-01. Status is based on source inspection and available automated/runtime checks, not unsupported production claims.

| Area | Status | Evidence and limitations |
|---|---|---|
| Public Events | WORKING | `/events`, event detail and public poster access are implemented and production-verified previously. |
| Proof Cards | PARTIALLY IMPLEMENTED | Creation, evidence linkage, detail/edit/archive/restore exist. Migration `0009` is applied. Individual-card generation from project completion is not implemented. |
| Public Proof Cards | WORKING | Public listing and card detail code uses approved/public RLS-scoped data; currently no published demo card records were confirmed. |
| Software project/solution marketplace | PARTIALLY IMPLEMENTED | `solutions` supports team listings, stages, exposure and interest; public detail and delivery workflows need end-to-end verification. |
| Hardware project management | PARTIALLY IMPLEMENTED | Hardware records, BOM, stages and demo links exist. Draft `0011` adds lifecycle and visibility for real public publishing. Deployment depends on migration approval. |
| Public hardware showcase | PARTIALLY IMPLEMENTED | Public page now lists database records. Visibility depends on draft migration `0011`; private/restricted records must remain private. |
| Team management/invitations | WORKING | Team membership, roles, proposed/accepted members and token invites are implemented with API/RLS checks. Email delivery is not configured. |
| Team chat | PARTIALLY IMPLEMENTED / NOT LIVE-VERIFIED | Persistent team-message API/UI exists and migration `0011` was executed in the approved production project, but authenticated member and non-member access require live browser verification. Realtime notifications are not implemented. |
| Problem statements | PARTIALLY IMPLEMENTED | Public problem pages, submission and demo walkthrough exist. Publisher verification, moderation and applications require live verification. |
| Opportunity marketplace | PARTIALLY IMPLEMENTED | Job/project opportunity tables and application UI exist. Payment processing is not implemented. |
| Company organisations | PARTIALLY IMPLEMENTED | Organisation profiles, membership and workspace UI exist; confidential collaboration and funding approval require deeper live verification. |
| Feedback/comments | PARTIALLY IMPLEMENTED | Comments and review records exist. Public comment moderation and notification delivery are not fully verified. |
| Notifications | PARTIALLY IMPLEMENTED | Notification table and API exist; delivery providers and team-chat push notifications are not configured. |
| Authentication | WORKING | Supabase Auth pages, guards and session handling exist; redirect allowlists require dashboard verification. |
| Storage privacy | PARTIALLY IMPLEMENTED | Evidence storage policies and private buckets exist, but all storage policies require live schema verification before production claims. |
| Payments | NOT IMPLEMENTED | Payment milestones exist in schema only; no actual payment provider or payment execution workflow is configured. |
| Automatic Proof Card generation | NOT IMPLEMENTED | Cards are currently created manually from the team workspace; project completion does not create one card per member or prevent duplicates through an application workflow. |

## Product journeys reviewed

- Team workspace, evidence, feasibility, prototype tests, plan/tasks and roles.
- Proof Card creation, evidence association, public/private detail, archive and restore.
- Hardware registration, 12-stage tracking, BOM and private-by-default records.
- Public and authenticated opportunities, solutions, problems and events.
- Organisation/company workspace and funding/application screens.

## Applied team collaboration database change

`supabase/migrations/0011_team_chat_and_project_visibility.sql` was executed in production in the approved Supabase project. Remaining verification is behavioural (authenticated team chat access, hardware visibility and storage privacy), not migration preparation. It adds:

- `public.team_messages`, member-only RLS and sender identity validation.
- Hardware lifecycle, visibility and publication timestamps.
- Public hardware RLS limited to published public rows.
- Minimal anonymous reads and authenticated team management.

Rollback is possible in a reviewed database transaction by dropping team-message objects and removing the three hardware columns/policy/index. Existing hardware rows remain private because visibility defaults to `private`; no destructive rollback should be attempted unless separately approved.

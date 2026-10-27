# Product specification

BuildProof exists to make practical, evidence-based skill verification
accessible to students who do not start from connections or brand-name
credentials: **the work is the credential**, and the work is gradable only if
the evidence is real.

## What BuildProof is

A workflow application for problem-driven innovation programs (cohorts)
 run by educational institutions. Students form teams around real problems,
build validation evidence, get reviewed at gates, and graduate their work
into **Proof Cards** — structured, reviewable statements of what was
validated, built and learned, with an honest verification tier.

## What BuildProof is not

- It does not fake engagement: no planted users, no fabricated analytics,
  no invented testimonials. Demo content is always labelled.
- It does not promise placement, funding or employer access.
- It does not replace institutional assessment; it complements it with a
  portable, auditable artefact.

## The 8-stage workflow

Each gate is a concrete data state in the app (see `docs/architecture.md`),
with a human review step. Stopping early — e.g. "ended at feasibility with a
stop decision" — is a first-class, non-punitive outcome recorded on the
team page.

| Stage | What happens | Who acts |
|---|---|---|
| 1. Submit a problem | Anyone signed in describes a real problem with context and evidence basis | Student / problem owner |
| 2. Screening | Admins approve, reject or request info; submitter sees outcome notes | platform admin |
| 3. Cohort & team | Institution admin creates cohorts; cohort members form teams around approved problems | institution admin + students |
| 4. Interviews | Teams record consented interviews with findings, pain points, patterns | team members |
| 5. Validation decision | Explicit decision with rationale: continue / pivot / stop | team, reviewed by staff/mentors |
| 6. Feasibility review | Structured report: technical, cost, time, access, dependencies, risks, value; reviewer feedback + decision | team + mentors/staff |
| 7. Prototype & tests | Test plan, iterations, per-test approach/tested counts, tasks, outcomes | team |
| 8. Proof Card | Draft → submit → review (changes requested/approved/rejected) → optional public publication; Tier 1/2/3 assigned by reviewers | team + reviewers + admins |

## Proof Cards and tiers

A Proof Card contains: problem statement, validation summary, feasibility
summary, build summary, honest results & limitations, and tagged skills each
backed by an evidence summary.

| Tier | Meaning | Set by |
|---|---|---|
| 1 | Team-reported | Team (default) |
| 2 | Mentor-verified | Assigned mentor / cohort staff |
| 3 | Externally confirmed | Reviewers, with `tier_set_by` recorded |

Publishing (visibility `public`) is exclusively an admin action and only for
approved cards; publication stamps who and when, and un-publishing retracts
the published state.

## Roles (7)

- **student** — self-assignable; works in teams.
- **problem_owner** — self-assignable; submits and follows problems.
- **facilitator** — cohort staff; reviews gates.
- **mentor** — assigned to teams; reviews, sets tiers, cannot publish.
- **faculty_coordinator** — cohort staff with coordinator duties.
- **institution_admin** — manages cohorts, members, publication for their institution.
- **platform_admin** — role grants, problem screening, publication, audit logs.

## Public site (15 pages)

Home, How it works, Proof Cards (gallery), Proof Card detail, Problems,
For students, For institutions, For mentors, About, Contact, Privacy, Terms,
Accessibility statement, FAQ, 404. Copy is descriptive and stays within what
the app verifiably does.

## Authenticated app (11 pages under `/app`)

Dashboard (role-aware), Problems (pool + submission + my submissions), Cohort,
Institution, Team layouts (overview, evidence, feasibility, tests, proof
cards), Mentors, Admin, Profile, Invite accept, Access denied.

## Honest-metrics principles

1. Numbers shown about teams come from their records, not projections.
2. A stopped project is displayed as a stopped project.
3. Interview counts only include consented, non-draft entries.
4. Anything demo-labelled is clearly marked and excluded from "real" claims.

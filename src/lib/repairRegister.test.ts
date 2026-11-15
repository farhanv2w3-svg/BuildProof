import { describe, expect, it } from "vitest";

/* -------------------------------------------------------------------------- */
/*  REPAIR REGISTER REGRESSIONS (Phases 2–5 of the repair)                    */
/*                                                                            */
/*  Two kinds of tests live here:                                             */
/*   1. Pure mirrored rules — server-side constraints the repair depends      */
/*      on (payment integrity, field-length limits), re-checked in logic.     */
/*   2. Source scans — the DRAFT migrations (0005–0008, awaiting approval,    */
/*      NOT executed) and the client repair code are locked so a later edit   */
/*      cannot silently drop one of the security clauses this repair was      */
/*      built around. If one of these fails, the database drafts and the      */
/*      policy/UI expectations have drifted.                                  */
/* -------------------------------------------------------------------------- */

/* Source texts under test, imported as raw strings (Vite's ?raw loader —
   types come from vite/client, already referenced in tsconfig "types"). */
import m0005 from "../../supabase/migrations/0005_grants_fix.sql?raw";
import m0006 from "../../supabase/migrations/0006_security_policies.sql?raw";
import m0007 from "../../supabase/migrations/0007_consent_and_payments.sql?raw";
import m0008 from "../../supabase/migrations/0008_accept_team_application.sql?raw";
import m0009 from "../../supabase/migrations/0009_proof_card_evidence_archive.sql?raw";
import m0011 from "../../supabase/migrations/0011_team_chat_and_project_visibility.sql?raw";
import apiTs from "./api?raw";
import appLayoutTsx from "../components/AppLayout?raw";
import publicProblemsTsx from "../pages/PublicProblemsPage?raw";
import profilePageTsx from "../features/auth/ProfilePage?raw";
import teamOverviewTsx from "../features/teams/TeamOverviewPage?raw";
import myOpportunitiesTsx from "../features/opportunities/MyOpportunitiesPage?raw";
import domainKitTsx from "../components/DomainKit?raw";
import uiTsx from "../components/ui?raw";
import teamSolutionsTsx from "../features/proof/TeamSolutionsPage?raw";
import myEventsTsx from "../features/events/MyEventsPage?raw";
import orgWorkspaceTsx from "../features/orgs/OrgWorkspacePage?raw";
import appTsx from "../App?raw";
import eventsPageTsx from "../features/events/EventsPage?raw";
import proofCardDetailTsx from "../features/proof-cards/ProofCardDetailPage?raw";
import attachmentsCardTsx from "../features/evidence/AttachmentsCard?raw";
import eventsCardTsx from "../features/events/EventCard?raw";
import eventsDetailTsx from "../features/events/EventDetailPage?raw";
import m0010 from "../../supabase/migrations/0010_events_public_access.sql?raw";

/* -------------------------------------------------------------------------- */
/*  1. Pure mirrored rules                                                    */
/* -------------------------------------------------------------------------- */

/** Mirrors the REPAIRED public.payment_status_guard() (draft 0007): a
 * CONFIRMED payment never silently loses 'paid' — cancelling or disputing it
 * is a platform-admin decision. */
function paidTransitionAllowed(to: string, actor: { isPlatformAdmin?: boolean }) {
  if (["cancelled", "disputed"].includes(to)) {
    return { ok: actor.isPlatformAdmin === true };
  }
  return { ok: true }; // other unpaid-side transitions follow the 0003 guard
}

/** Mirrors public.teams' check constraint. Used by the B1 creation form. */
function teamNameValid(name: string) {
  return name.length >= 2 && name.length <= 120;
}

/** Mirrors funding_applications.pitch check (0003:287). Used by B9 forms. */
function pitchValid(pitch: string) {
  return pitch.length >= 20 && pitch.length <= 3000;
}

/** Mirrors comments.body check (0001). Used by the B7 comments panel. */
function commentValid(body: string) {
  return body.length >= 1 && body.length <= 2000;
}

/** Money unit contract (9.9): money() receives PAISE, moneyRange()
 * receives RUPEES. The 100x display bug happens when the two mix. */
function paiseToRupeeDisplay(paise: number) {
  return paise / 100;
}

/* -------------------------------------------------------------------------- */
/*  2. Source scans — draft migrations                                        */
/* -------------------------------------------------------------------------- */

/** Extract a full SQL statement: from `marker` up to the given terminator
 * (default ";", but plpgsql bodies must use "$$;" — they contain inner ";"). */
function statement(text: string, marker: string, terminator = ";") {
  const start = text.indexOf(marker);
  expect(start, `migration must contain ${marker}`).toBeGreaterThanOrEqual(0);
  const end = text.indexOf(terminator, start);
  return text.slice(start, end + terminator.length);
}

describe("0005 grants fix (draft)", () => {
  it("anon SELECT covers exactly the 11 anon-policy tables", () => {
    const grant = statement(m0005, "grant select on\n  public.proof_cards");
    const granted = [...grant.matchAll(/public\.(\w+)/g)].map((match) => match[1]);
    expect(granted.sort()).toEqual(
      [
        "company_projects",
        "events",
        "funding_opportunities",
        "job_opportunities",
        "organizations",
        "organization_members",
        "proof_card_skills",
        "proof_cards",
        "proof_contributions",
        "solutions",
        "team_role_requirements",
      ].sort()
    );
  });

  it("anon never gets 'problems' or any write privilege", () => {
    // problems is deliberately excluded (no anon policy on it; contact data).
    const grant = statement(m0005, "grant select on\n  public.proof_cards");
    expect(grant.includes("public.problems")).toBe(false);
    // Every other grant in 0005 targets authenticated, never anon.
    for (const match of m0005.matchAll(/grant (insert|update|delete)[\s\S]*?;/g)) {
      expect(match[0], `${match[0]} must not target anon`).not.toContain("to anon");
    }
  });

  it("trigger functions lose the default PUBLIC EXECUTE surface", () => {
    for (const fn of [
      "handle_new_user",
      "proof_card_review_guard",
      "payment_status_guard",
      "review_verify_guard",
      "enforce_self_member_status_only",
    ]) {
      expect(m0005).toContain(`revoke execute on function public.${fn}() from public, anon`);
    }
  });
});

describe("0006 policy repairs (draft)", () => {
  it("S1 — audit rows must name the caller (actor bound to auth.uid())", () => {
    const policy = statement(m0006, 'create policy "reporter roles append own-actor audit logs"', ");");
    expect(policy).toContain("actor_id = auth.uid()");
    // admins keep only the controlled system-entry path
    expect(policy).toContain("public.is_platform_admin()");
  });

  it("S2 — the unsafe problem_owner/owner_contact clause is GONE", () => {
    const policy = statement(m0006, 'create policy "users see approved & own submissions"\n  on public.problems', ");");
    expect(policy).not.toContain("owner_contact");
    expect(policy).not.toContain("problem_owner");
    // legitimate paths survived the rewrite
    expect(policy).toContain("status = 'approved'");
    expect(policy).toContain("submitted_by = auth.uid()");
    expect(policy).toContain("public.is_platform_admin()");
  });

  it("S8 — email→uid lookup restricted to staff-like roles", () => {
    const fn = statement(m0006, "create or replace function public.find_user_id_by_email", "$$;");
    for (const role of ["platform_admin", "institution_admin", "faculty_coordinator", "facilitator"]) {
      expect(fn).toContain(role);
    }
    // students and self-registered problem owners must NOT unlock the lookup
    expect(fn).not.toContain("'student'");
    expect(fn).not.toContain("'problem_owner'");
  });

  it("D1 — proof_contributions finally has a DELETE policy", () => {
    const policy = statement(m0006, 'create policy "team editors remove contributions"', ");");
    expect(policy).toContain("for delete to authenticated");
    expect(policy).toContain("public.can_edit_team_work");
  });

  it("D2 — mentor assignments can be revoked by cohort staff", () => {
    const policy = statement(m0006, 'create policy "cohort staff manage assignments"', ");");
    expect(policy).toContain("for update to authenticated");
    expect(policy).toContain("public.is_cohort_staff");
  });
});

describe("0007 consent + payment integrity (draft)", () => {
  it("S3 — each consent flag can only be set by its own party", () => {
    const guard = statement(m0007, "create or replace function public.transfer_consent_guard", "$$;");
    // creator consent → member of the owning team
    expect(guard).toContain("public.can_edit_team_work");
    // other-party consent → the proposer themselves
    expect(guard).toContain("new.proposed_by is distinct from actor");
  });

  it("S7 — cancelling/disputing a PAID milestone requires platform admin", () => {
    const guard = statement(m0007, "create or replace function public.payment_status_guard", "$$;");
    expect(guard).toContain("'disputed', 'cancelled'");
    expect(guard).toContain("requires a platform admin");
    // and every transition is audited
    expect(guard).toContain("'payment_milestone_status'");
  });

  it("S7 — platform admins get the update policy they previously lacked", () => {
    const policy = statement(m0007, 'create policy "platform admins oversee payment milestones"', ");");
    expect(policy).toContain("public.is_platform_admin()");
  });
});

describe("0008 acceptance RPC (draft)", () => {
  it("only team editors can decide pending applications", () => {
    expect(m0008).toContain("public.can_edit_team_work(app.team_id)");
    expect(m0008).toContain("app.status <> 'pending'");
    expect(m0008).toContain("for update"); // row lock against double decisions
  });

  it("acceptance creates the membership and notifies the applicant", () => {
    expect(m0008).toContain("insert into public.team_members");
    expect(m0008).toContain("on conflict (team_id, user_id)");
    expect(m0008).toContain("insert into public.notifications");
    expect(m0008).toContain("insert into public.audit_logs");
  });
});

/* -------------------------------------------------------------------------- */
/*  3. Source scans — client repair code                                      */
/* -------------------------------------------------------------------------- */

describe("client repair wiring", () => {
  it("B2 — acceptance goes through the transactional RPC, not a bare update", () => {
    expect(apiTs).toContain('s.rpc("accept_team_application"');
    expect(apiTs).toContain('status === "accepted"');
  });

  it("A12 — the notification bell revalidates on focus and on read", () => {
    expect(appLayoutTsx).toContain("refetchOnWindowFocus: true");
    expect(appLayoutTsx).toContain('invalidateQueries({ queryKey: ["notifications", user?.id] })');
  });

  it("A5 — public problems page never queries while signed out", () => {
    expect(publicProblemsTsx).toMatch(/if \(!user\) \{\s*setProblems\(\[\]\)/);
  });

  it("A13 — profile save refreshes the auth context", () => {
    expect(profilePageTsx).toContain("await refresh()");
  });

  it("B6/B7 — ProofCardBuilder and team comments are actually mounted", () => {
    expect(teamOverviewTsx).toContain("<ProofCardBuilder");
    expect(teamOverviewTsx).toContain("<TeamComments");
    expect(teamOverviewTsx).toContain("fetchComments(teamId, null)");
  });

  it("B14 — job applications can attach a real Proof Card", () => {
    expect(myOpportunitiesTsx).not.toContain("proof_card_id: null");
    expect(myOpportunitiesTsx).toContain("listMyCards");
  });

  it("9.6 — evidence lists can filter by stage server-side", () => {
    expect(apiTs).toContain('q = q.eq("stage", stage)');
  });

  it("9.9 — money() treats its argument as paise (/100)", () => {
    expect(domainKitTsx).toContain("paise / 100");
  });
});

/* -------------------------------------------------------------------------- */
/*  4. Pure-rule tests                                                        */
/* -------------------------------------------------------------------------- */

describe("mirrored database rules", () => {
  it("a paid milestone cannot be cancelled or disputed by org staff", () => {
    expect(paidTransitionAllowed("cancelled", {}).ok).toBe(false);
    expect(paidTransitionAllowed("disputed", { isPlatformAdmin: false }).ok).toBe(false);
    expect(paidTransitionAllowed("disputed", { isPlatformAdmin: true }).ok).toBe(true);
  });

  it("team names must be 2–120 characters (B1 form mirrors the constraint)", () => {
    expect(teamNameValid("ab")).toBe(true);
    expect(teamNameValid("a".repeat(120))).toBe(true);
    expect(teamNameValid("a")).toBe(false);
    expect(teamNameValid("a".repeat(121))).toBe(false);
  });

  it("funding pitches must be 20–3000 characters (B9 form mirrors the check)", () => {
    expect(pitchValid("x".repeat(20))).toBe(true);
    expect(pitchValid("x".repeat(19))).toBe(false);
    expect(pitchValid("x".repeat(3000))).toBe(true);
    expect(pitchValid("x".repeat(3001))).toBe(false);
  });

  it("team comments must be 1–2000 characters (B7 panel mirrors the check)", () => {
    expect(commentValid("x")).toBe(true);
    expect(commentValid("")).toBe(false);
    expect(commentValid("x".repeat(2000))).toBe(true);
    expect(commentValid("x".repeat(2001))).toBe(false);
  });

  it("money() unit contract: paise, not rupees", () => {
    expect(paiseToRupeeDisplay(250000)).toBe(2500);
    expect(paiseToRupeeDisplay(1)).toBe(0.01);
  });
});

describe("phase 7 accessible confirmations and transfer consent", () => {
  it("no native confirmation dialogs remain in the application", () => {
    expect(`${myEventsTsx}\n${orgWorkspaceTsx}`).not.toContain("window.confirm(");
    expect(uiTsx).toContain("role=\"alertdialog\"");
  });

  it("transfer consent is recorded independently for each party", () => {
    expect(teamSolutionsTsx).toContain("agreed_by_creator: true");
    expect(teamSolutionsTsx).toContain("agreed_by_other: true");
    expect(teamSolutionsTsx).not.toContain("agreed_by_creator: true,\n                          agreed_by_other:");
  });

  it("published events are routable to signed-out visitors and evidence uploads are constrained", () => {
    expect(appTsx).toContain('path="/events"');
    expect(appTsx).toContain('path="/events/:eventId"');
    expect(eventsPageTsx).toContain("listEvents({ limit: 200 })");
    expect(eventsCardTsx).toContain("to={isDemo ? `/events/${DEMO_EVENT_ID}` : `/events/${ev.id}`}");
    expect(eventsDetailTsx).toContain('to="/events"');
    expect(attachmentsCardTsx).toContain("validateUpload(file)");
  });

  it("has an Events-only database repair that grants only published-row reads", () => {
    expect(m0010).toContain("grant select on public.events to anon");
    expect(m0010).toContain("using (status = 'published')");
    expect(m0010).not.toContain("grant insert on public.events");
    expect(m0010).not.toContain("disable row level security");
  });

  it("Proof Card details include persisted team editing controls", () => {
    expect(proofCardDetailTsx).toContain("Edit card details");
    expect(proofCardDetailTsx).toContain("Proof Card changes saved");
  });

  it("the consent migration refuses mutual-status transitions without both flags", () => {
    expect(m0007).toContain("Both parties must consent before an agreement can be agreed or executed");
    expect(m0007).toContain("revoke execute on function public.transfer_consent_guard()");
  });
});

describe("Proof Card evidence linkage and archive", () => {
  it("links evidence to an individual Proof Card without backfilling existing records", () => {
    expect(m0009).toContain("add column if not exists proof_card_id");
    expect(m0009).toContain("proof_card_id must reference an active card owned by the evidence team");
    expect(m0009).toContain("Existing evidence remains team-scoped");
    expect(apiTs).toContain("proof_card_id: proofCardId ?? null");
    expect(apiTs).toContain("export async function associateEvidence");
    expect(apiTs).toContain('q.is("proof_card_id", null)');
    expect(attachmentsCardTsx).toContain("Link existing evidence to this Proof Card");
  });

  it("archives cards without deleting evidence and hides archived cards publicly", () => {
    expect(m0009).toContain("add column if not exists archived boolean");
    expect(m0009).toContain("archived = false");
    expect(m0009).toContain("team readers read evidence objects");
    expect(m0009).toContain("ea.visibility = 'team'");
    expect(m0009).toContain("there is no delete path");
    expect(proofCardDetailTsx).toContain("Archive Proof Card");
    expect(proofCardDetailTsx).toContain("Restore card");
  });

  it("filters active cards in the API and public events by explicit publication state", () => {
    expect(apiTs).toContain('.eq("archived", archived)');
    expect(apiTs).toContain('.eq("archived", false)');
    expect(apiTs).toContain('.eq("status", "published")');
  });
});

describe("platform collaboration and publishing", () => {
  it("keeps team chat member-only and binds sender identity", () => {
    expect(m0011).toContain("public.is_team_member(team_id)");
    expect(m0011).toContain("sender_id = auth.uid()");
    expect(m0011).toContain("alter table public.team_messages enable row level security");
  });

  it("publishes hardware only when public and timestamped", () => {
    expect(m0011).toContain("visibility = 'public' and published_at is not null");
    expect(m0011).toContain("visibility text not null default 'private'");
  });

  it("does not grant anonymous hardware writes", () => {
    expect(m0011).not.toMatch(/grant\s+(insert|update|delete).*hardware_projects.*to anon/is);
  });
});

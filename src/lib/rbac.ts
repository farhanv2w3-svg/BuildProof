import type { ProofReviewStatus, ProofVisibility, Team } from "../types/database";

/* ------------------------------------------------------------------ */
/*  Role model                                                         */
/* ------------------------------------------------------------------ */

export const ROLES = [
  "student",
  "facilitator",
  "mentor",
  "faculty_coordinator",
  "problem_owner",
  "institution_admin",
  "platform_admin",
] as const;

export type AppRole = (typeof ROLES)[number];

/**
 * Roles a user is allowed to self-select at signup. Anything more privileged
 * is granted only by an authorised platform administrator — never by the
 * signup form, profile editor, or client-side code.
 */
export const SELF_ASSIGNABLE_ROLES: AppRole[] = ["student", "problem_owner"];

/** Roles whose holders may assign roles and screen problems platform-wide. */
export function isPlatformAdmin(roles: AppRole[]) {
  return roles.includes("platform_admin");
}

/** Roles that can review work (facilitators, mentors, coordinators, admins). */
export function isReviewer(roles: AppRole[]) {
  return roles.some((r) =>
    ["facilitator", "mentor", "faculty_coordinator", "institution_admin", "platform_admin"].includes(r)
  );
}

/** Roles that can review and set verification tiers on Proof Cards. */
export function canSetTier(roles: AppRole[]) {
  return roles.some((r) =>
    ["facilitator", "mentor", "faculty_coordinator", "institution_admin", "platform_admin"].includes(r)
  );
}

/**
 * Can this user publish (or unpublish) a Proof Card publicly?
 * Platform-wide admins, or institution admins for the team's cohort
 * institution. Team members and reviewers can APPROVE, but not publish.
 */
export function canPublishCard(
  roles: AppRole[],
  cardContext: { teamInstitutionId: string | null }
) {
  if (roles.includes("platform_admin")) return true;
  return (
    roles.includes("institution_admin") &&
    cardContext.teamInstitutionId !== null
  );
}

/** Staff-level role gate used for admin UI routing. */
export function isAdminRouteAllowed(roles: AppRole[]) {
  return roles.includes("platform_admin");
}

/** True when the user holds ANY of the allowed roles — used by nav guards. */
export function hasRoleAccess(roles: AppRole[], allowed: AppRole[]) {
  return roles.some((r) => allowed.includes(r));
}

/** Compact role summary for sidebars. */
export function rolesSummary(roles: AppRole[]) {
  if (roles.length === 0) return "No roles assigned";
  return roles
    .map((r) => r.replace(/_/g, " "))
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" · ");
}

/** Which dashboard entry point a role primarily sees, for welcome copy. */
export function primaryRoleLabel(roles: AppRole[]): string {
  const order: AppRole[] = [
    "platform_admin",
    "institution_admin",
    "faculty_coordinator",
    "facilitator",
    "mentor",
    "problem_owner",
    "student",
  ];
  const found = order.find((r) => roles.includes(r));
  return found ? found.replace("_", " ") : "member";
}

/* ------------------------------------------------------------------ */
/*  Pure helpers over team state (used by UI AND unit tests)           */
/* ------------------------------------------------------------------ */

export function teamMemberCount(members: { status: string }[], status = "accepted") {
  return members.filter((m) => m.status === status).length;
}

/**
 * Validation-stage gate: how many more consented interviews the team needs
 * before they can reasonably record a validation decision. Gate target is
 * configured per cohort (default 8) — it is guidance, not a hard block.
 */
export function interviewGap(
  completed: { consent: boolean; status: string }[],
  target: number
) {
  const valid = completed.filter((i) => i.consent && i.status !== "draft");
  const done = valid.length;
  return {
    done,
    target,
    remaining: Math.max(0, target - done),
    met: done >= target,
    percent: Math.min(100, Math.round((done / Math.max(1, target)) * 100)),
  };
}

/**
 * Public proof-card visibility predicate — mirrors the RLS policy for
 * anonymous visitors. A card is publicly visible only when BOTH conditions
 * hold: approved/published review state AND explicitly published visibility.
 * Unapproved or draft cards must never be public, even if flagged public.
 */
export function isPubliclyVisible(card: {
  visibility: ProofVisibility;
  review_status: ProofReviewStatus;
}) {
  return (
    card.visibility === "public" &&
    (card.review_status === "approved" || card.review_status === "published")
  );
}

/** Which team statuses count as "work in progress" for honest labelling. */
export function teamStatusLabel(t: Pick<Team, "status">) {
  switch (t.status) {
    case "forming":
      return "Forming";
    case "active":
      return "In progress";
    case "paused":
      return "Paused";
    case "stopped":
      return "Stopped";
    case "completed":
      return "Completed";
    default:
      return "Unknown status";
  }
}

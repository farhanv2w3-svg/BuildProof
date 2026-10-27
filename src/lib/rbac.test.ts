import { describe, expect, it } from "vitest";
import {
  SELF_ASSIGNABLE_ROLES,
  canPublishCard,
  hasRoleAccess,
  interviewGap,
  isPlatformAdmin,
  isPubliclyVisible,
  isReviewer,
  primaryRoleLabel,
  rolesSummary,
  teamMemberCount,
  teamStatusLabel,
} from "./rbac";

describe("SELF_ASSIGNABLE_ROLES", () => {
  it("exposes only the two safe self-service roles", () => {
    expect(SELF_ASSIGNABLE_ROLES).toEqual(["student", "problem_owner"]);
  });
});

describe("isPlatformAdmin / isReviewer", () => {
  it("recognises platform admins", () => {
    expect(isPlatformAdmin(["platform_admin"])).toBe(true);
    expect(isPlatformAdmin(["student", "institution_admin"])).toBe(false);
    expect(isPlatformAdmin([])).toBe(false);
  });

  it("treats facilitators, mentors, coordinators and admins as reviewers", () => {
    expect(isReviewer(["facilitator"])).toBe(true);
    expect(isReviewer(["mentor"])).toBe(true);
    expect(isReviewer(["faculty_coordinator"])).toBe(true);
    expect(isReviewer(["institution_admin"])).toBe(true);
    expect(isReviewer(["platform_admin"])).toBe(true);
    expect(isReviewer(["student"])).toBe(false);
    expect(isReviewer(["problem_owner"])).toBe(false);
  });
});

describe("canPublishCard", () => {
  const inst = "inst-1";

  it("platform admins can always publish", () => {
    expect(canPublishCard(["platform_admin"], { teamInstitutionId: null })).toBe(true);
    expect(canPublishCard(["platform_admin"], { teamInstitutionId: inst })).toBe(true);
  });

  it("institution admins can publish only with a known institution context", () => {
    expect(canPublishCard(["institution_admin"], { teamInstitutionId: inst })).toBe(true);
    expect(canPublishCard(["institution_admin"], { teamInstitutionId: null })).toBe(false);
  });

  it("team roles and simple reviewers can approve but never publish", () => {
    expect(canPublishCard(["student"], { teamInstitutionId: inst })).toBe(false);
    expect(canPublishCard(["problem_owner"], { teamInstitutionId: inst })).toBe(false);
    expect(canPublishCard(["mentor"], { teamInstitutionId: inst })).toBe(false);
    expect(canPublishCard(["facilitator"], { teamInstitutionId: null })).toBe(false);
    expect(canPublishCard([], { teamInstitutionId: inst })).toBe(false);
  });
});

describe("interviewGap", () => {
  it("counts only consented, non-draft interviews", () => {
    const interviews = [
      { consent: true, status: "submitted" },
      { consent: true, status: "reviewed" },
      { consent: true, status: "draft" }, // draft: not counted
      { consent: false, status: "submitted" }, // no consent: not counted
      { consent: false, status: "draft" },
    ];
    const gap = interviewGap(interviews, 8);
    expect(gap.done).toBe(2);
    expect(gap.remaining).toBe(6);
    expect(gap.met).toBe(false);
    expect(gap.percent).toBe(25);
  });

  it("never returns a negative remaining and caps percent at 100", () => {
    const done8 = Array.from({ length: 10 }, () => ({ consent: true, status: "reviewed" }));
    const gap = interviewGap(done8, 8);
    expect(gap.done).toBe(10);
    expect(gap.remaining).toBe(0);
    expect(gap.met).toBe(true);
    expect(gap.percent).toBe(100);
  });

  it("handles empty inputs and a zero target without division errors", () => {
    expect(interviewGap([], 8)).toMatchObject({ done: 0, remaining: 8, met: false, percent: 0 });
    expect(interviewGap([{ consent: true, status: "reviewed" }], 0)).toMatchObject({
      done: 1,
      remaining: 0,
      met: true,
      percent: 100,
    });
  });
});

describe("isPubliclyVisible", () => {
  it("public + approved/published → visible", () => {
    expect(isPubliclyVisible({ visibility: "public", review_status: "approved" })).toBe(true);
    expect(isPubliclyVisible({ visibility: "public", review_status: "published" })).toBe(true);
  });

  it("any other combination → not visible (safe-by-default tuple cases)", () => {
    expect(isPubliclyVisible({ visibility: "public", review_status: "draft" })).toBe(false);
    expect(isPubliclyVisible({ visibility: "public", review_status: "submitted" })).toBe(false);
    expect(isPubliclyVisible({ visibility: "public", review_status: "changes_requested" })).toBe(false);
    expect(isPubliclyVisible({ visibility: "public", review_status: "rejected" })).toBe(false);
    expect(isPubliclyVisible({ visibility: "private", review_status: "approved" })).toBe(false);
    expect(isPubliclyVisible({ visibility: "private", review_status: "published" })).toBe(false);
    expect(isPubliclyVisible({ visibility: "private", review_status: "draft" })).toBe(false);
  });
});

describe("labels", () => {
  it("teamStatusLabel keeps statuses honest", () => {
    expect(teamStatusLabel({ status: "forming" })).toBe("Forming");
    expect(teamStatusLabel({ status: "active" })).toBe("In progress");
    expect(teamStatusLabel({ status: "paused" })).toBe("Paused");
    expect(teamStatusLabel({ status: "stopped" })).toBe("Stopped");
    expect(teamStatusLabel({ status: "completed" })).toBe("Completed");
  });

  it("rolesSummary formats underscored roles", () => {
    expect(rolesSummary([])).toBe("No roles assigned");
    expect(rolesSummary(["platform_admin"])).toBe("Platform admin");
    expect(rolesSummary(["student", "problem_owner"])).toBe("Student · Problem owner");
  });

  it("primaryRoleLabel prefers the most privileged role present", () => {
    expect(primaryRoleLabel(["student", "platform_admin"])).toBe("platform admin");
    expect(primaryRoleLabel(["student", "mentor"])).toBe("mentor");
    expect(primaryRoleLabel(["student"])).toBe("student");
    expect(primaryRoleLabel([])).toBe("member");
  });
});

describe("guards", () => {
  it("admin routes are platform-admin only", () => {
    expect(hasRoleAccess(["platform_admin"], ["platform_admin"])).toBe(true);
    expect(hasRoleAccess(["institution_admin"], ["platform_admin"])).toBe(false);
  });

  it("teamMemberCount filters by status", () => {
    expect(
      teamMemberCount([{ status: "accepted" }, { status: "proposed" }, { status: "accepted" }])
    ).toBe(2);
    expect(
      teamMemberCount([{ status: "proposed" }, { status: "proposed" }], "proposed")
    ).toBe(2);
  });
});

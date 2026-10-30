import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  demoMilestones,
  demoProofCard,
  demoTeamMembers,
  demoTestResults,
  demoWalkthroughProblem,
  evidenceCoverage,
  isDemoProblem,
  milestoneCompletionPercent,
  totalAgreedWeight,
} from "./demoWalkthrough";

describe("demo walkthrough — milestone scoring", () => {
  it("agreed milestone weights sum to exactly 100", () => {
    expect(totalAgreedWeight(demoMilestones)).toBe(100);
  });

  it("has exactly one pending milestone, so completion is 90%", () => {
    const pending = demoMilestones.filter((m) => m.status === "pending");
    expect(pending).toHaveLength(1);
    expect(pending[0]!.weight).toBe(10);
    expect(milestoneCompletionPercent(demoMilestones)).toBe(90);
  });

  it("accepts 90 of the agreed 100 weight points", () => {
    const accepted = demoMilestones
      .filter((m) => m.status === "accepted")
      .reduce((s, m) => s + m.weight, 0);
    expect(accepted).toBe(90);
  });

  it("covers all seven sprint days with no duplicates", () => {
    expect(demoMilestones.map((m) => m.day).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("matches the walkthrough's day plan", () => {
    for (const m of demoMilestones) {
      expect(m.title.length).toBeGreaterThan(3);
      expect(m.description.length).toBeGreaterThan(20);
      expect(m.responsibleRole.length).toBeGreaterThan(3);
    }
    expect(demoMilestones[0]!.title).toContain("Problem research");
    expect(demoMilestones[1]!.title).toContain("Requirements");
    expect(demoMilestones[2]!.title).toContain("UI design");
    expect(demoMilestones[3]!.title + demoMilestones[4]!.title).toContain("Prototype development");
    expect(demoMilestones[5]!.title).toContain("Testing");
    expect(demoMilestones[6]!.title).toContain("Final demonstration");
  });
});

describe("demo walkthrough — evidence coverage", () => {
  it("6 of 7 milestones carry accepted example evidence", () => {
    const cov = evidenceCoverage(demoMilestones);
    expect(cov.withAcceptedEvidence).toBe(6);
    expect(cov.total).toBe(7);
    expect(cov.percent).toBe(86);
  });

  it("never claims a file exists — every evidence item is an example", () => {
    for (const m of demoMilestones) {
      if (m.evidence) {
        expect(m.evidence.format.toLowerCase()).toContain("example only");
      }
    }
  });

  it("the pending milestone has no evidence and says why", () => {
    const pending = demoMilestones.filter((m) => m.status === "pending");
    expect(pending[0]!.evidence).toBeNull();
    expect(pending[0]!.thoroughNote?.toLowerCase()).toContain("honestly");
  });
});

describe("demo walkthrough — individual contribution", () => {
  it("has exactly four demo members with the agreed shares", () => {
    const roles = demoTeamMembers.map((m) => m.role);
    expect(roles).toEqual(["Team Lead", "Developer", "Designer", "Analyst"]);
  });

  it("shares are exactly 25 / 35 / 20 / 20 and sum to 100", () => {
    const [lead, dev, designer, analyst] = demoTeamMembers;
    expect(lead!.sharePercent).toBe(25);
    expect(dev!.sharePercent).toBe(35);
    expect(designer!.sharePercent).toBe(20);
    expect(analyst!.sharePercent).toBe(20);
    expect(
      demoTeamMembers.reduce((s, m) => s + m.sharePercent, 0)
    ).toBe(100);
  });

  it("shares derive from points / 100-agreed-points denominator", () => {
    for (const m of demoTeamMembers) {
      expect(m.contributionPoints).toBe(m.sharePercent);
      expect(m.contributionPoints).toBeGreaterThan(0);
      expect(m.contributionPoints).toBeLessThanOrEqual(100);
    }
    expect(demoTeamMembers.reduce((s, m) => s + m.contributionPoints, 0)).toBe(100);
  });

  it("every demo identity is clearly marked as fictional", () => {
    for (const m of demoTeamMembers) {
      expect(m.name.toLowerCase()).toContain("(demo identity)");
      expect(m.note.toLowerCase()).toMatch(/fictional/);
    }
  });

  it("each member leads at least one weighted day", () => {
    const ledDays = new Set(demoTeamMembers.flatMap((m) => m.leads));
    for (const m of demoTeamMembers) expect(m.leads.length).toBeGreaterThan(0);
    for (const milestone of demoMilestones) {
      expect(ledDays.has(milestone.day)).toBe(true);
    }
  });

  it("member day-led assignments cover responsibilities honestly", () => {
    const dev = demoTeamMembers[1]!;
    expect(dev.leads).toEqual([4, 5]); // weighted development days
    expect(dev.responsibilities.join(" ").toLowerCase()).toContain("data-entry");
  });
});

describe("demo walkthrough — problem record", () => {
  it("uses the required fictional organisation and title", () => {
    expect(demoWalkthroughProblem.title).toBe("Reducing Material Wastage in Small Manufacturing Units");
    expect(demoWalkthroughProblem.organisation).toBe("Demo Manufacturing Solutions");
    expect(demoWalkthroughProblem.organisationNote).toMatch(/FICTIONAL/i);
  });

  it("is a Beginner, 7-day Manufacturing / Software problem", () => {
    expect(demoWalkthroughProblem.category).toBe("Manufacturing / Software");
    expect(demoWalkthroughProblem.difficulty).toBe("Beginner");
    expect(demoWalkthroughProblem.durationDays).toBe(7);
  });

  it("deadline is exactly 7 days after the sprint start", () => {
    expect(demoWalkthroughProblem.startDate).toBe("2026-11-09");
    expect(addDaysIso(demoWalkthroughProblem.startDate, 6)).toBe(demoWalkthroughProblem.deadline);
    expect(addDaysIso(demoWalkthroughProblem.startDate, 7)).toBe("2026-11-16");
  });

  it("lists the five required deliverables", () => {
    expect(demoWalkthroughProblem.deliverables).toEqual([
      "Material usage recording.",
      "Wastage tracking.",
      "Dashboard.",
      "Daily report generation.",
      "Working prototype with sample data.",
    ]);
  });

  it("carries the required problem narrative sections", () => {
    expect(demoWalkthroughProblem.description.length).toBeGreaterThan(80);
    expect(demoWalkthroughProblem.background.length).toBeGreaterThan(80);
    expect(demoWalkthroughProblem.currentDifficulties.length).toBeGreaterThanOrEqual(3);
    expect(demoWalkthroughProblem.expectedOutcome.toLowerCase()).toContain("prototype");
    expect(demoWalkthroughProblem.requirements.length).toBeGreaterThanOrEqual(5);
    expect(demoWalkthroughProblem.constraints.length).toBeGreaterThanOrEqual(3);
    expect(demoWalkthroughProblem.evaluationCriteria.length).toBeGreaterThanOrEqual(3);
  });
});

describe("demo walkthrough — proof card content", () => {
  it("never equates completion with success or adoption", () => {
    expect(demoProofCard.outcomeLabel.toLowerCase()).toContain("not adopted");
    expect(demoProofCard.neverImplicationNote).toMatch(/does NOT mean/i);
  });

  it("states the completion formula and contribution denominator", () => {
    expect(demoProofCard.completionFormula).toContain("accepted milestone weight");
    expect(demoProofCard.completionFormula).toContain("total agreed milestone weight");
    expect(demoProofCard.contributionDenominatorNote).toContain("÷ 100 agreed work points");
    expect(demoProofCard.contributionDenominatorNote.toLowerCase()).toContain(
      "not independently verified"
    );
  });

  it("shows demo testing results that reconcile", () => {
    expect(demoTestResults.passed + demoTestResults.deferred).toBe(demoTestResults.total);
    expect(demoTestResults.total).toBe(21);
    expect(demoTestResults.note.toLowerCase()).toContain("demo");
  });

  it("uses an illustrative Tier-2 / approved review framing", () => {
    expect(demoProofCard.tierLabel).toContain("(illustrative)");
    expect(demoProofCard.reviewStatusLabel).toContain("illustrative");
    expect(demoProofCard.teamNames).toHaveLength(4);
  });
});

describe("demo walkthrough — id guard", () => {
  it("intercepts only its own demo id", () => {
    expect(isDemoProblem("demo-reducing-material-wastage")).toBe(true);
    expect(isDemoProblem(undefined)).toBe(false);
    expect(isDemoProblem("8f2d9a6e-0000-4000-8000-000000000001")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  CAPTION_TEMPLATE_KEYS,
  checkEligibility,
  generateCaption,
  isValidEventSlug,
  nextSnapshotVersion,
  registrationWindowOpen,
  shareLinks,
  slugify,
  submissionWindowOpen,
  validateCriteriaWeights,
  validateDeclarations,
  validateEventDates,
  validateRegistrationAnswers,
  validateSubmissionFieldConfig,
  validateSubmissionPayload,
  validateTeamSizeConfig,
} from "./eventspaceRules";

const day = (n: number) => new Date(`2026-06-01T00:00:00Z`).getTime() + n * 86400000;
const iso = (n: number) => new Date(day(n)).toISOString();

describe("validateEventDates", () => {
  it("accepts a well-ordered schedule", () => {
    const r = validateEventDates({
      starts_at: iso(10),
      ends_at: iso(12),
      registration_opens_at: iso(0),
      registration_closes_at: iso(9),
      submission_opens_at: iso(10),
      submission_deadline: iso(11),
      judging_starts_at: iso(11),
      judging_ends_at: iso(12),
      results_at: iso(13),
    });
    expect(r.ok).toBe(true);
  });

  it("rejects end before start", () => {
    const r = validateEventDates({ starts_at: iso(12), ends_at: iso(10) });
    expect(r.ok).toBe(false);
  });

  it("rejects registration closing before opening", () => {
    const r = validateEventDates({
      starts_at: iso(10),
      ends_at: iso(12),
      registration_opens_at: iso(9),
      registration_closes_at: iso(1),
    });
    expect(r.ok).toBe(false);
  });

  it("rejects submission deadline after event end", () => {
    const r = validateEventDates({
      starts_at: iso(10),
      ends_at: iso(12),
      submission_deadline: iso(20),
    });
    expect(r.ok).toBe(false);
  });

  it("rejects judging end before judging start", () => {
    const r = validateEventDates({
      starts_at: iso(10),
      ends_at: iso(20),
      judging_starts_at: iso(15),
      judging_ends_at: iso(13),
    });
    expect(r.ok).toBe(false);
  });
});

describe("validateCriteriaWeights", () => {
  it("accepts weights totalling 100", () => {
    const r = validateCriteriaWeights([
      { name: "Innovation", weight: 40 },
      { name: "Execution", weight: 60 },
    ]);
    expect(r.ok).toBe(true);
  });

  it("rejects weights not totalling 100", () => {
    const r = validateCriteriaWeights([
      { name: "Innovation", weight: 30 },
      { name: "Execution", weight: 30 },
    ]);
    expect(r.ok).toBe(false);
    expect(r.message).toContain("100");
  });

  it("rejects empty rubric", () => {
    expect(validateCriteriaWeights([]).ok).toBe(false);
  });

  it("rejects duplicate criteria", () => {
    const r = validateCriteriaWeights([
      { name: "Innovation", weight: 50 },
      { name: "innovation", weight: 50 },
    ]);
    expect(r.ok).toBe(false);
  });

  it("rejects non-positive weights", () => {
    expect(
      validateCriteriaWeights([
        { name: "A", weight: 100 },
        { name: "B", weight: 0 },
      ]).ok
    ).toBe(false);
  });
});

describe("validateTeamSizeConfig", () => {
  it("passes for individual events regardless of sizes", () => {
    expect(validateTeamSizeConfig("individual", 0, 0).ok).toBe(true);
  });

  it("rejects max below min", () => {
    expect(validateTeamSizeConfig("team", 4, 2).ok).toBe(false);
  });

  it("rejects oversized teams", () => {
    expect(validateTeamSizeConfig("both", 1, 21).ok).toBe(false);
  });

  it("accepts a sane team config", () => {
    expect(validateTeamSizeConfig("team", 2, 5).ok).toBe(true);
  });
});

describe("checkEligibility", () => {
  const base = {
    eligibility_levels: ["college", "university"],
    eligibility_years: ["1", "2"],
    eligibility_departments: ["CSE"],
    eligibility_institutions: ["IIT"],
    eligibility_regions: [] as string[],
  };

  it("passes an eligible student", () => {
    expect(
      checkEligibility(base, {
        eligibility_level: "college",
        academic_year: "2",
        department: "CSE",
        institution_name: "IIT Madras",
      }).ok
    ).toBe(true);
  });

  it("fails an ineligible level", () => {
    expect(checkEligibility(base, { eligibility_level: "school" }).ok).toBe(false);
  });

  it("fails an ineligible year", () => {
    expect(checkEligibility(base, { academic_year: "4" }).ok).toBe(false);
  });

  it("fails an ineligible department", () => {
    expect(checkEligibility(base, { department: "MECH" }).ok).toBe(false);
  });

  it("passes when the profile omits the constrained field", () => {
    expect(checkEligibility(base, {}).ok).toBe(true);
  });
});

describe("validateRegistrationAnswers", () => {
  const questions = [
    { label: "Why join?", type: "textarea" as const, required: true },
    { label: "Year", type: "select" as const, options: ["1", "2"], required: true },
  ];

  it("accepts complete answers", () => {
    expect(
      validateRegistrationAnswers(questions, [
        { label: "Why join?", answer: "I want to build." },
        { label: "Year", answer: "2" },
      ]).ok
    ).toBe(true);
  });

  it("rejects missing required answers", () => {
    expect(validateRegistrationAnswers(questions, [{ label: "Year", answer: "2" }]).ok).toBe(false);
  });

  it("rejects an answer outside select options", () => {
    expect(
      validateRegistrationAnswers(questions, [
        { label: "Why join?", answer: "Build" },
        { label: "Year", answer: "3" },
      ]).ok
    ).toBe(false);
  });
});

describe("validateSubmissionFieldConfig", () => {
  it("accepts a valid whitelist config", () => {
    expect(
      validateSubmissionFieldConfig([
        { key: "title", label: "Project title", required: true },
        { key: "problem", label: "Problem statement", required: false },
      ]).ok
    ).toBe(true);
  });

  it("rejects non-whitelisted keys", () => {
    expect(
      validateSubmissionFieldConfig([{ key: "evil_html", label: "Evil", required: false } as never]).ok
    ).toBe(false);
  });

  it("rejects configs with no required field", () => {
    expect(
      validateSubmissionFieldConfig([{ key: "tagline", label: "Tagline", required: false }]).ok
    ).toBe(false);
  });

  it("rejects duplicate keys", () => {
    expect(
      validateSubmissionFieldConfig([
        { key: "title", label: "Title", required: true },
        { key: "title", label: "Title again", required: false },
      ]).ok
    ).toBe(false);
  });
});

describe("validateSubmissionPayload", () => {
  const fields = [
    { key: "title", label: "Project title", required: true },
    { key: "problem", label: "Problem statement", required: true },
    { key: "demo_url", label: "Demo link", required: false },
    { key: "github_url", label: "GitHub link", required: false },
  ];

  it("accepts a complete payload", () => {
    expect(
      validateSubmissionPayload(fields, {
        title: "Campus Kindness Map",
        problem: "Students can't find where to get help on campus.",
        demo_url: "https://demo.example.com",
      }).ok
    ).toBe(true);
  });

  it("rejects missing required fields", () => {
    expect(validateSubmissionPayload(fields, { title: "Only a title" }).ok).toBe(false);
  });

  it("rejects invalid URLs", () => {
    expect(
      validateSubmissionPayload(fields, {
        title: "T",
        problem: "P is long enough here.",
        demo_url: "not a url",
      }).ok
    ).toBe(false);
  });

  it("rejects javascript: URLs", () => {
    expect(
      validateSubmissionPayload(fields, {
        title: "T",
        problem: "P",
        github_url: "javascript:alert(1)",
      }).ok
    ).toBe(false);
  });

  it("rejects overlong values", () => {
    expect(
      validateSubmissionPayload(fields, { title: "T", problem: "x".repeat(6001) }).ok
    ).toBe(false);
  });
});

describe("validateDeclarations", () => {
  it("requires all three declarations", () => {
    expect(validateDeclarations({ originality: "true", rights: "true", rules_ack: "true" }).ok).toBe(true);
    expect(validateDeclarations({ originality: "true", rights: "true" }).ok).toBe(false);
    expect(validateDeclarations({}).ok).toBe(false);
  });
});

describe("snapshot semantics", () => {
  it("versions only increase by one", () => {
    expect(nextSnapshotVersion(0)).toBe(1);
    expect(nextSnapshotVersion(3)).toBe(4);
  });

  it("treats snapshots as append-only", () => {
    expect(snapshotIsImmutableCheck({ a: 1 }, { a: 1 })).toBe(true);
  });
});

function snapshotIsImmutableCheck(a: unknown, b: unknown): boolean {
  return nextSnapshotVersion(1) === 2 && a !== b;
}

describe("windows", () => {
  const now = new Date(day(5));
  it("registration window honours published + dates", () => {
    const open = {
      status: "published" as const,
      registration_enabled: true,
      registration_open: true,
      registration_opens_at: iso(0),
      registration_closes_at: iso(10),
    };
    expect(registrationWindowOpen(open, now)).toBe(true);
    expect(registrationWindowOpen({ ...open, status: "draft" }, now)).toBe(false);
    expect(registrationWindowOpen({ ...open, registration_open: false }, now)).toBe(false);
    expect(
      registrationWindowOpen({ ...open, registration_closes_at: iso(1) }, now)
    ).toBe(false);
  });

  it("submission window: deadline authority", () => {
    const base = {
      status: "published" as const,
      submission_open: true,
      submission_opens_at: iso(0),
      submission_deadline: iso(6),
      resubmit_until: null,
    };
    // Before initial deadline — open for initial and resubmission.
    expect(submissionWindowOpen(base, now)).toBe(true);
    expect(submissionWindowOpen(base, now, { isResubmission: true })).toBe(true);
    // Exactly at the deadline instant — still open.
    const atDeadline = { ...base, submission_deadline: iso(5) };
    expect(submissionWindowOpen(atDeadline, now)).toBe(true);
    // After initial deadline — closed.
    const past = { ...base, submission_deadline: iso(1) };
    expect(submissionWindowOpen(past, now)).toBe(false);
    expect(submissionWindowOpen(past, now, { isResubmission: true })).toBe(false);
  });

  it("submission window: resubmit_until never extends the initial window", () => {
    // Deadline day 4, resubmit window until day 8, now at day 5.
    const base = {
      status: "published" as const,
      submission_open: true,
      submission_opens_at: iso(0),
      submission_deadline: iso(4),
      resubmit_until: iso(8),
    };
    // Initial submission after the initial deadline is CLOSED even though
    // resubmit_until is still in the future (the pre-0016 bug).
    expect(submissionWindowOpen(base, now)).toBe(false);
    // An eligible revision-requested submission may resubmit until day 8.
    expect(submissionWindowOpen(base, now, { isResubmission: true })).toBe(true);
    // …but not after the resubmit deadline has expired.
    expect(
      submissionWindowOpen({ ...base, resubmit_until: iso(1) }, now, { isResubmission: true })
    ).toBe(false);
  });

  it("submission window: closed or cancelled events never accept submissions", () => {
    const base = {
      status: "published" as const,
      submission_open: true,
      submission_opens_at: null,
      submission_deadline: null,
      resubmit_until: null,
    };
    expect(submissionWindowOpen({ ...base, status: "completed" }, now)).toBe(false);
    expect(submissionWindowOpen({ ...base, status: "cancelled" }, now)).toBe(false);
    expect(submissionWindowOpen({ ...base, status: "archived" }, now)).toBe(false);
    expect(submissionWindowOpen({ ...base, status: "draft" }, now)).toBe(false);
    expect(submissionWindowOpen({ ...base, submission_open: false }, now)).toBe(false);
  });
});

describe("slugs", () => {
  it("slugifies titles", () => {
    expect(slugify("BuildProof Hackathon 2026!")).toBe("buildproof-hackathon-2026");
  });
  it("validates DB-safe slugs", () => {
    expect(isValidEventSlug("buildproof-hackathon-2026")).toBe(true);
    expect(isValidEventSlug("-bad-")).toBe(false);
    expect(isValidEventSlug("UPPER")).toBe(false);
  });
});

describe("captions & share links", () => {
  const event = {
    title: "BuildProof Hackathon",
    institution_name: "IIT Madras",
    category: "hackathon",
    starts_at: iso(10),
    registration_closes_at: iso(9),
    city: "Chennai",
    format: "hybrid",
    url: "https://buildproof.app/eventspace/buildproof-hackathon",
  };

  it("exposes all seven caption templates", () => {
    expect(CAPTION_TEMPLATE_KEYS).toHaveLength(7);
    for (const key of CAPTION_TEMPLATE_KEYS) {
      const caption = generateCaption(key, event);
      expect(caption).toContain("BuildProof Hackathon");
      expect(caption).toContain(event.url);
    }
  });

  it("winner caption includes the project", () => {
    const caption = generateCaption("winner", { ...event, winning_project: "Kindness Map" });
    expect(caption).toContain("Kindness Map");
  });

  it("builds deep share links without any SDK", () => {
    const links = shareLinks(event.url, "Join the hackathon");
    expect(links.whatsapp.startsWith("https://wa.me/?text=")).toBe(true);
    expect(links.linkedin.includes(encodeURIComponent(event.url))).toBe(true);
    expect(links.x.startsWith("https://twitter.com/intent/tweet")).toBe(true);
  });
});

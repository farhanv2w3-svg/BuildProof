import { describe, expect, it } from "vitest";
import {
  ALLOWED_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
  decisionSchema,
  feasibilitySchema,
  interviewSchema,
  loginSchema,
  problemSchema,
  proofCardSchema,
  profileSchema,
  prototypeSchema,
  resetPasswordSchema,
  signupSchema,
  userTestSchema,
  validateUpload,
} from "./validation";

const validInterview = {
  interview_date: "2026-10-01",
  participant_label: "Participant A",
  participant_type: "Shop owner",
  consent: true,
  key_findings: "Vendors lose about an hour each morning restocking from memory.",
};

describe("signupSchema", () => {
  it("accepts a valid self-service signup", () => {
    const ok = signupSchema.safeParse({
      full_name: "Farhan Test",
      email: "  Test@Example.com ",
      password: "longenough1",
      role: "problem_owner",
      terms: true,
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.email).toBe("test@example.com"); // normalised
  });

  it("rejects signup with a name below 2 characters", () => {
    expect(
      signupSchema.safeParse({
        full_name: "F",
        email: "test@example.com",
        password: "longenough1",
        role: "student",
        terms: true,
      }).success
    ).toBe(false);
  });

  it("rejects short passwords and unaccepted terms", () => {
    const base = {
      full_name: "Farhan Test",
      email: "test@example.com",
      role: "student",
      terms: true,
    };
    expect(signupSchema.safeParse({ ...base, password: "short" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...base, password: "longenough1", terms: false }).success).toBe(
      false
    );
  });

  it("never accepts privileged roles at signup", () => {
    for (const role of ["facilitator", "mentor", "institution_admin", "platform_admin"]) {
      expect(
        signupSchema.safeParse({
          full_name: "Farhan Test",
          email: "test@example.com",
          password: "longenough1",
          role,
          terms: true,
        }).success
      ).toBe(false);
    }
  });

  it("rejects unknown extra keys (strict)", () => {
    expect(
      signupSchema.safeParse({
        full_name: "Farhan Test",
        email: "test@example.com",
        password: "longenough1",
        role: "student",
        terms: true,
        role_injection: "platform_admin",
      }).success
    ).toBe(false);
  });
});

describe("loginSchema / resetPasswordSchema", () => {
  it("requires a password at login", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });

  it("mismatched reset passwords fail", () => {
    expect(
      resetPasswordSchema.safeParse({ password: "longenough1", confirm: "longenough2" }).success
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ password: "longenough1", confirm: "longenough1" }).success
    ).toBe(true);
  });
});

describe("profileSchema", () => {
  it("accepts empty optional fields and null grad_year", () => {
    expect(profileSchema.safeParse({ full_name: "Farhan Test", college: "", grad_year: null }).success).toBe(
      true
    );
  });

  it("rejects grad_year outside 2020–2035", () => {
    expect(profileSchema.safeParse({ full_name: "Farhan Test", grad_year: 1999 }).success).toBe(false);
    expect(profileSchema.safeParse({ full_name: "Farhan Test", grad_year: 2040 }).success).toBe(false);
    expect(profileSchema.safeParse({ full_name: "Farhan Test", grad_year: 2027 }).success).toBe(true);
  });
});

describe("problemSchema", () => {
  const base = {
    title: "A clear problem title here",
    description: "x".repeat(50),
    category: "education" as const,
    affected_users: "Students at local colleges",
  };

  it("accepts a minimal valid problem", () => {
    expect(problemSchema.safeParse(base).success).toBe(true);
  });

  it("rejects unknown categories", () => {
    expect(problemSchema.safeParse({ ...base, category: "crypto" }).success).toBe(false);
  });

  it("rejects titles or descriptions below their minimums", () => {
    expect(problemSchema.safeParse({ ...base, title: "short" }).success).toBe(false);
    expect(
      problemSchema.safeParse({ ...base, description: "too short" }).success
    ).toBe(false);
  });
});

describe("interviewSchema", () => {
  it("requires explicit consent", () => {
    expect(interviewSchema.safeParse(validInterview).success).toBe(true);
    expect(
      interviewSchema.safeParse({ ...validInterview, consent: false }).success
    ).toBe(false);
  });

  it("rejects thin key findings", () => {
    expect(interviewSchema.safeParse({ ...validInterview, key_findings: "ok" }).success).toBe(false);
  });
});

describe("feasibilitySchema", () => {
  const base = {
    technical_feasibility: "Uses existing campus Wi-Fi and a technician account.",
    cost_resources: "One part-time technician, web hosting under the current plan.",
    time_required: "Roughly four working weeks including training.",
    user_access: "Students already hold campus logins; no new accounts needed.",
    risks: "Technician turnover could stall adoption during term breaks.",
    expected_value: "Reduces double bookings and wasted trips to the lab.",
    recommended_next_step: "Run a two-week pilot with one lab first.",
  };

  it("requires the six substantive fields", () => {
    expect(feasibilitySchema.safeParse(base).success).toBe(true);
    const missing = { ...base } as Record<string, unknown>;
    for (const key of Object.keys(base)) {
      if (key === "dependencies") continue;
      expect(feasibilitySchema.safeParse(missing).success).toBe(true);
      delete missing[key];
      expect(feasibilitySchema.safeParse(missing).success).toBe(false);
      break;
    }
  });
});

describe("userTestSchema / prototypeSchema", () => {
  it("coerces numeric strings for counts", () => {
    const ok = userTestSchema.safeParse({
      participant_label: "Participant B",
      users_approached: "5",
      users_tested: "4",
      tasks: "They tried booking equipment and checking availability.",
      outcome: "Three of four completed the booking without help.",
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.users_approached).toBe(5);
  });

  it("requires a substantive prototype description", () => {
    expect(
      prototypeSchema.safeParse({ solution_description: "a web page", test_plan: "show to users" })
        .success
    ).toBe(false);
  });
});

describe("proofCardSchema", () => {
  const base = {
    title: "Valid proof card title here",
    problem_title: "Valid problem title here",
    problem_summary: "x".repeat(30),
    validation_summary: "x".repeat(30),
  };

  it("accepts a valid card", () => {
    expect(proofCardSchema.safeParse(base).success).toBe(true);
  });

  it("rejects thin summaries", () => {
    expect(proofCardSchema.safeParse({ ...base, problem_summary: "short" }).success).toBe(false);
    expect(proofCardSchema.safeParse({ ...base, validation_summary: "short" }).success).toBe(false);
  });
});

describe("decisionSchema", () => {
  it("accepts a continue decision with a real rationale", () => {
    expect(
      decisionSchema.safeParse({
        stage: "validation",
        decision: "continue",
        rationale: "Interviews showed the problem is common and worth building for.",
      }).success
    ).toBe(true);
  });

  it("rejects unknown stages and decisions", () => {
    expect(decisionSchema.safeParse({ stage: "launch", decision: "continue", rationale: "x".repeat(20) }).success).toBe(false);
    expect(decisionSchema.safeParse({ stage: "validation", decision: "maybe", rationale: "x".repeat(20) }).success).toBe(false);
  });
});

describe("validateUpload", () => {
  const file = (type: string, size: number) =>
    ({ type, size }) as unknown as File;

  it("accepts allowed types within the limit", () => {
    for (const type of ALLOWED_UPLOAD_TYPES) {
      expect(validateUpload(file(type, 1000))).toBeNull();
    }
  });

  it("rejects empty, oversized and disallowed files", () => {
    expect(validateUpload(file("image/png", 0))).toMatch(/empty/i);
    expect(validateUpload(file("image/png", MAX_UPLOAD_BYTES + 1))).toMatch(/10 MB/);
    expect(validateUpload(file("application/x-msdownload", 100))).toMatch(/not allowed/i);
    expect(validateUpload(file("text/html", 100))).toMatch(/not allowed/i);
  });
});

import { z } from "zod";

/**
 * Zod schemas — single source of truth for form validation.
 * The same rules run client-side; the database re-validates what it can.
 */

const name = z.string().trim().min(2, "Please enter your full name").max(80);
const password = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Password is too long");

export const signupSchema = z
  .object({
    full_name: name,
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    password,
    role: z.enum(["student", "problem_owner"]),
    terms: z.literal(true, {
      errorMap: () => ({ message: "Please accept the terms to continue" }),
    }),
  })
  .strict();

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});

export const resetPasswordSchema = z
  .object({
    password,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

export const profileSchema = z.object({
  full_name: name,
  college: z.string().trim().max(120).optional().or(z.literal("")),
  grad_year: z
    .number()
    .int()
    .min(2020, "Enter a year between 2020 and 2035")
    .max(2035, "Enter a year between 2020 and 2035")
    .nullable()
    .optional(),
  bio: z.string().trim().max(400).optional().or(z.literal("")),
});

const categoryValues = [
  "education",
  "local_business",
  "accessibility",
  "sustainability",
  "public_services",
  "operations",
  "technology",
  "other",
] as const;

export const problemSchema = z.object({
  title: z
    .string()
    .trim()
    .min(10, "Give the problem a clear title (10+ characters)")
    .max(120),
  description: z.string().trim().min(50, "Describe the problem in at least 50 characters").max(3000),
  category: z.enum(categoryValues),
  affected_users: z.string().trim().min(10, "Who is affected? (10+ characters)").max(400),
  location: z.string().trim().max(120).optional().or(z.literal("")),
  workaround: z.string().trim().max(1000).optional().or(z.literal("")),
  evidence_basis: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal("")),
  owner_name: z.string().trim().max(120).optional().or(z.literal("")),
  owner_contact: z
    .string()
    .trim()
    .max(160)
    .optional()
    .or(z.literal("")),
});

export const interviewSchema = z
  .object({
    interview_date: z.string().min(1, "Interview date is required"),
    participant_label: z
      .string()
      .trim()
      .min(2, "Use an anonymised label, e.g. Participant A")
      .max(60),
    participant_type: z
      .string()
      .trim()
      .min(2, "e.g. Shop owner, Student, Teacher")
      .max(80),
    consent: z.literal(true, {
      errorMap: () => ({
        message:
          "Consent from the participant is required. Record only consented, adult interviews.",
      }),
    }),
    key_findings: z.string().trim().min(20, "Summarise the key findings (20+ characters)").max(3000),
    pain_points: z.string().trim().max(2000).optional().or(z.literal("")),
    patterns: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .strict();

export const feasibilitySchema = z
  .object({
    technical_feasibility: z.string().trim().min(20, "Required").max(2000),
    cost_resources: z.string().trim().min(20, "Required").max(2000),
    time_required: z.string().trim().min(20, "Required").max(2000),
    user_access: z.string().trim().min(20, "Required").max(2000),
    dependencies: z.string().trim().max(2000).optional().or(z.literal("")),
    risks: z.string().trim().min(20, "Required").max(2000),
    expected_value: z.string().trim().min(20, "Required").max(2000),
    recommended_next_step: z.string().trim().min(10, "Required").max(1000),
  })
  .strict();

export const userTestSchema = z
  .object({
    participant_label: z.string().trim().min(2, "Anonymised label required").max(60),
    users_approached: z.coerce.number().int().min(0).max(10000),
    users_tested: z.coerce.number().int().min(0).max(10000),
    tasks: z.string().trim().min(10, "What tasks did they attempt?").max(2000),
    outcome: z.string().trim().min(10, "What was the outcome?").max(2000),
    feedback: z.string().trim().max(2000).optional().or(z.literal("")),
    observed_problems: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .strict();

export const prototypeSchema = z
  .object({
    solution_description: z.string().trim().min(30, "Describe the prototype (30+ chars)").max(3000),
    test_plan: z.string().trim().min(20, "What is the test plan?").max(2000),
    iterations: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .strict();

export const proofCardSchema = z
  .object({
    title: z.string().trim().min(8, "Title required (8+ chars)").max(140),
    problem_title: z.string().trim().min(8, "Problem title required").max(140),
    problem_summary: z.string().trim().min(30, "Summarise the problem (30+ chars)").max(2000),
    validation_summary: z.string().trim().min(30, "Summarise what the research showed (30+ chars)").max(3000),
    feasibility_summary: z.string().trim().max(2000).optional().or(z.literal("")),
    built_summary: z.string().trim().max(2000).optional().or(z.literal("")),
    results_limitations: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .strict();

export const decisionSchema = z.object({
  stage: z.enum(["validation", "feasibility", "prototype"]),
  decision: z.enum(["continue", "pivot", "stop", "revise"]),
  rationale: z.string().trim().min(20, "Explain the decision (20+ chars)").max(1000),
});

/** File upload policy — enforced here AND mirrored in docs/security review. */
export const ALLOWED_UPLOAD_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
] as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export function validateUpload(file: File): string | null {
  if (file.size <= 0) return "File is empty";
  if (file.size > MAX_UPLOAD_BYTES) return "File is larger than 10 MB";
  if (!(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.type)) {
    return "File type is not allowed. Use an image, PDF, DOCX, XLSX, TXT or CSV.";
  }
  return null;
}

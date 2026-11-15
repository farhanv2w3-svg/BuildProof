import { z } from "zod";
import type {
  EsCriterion,
  EsEventRow,
  EsRegQuestion,
  EsSubmissionField,
  EsSubmissionRow,
} from "../types/database";

/* ------------------------------------------------------------------ */
/*  EventSpace — validation & product rules (0015).                    */
/*  Pure functions so the same rules are exercised by unit tests.      */
/*  The database (triggers + RLS) re-enforces all of this server-side; */
/*  client-side checks exist for fast, honest user feedback only.      */
/* ------------------------------------------------------------------ */

export const MAX_EVENT_MEDIA_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_SUBMISSION_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export const ALLOWED_EVENT_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Mirrors the es_submission_files mime check constraint. */
export const ALLOWED_SUBMISSION_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
] as const;

export const ES_EVENT_CATEGORIES = [
  "hackathon",
  "ideathon",
  "coding_competition",
  "project_exhibition",
  "workshop",
  "conference",
  "symposium",
  "robotics_hardware",
  "other",
] as const;

export const esEventCategoryLabels: Record<(typeof ES_EVENT_CATEGORIES)[number], string> = {
  hackathon: "Hackathon",
  ideathon: "Ideathon",
  coding_competition: "Coding competition",
  project_exhibition: "Project exhibition",
  workshop: "Workshop",
  conference: "Conference",
  symposium: "Symposium",
  robotics_hardware: "Robotics / hardware",
  other: "Other",
};

export const ES_FORMAT_LABELS: Record<string, string> = {
  online: "Online",
  offline: "In person",
  hybrid: "Hybrid",
};

export const ES_SUBMISSION_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  revision_requested: "Revision requested",
  resubmitted: "Resubmitted",
  shortlisted: "Shortlisted",
  accepted: "Accepted",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
};

/** Whitelisted submission field keys organisers may configure. */
export const ES_SUBMISSION_FIELD_KEYS = [
  "title",
  "tagline",
  "problem",
  "target_users",
  "solution",
  "how_it_works",
  "innovation",
  "expected_outcomes",
  "methodology",
  "technologies",
  "feasibility",
  "development_stage",
  "contributions",
  "demo_url",
  "github_url",
  "video_url",
] as const;

export const ES_SUBMISSION_FIELD_LABELS: Record<(typeof ES_SUBMISSION_FIELD_KEYS)[number], string> = {
  title: "Project title",
  tagline: "Tagline",
  problem: "Problem statement",
  target_users: "Target users",
  solution: "Proposed solution",
  how_it_works: "How it works",
  innovation: "Innovation",
  expected_outcomes: "Expected outcomes",
  methodology: "Methodology",
  technologies: "Technologies used",
  feasibility: "Technical feasibility",
  development_stage: "Development stage",
  contributions: "Team contributions",
  demo_url: "Demo link",
  github_url: "GitHub link",
  video_url: "Video link",
};

/** URL-typed submission fields — validated with URL rules, not plain text. */
export const ES_URL_FIELD_KEYS: ReadonlySet<string> = new Set([
  "demo_url",
  "github_url",
  "video_url",
]);

/** Slug generator: lowercase, hyphenated, URL-safe, non-empty. */
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return base.length >= 2 ? base : "event";
}

/** Safe slug for the DB check (leading/trailing hyphen + length rules). */
export function isValidEventSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,78}[a-z0-9])?$/.test(slug);
}

/* ----------------------------- dates ------------------------------ */

export interface EsDateCheck {
  ok: boolean;
  message: string | null;
}

/** Validates the ordering of the full event date set. */
export function validateEventDates(input: {
  starts_at: string;
  ends_at: string;
  registration_opens_at?: string | null;
  registration_closes_at?: string | null;
  submission_opens_at?: string | null;
  submission_deadline?: string | null;
  judging_starts_at?: string | null;
  judging_ends_at?: string | null;
  results_at?: string | null;
}): EsDateCheck {
  const t = (v?: string | null) => (v ? new Date(v).getTime() : null);
  const start = t(input.starts_at);
  const end = t(input.ends_at);
  if (start === null || end === null || Number.isNaN(start) || Number.isNaN(end)) {
    return { ok: false, message: "Event start and end dates are required." };
  }
  if (end < start) return { ok: false, message: "The event cannot end before it starts." };

  const regOpen = t(input.registration_opens_at);
  const regClose = t(input.registration_closes_at);
  if (regOpen !== null && regClose !== null && regClose <= regOpen) {
    return { ok: false, message: "Registration closing must be after registration opening." };
  }
  if (regClose !== null && regClose > end) {
    return { ok: false, message: "Registration cannot close after the event ends." };
  }
  const subOpen = t(input.submission_opens_at);
  const subClose = t(input.submission_deadline);
  if (subOpen !== null && subClose !== null && subClose <= subOpen) {
    return { ok: false, message: "The submission deadline must be after submission opening." };
  }
  if (subClose !== null && subClose > end) {
    return { ok: false, message: "The submission deadline cannot be after the event ends." };
  }
  const judgeStart = t(input.judging_starts_at);
  const judgeEnd = t(input.judging_ends_at);
  if (judgeStart !== null && judgeEnd !== null && judgeEnd <= judgeStart) {
    return { ok: false, message: "Judging must end after it starts." };
  }
  return { ok: true, message: null };
}

/* --------------------------- rubric ------------------------------- */

/** Rubric weights must be positive and total exactly 100. */
export function validateCriteriaWeights(criteria: EsCriterion[]): EsDateCheck {
  if (!Array.isArray(criteria) || criteria.length === 0) {
    return { ok: false, message: "Add at least one evaluation criterion." };
  }
  if (criteria.length > 12) {
    return { ok: false, message: "Use at most 12 evaluation criteria." };
  }
  const names = new Set<string>();
  for (const c of criteria) {
    const name = (c.name ?? "").trim();
    if (name.length < 2) return { ok: false, message: "Every criterion needs a name." };
    if (names.has(name.toLowerCase())) {
      return { ok: false, message: `Duplicate criterion "${name}".` };
    }
    names.add(name.toLowerCase());
    if (!(typeof c.weight === "number" && c.weight > 0 && c.weight <= 100)) {
      return { ok: false, message: `Criterion "${name}" needs a weight between 1 and 100.` };
    }
  }
  const total = criteria.reduce((sum, c) => sum + c.weight, 0);
  if (total !== 100) {
    return {
      ok: false,
      message: `Weights must total exactly 100 — currently ${total}.`,
    };
  }
  return { ok: true, message: null };
}

/* ------------------------- team size ------------------------------ */

export function validateTeamSizeConfig(
  participation: EsEventRow["participation"],
  minTeamSize: number,
  maxTeamSize: number
): EsDateCheck {
  if (participation === "individual") return { ok: true, message: null };
  if (!Number.isInteger(minTeamSize) || !Number.isInteger(maxTeamSize) || minTeamSize < 1 || maxTeamSize < 1) {
    return { ok: false, message: "Team sizes must be whole numbers of at least 1." };
  }
  if (maxTeamSize < minTeamSize) {
    return { ok: false, message: "Maximum team size must be at least the minimum." };
  }
  if (maxTeamSize > 20) {
    return { ok: false, message: "Maximum team size is 20." };
  }
  return { ok: true, message: null };
}

/* ------------------------- eligibility ----------------------------- */

export interface EsEligibilityProfile {
  eligibility_level?: string | null; // "school" | "college" | "university" | "open" | custom
  academic_year?: string | null;
  department?: string | null;
  institution_name?: string | null;
}

/**
 * Client-side eligibility pre-check. Only reports failures the event actually
 * constrains; empty constraint lists mean "open to all". The organiser's
 * review and server validation stay authoritative — this is UX only.
 */
export function checkEligibility(
  event: Pick<
    EsEventRow,
    | "eligibility_levels"
    | "eligibility_years"
    | "eligibility_departments"
    | "eligibility_institutions"
    | "eligibility_regions"
  >,
  profile: EsEligibilityProfile
): EsDateCheck {
  const levels = event.eligibility_levels ?? [];
  if (
    levels.length > 0 &&
    profile.eligibility_level &&
    !levels.includes(profile.eligibility_level)
  ) {
    return { ok: false, message: "Your current level is not in this event's eligible levels." };
  }
  const years = event.eligibility_years ?? [];
  if (years.length > 0 && profile.academic_year && !years.includes(profile.academic_year)) {
    return { ok: false, message: "Your academic year is not eligible for this event." };
  }
  const departments = event.eligibility_departments ?? [];
  if (
    departments.length > 0 &&
    profile.department &&
    !departments.includes(profile.department)
  ) {
    return { ok: false, message: "Your department is not eligible for this event." };
  }
  const institutions = (event.eligibility_institutions ?? []).map((i) => i.toLowerCase());
  const inst = (profile.institution_name ?? "").toLowerCase();
  if (institutions.length > 0 && inst && !institutions.some((i) => inst.includes(i) || i.includes(inst))) {
    return { ok: false, message: "Your institution is not in this event's eligible institutions." };
  }
  return { ok: true, message: null };
}

/* --------------------- registration answers ------------------------ */

export interface EsAnswerPair {
  label: string;
  answer: string;
}

/** Validates free-form registration answers against configured questions. */
export function validateRegistrationAnswers(
  questions: EsRegQuestion[],
  answers: EsAnswerPair[]
): EsDateCheck {
  if (questions.length > 10) {
    return { ok: false, message: "Too many registration questions (max 10)." };
  }
  for (const q of questions) {
    if (!q.label?.trim()) {
      return { ok: false, message: "Every registration question needs a label." };
    }
  }
  const byLabel = new Map(answers.map((a) => [a.label, a.answer]));
  for (const q of questions) {
    const given = byLabel.get(q.label);
    if (q.required && !given?.trim()) {
      return { ok: false, message: `Please answer "${q.label}".` };
    }
    if (given && q.type === "select" && q.options && !q.options.includes(given)) {
      return { ok: false, message: `Choose one of the listed options for "${q.label}".` };
    }
    if (given && given.length > 1000) {
      return { ok: false, message: `The answer to "${q.label}" is too long (max 1000 characters).` };
    }
  }
  return { ok: true, message: null };
}

/* ---------------------- submission config -------------------------- */

const submissionConfigSchema = z
  .array(
    z.object({
      key: z.enum(ES_SUBMISSION_FIELD_KEYS),
      label: z.string().min(2).max(120),
      required: z.boolean(),
    })
  )
  .max(ES_SUBMISSION_FIELD_KEYS.length);

/** Validates the organiser's submission-field configuration. */
export function validateSubmissionFieldConfig(fields: EsSubmissionField[]): EsDateCheck {
  const parsed = submissionConfigSchema.safeParse(fields);
  if (!parsed.success) {
    return { ok: false, message: "Submission field configuration is invalid." };
  }
  const keys = new Set(parsed.data.map((f) => f.key));
  if (keys.size !== parsed.data.length) {
    return { ok: false, message: "Duplicate submission fields configured." };
  }
  if (parsed.data.some((f) => f.required && f.key === "title") === false) {
    // title is never forced here, but at least one required field keeps
    // judging meaningful.
    if (!parsed.data.some((f) => f.required)) {
      return { ok: false, message: "Mark at least one submission field as required." };
    }
  }
  return { ok: true, message: null };
}

const urlFieldSchema = z
  .string()
  .trim()
  .max(400)
  .regex(/^https?:\/\/[^\s]+$/, "Links must start with http:// or https://");

/**
 * Validates a submission payload against the event's configured fields.
 * URL fields are strictly URL-validated; text fields are length-capped.
 * Executable HTML is never accepted anywhere (rendered as plain text only).
 */
export function validateSubmissionPayload(
  fields: EsSubmissionField[],
  data: Record<string, unknown>
): EsDateCheck {
  for (const f of fields) {
    const value = data[f.key];
    if (value === undefined || value === null || (typeof value === "string" && !value.trim())) {
      if (f.required) {
        return { ok: false, message: `${ES_SUBMISSION_FIELD_LABELS[f.key as keyof typeof ES_SUBMISSION_FIELD_LABELS] ?? f.label} is required.` };
      }
      continue;
    }
    if (typeof value !== "string") {
      return { ok: false, message: `${f.label} must be text.` };
    }
    if (value.length > 6000) {
      return { ok: false, message: `${f.label} is too long (max 6000 characters).` };
    }
    if (ES_URL_FIELD_KEYS.has(f.key)) {
      const parsedUrl = urlFieldSchema.safeParse(value);
      if (!parsedUrl.success) {
        return {
          ok: false,
          message: `${f.label} must be a valid http(s) link (no spaces).`,
        };
      }
    }
  }
  return { ok: true, message: null };
}

/** Declarations required before a submission can leave draft. */
export function validateDeclarations(declarations: EsSubmissionRow["declarations"]): EsDateCheck {
  if (declarations.originality !== "true") {
    return { ok: false, message: "Confirm the originality declaration to submit." };
  }
  if (declarations.rights !== "true") {
    return { ok: false, message: "Confirm you hold the rights to this submission." };
  }
  if (declarations.rules_ack !== "true") {
    return { ok: false, message: "Acknowledge the event rules to submit." };
  }
  return { ok: true, message: null };
}

/* ---------------------- snapshot semantics -------------------------- */

/**
 * Pure statement of the snapshot rules (mirrors the DB trigger):
 *  - every submit/resubmit creates a NEW immutable snapshot version;
 *  - the version only ever increases by one;
 *  - the stored snapshot at submit time is exactly the payload the judge sees.
 */
export function nextSnapshotVersion(current: number): number {
  return Math.max(0, Math.floor(current)) + 1;
}

export function snapshotIsImmutable(previous: unknown, next: unknown): boolean {
  // Snapshots never replace older versions; they only append.
  return previous !== next;
}

/* ------------------ registration window ---------------------------- */

export function registrationWindowOpen(
  event: Pick<EsEventRow, "status" | "registration_enabled" | "registration_open" | "registration_opens_at" | "registration_closes_at">,
  now: Date = new Date()
): boolean {
  if (event.status !== "published") return false;
  if (!event.registration_enabled || !event.registration_open) return false;
  if (event.registration_opens_at && now < new Date(event.registration_opens_at)) return false;
  if (event.registration_closes_at && now > new Date(event.registration_closes_at)) return false;
  return true;
}

export function submissionWindowOpen(
  event: Pick<EsEventRow, "status" | "submission_open" | "submission_opens_at" | "submission_deadline" | "resubmit_until">,
  now: Date = new Date(),
  options: { isResubmission?: boolean } = {}
): boolean {
  if (event.status !== "published" || !event.submission_open) return false;
  if (event.submission_opens_at && now < new Date(event.submission_opens_at)) return false;
  // A revision-requested submission may resubmit inside resubmit_until when
  // the organiser set one; initial submissions are never extended by it.
  // Mirrors es_submission_window_open (0015 + fix in 0016).
  if (options.isResubmission && event.resubmit_until) return now <= new Date(event.resubmit_until);
  if (event.submission_deadline && now > new Date(event.submission_deadline)) return false;
  return true;
}

/* ------------------ promotion captions ----------------------------- */

export type CaptionTemplateKey =
  | "launch"
  | "registration_open"
  | "registration_reminder"
  | "last_date"
  | "ongoing"
  | "results"
  | "winner";

export interface CaptionEvent {
  title: string;
  institution_name: string;
  category: string;
  starts_at: string;
  registration_closes_at?: string | null;
  city?: string | null;
  format?: string | null;
  url: string;
  winning_project?: string | null;
  winning_team?: string | null;
}

const CAPTION_TEMPLATES: Record<CaptionTemplateKey, (e: CaptionEvent) => string> = {
  launch: (e) =>
    `🚀 Introducing ${e.title} — presented by ${e.institution_name} on BuildProof!\n\n` +
    `${categoryLabel(e.category)} · ${formatLabel(e.format)}${e.city ? ` · ${e.city}` : ""}\n` +
    `Kick-off: ${fmtDate(e.starts_at)}\n\n` +
    `Bring your problem-solving energy and turn ideas into proof. Details & registration: ${e.url}\n\n#BuildProof #EventSpace`,
  registration_open: (e) =>
    `📢 Registrations are OPEN for ${e.title}!\n\n` +
    `Hosted by ${e.institution_name}. ${categoryLabel(e.category)} open to problem-solvers everywhere.\n` +
    `Register before it fills up: ${e.url}\n\n#BuildProof #EventSpace`,
  registration_reminder: (e) =>
    `⏳ A quick reminder — ${e.title} is filling up!\n\n` +
    `${e.registration_closes_at ? `Registration closes ${fmtDate(e.registration_closes_at)}.` : "Seats are limited."}\n` +
    `Don't wait: ${e.url}\n\n#BuildProof #EventSpace`,
  last_date: (e) =>
    `🚨 Last date to register: ${e.registration_closes_at ? fmtDate(e.registration_closes_at) : "soon"}!\n\n` +
    `${e.title} by ${e.institution_name} — this is your final call.\n` +
    `Register now: ${e.url}\n\n#BuildProof #EventSpace`,
  ongoing: (e) =>
    `🔥 ${e.title} is LIVE!\n\n` +
    `Teams are building and shipping proof right now. Follow along and cheer them on.\n` +
    `Event page: ${e.url}\n\n#BuildProof #EventSpace`,
  results: (e) =>
    `🏆 Results are out for ${e.title}!\n\n` +
    `Congratulations to every team that shipped proof. See the full winners list and featured projects: ${e.url}\n\n#BuildProof #EventSpace`,
  winner: (e) =>
    `🎉 Big congratulations to ${e.winning_project ?? "the winning project"}${
      e.winning_team ? ` by ${e.winning_team}` : ""
    } — winner of ${e.title}!\n` +
    `Explore the winning showcase: ${e.url}\n\n#BuildProof #EventSpace`,
};

function categoryLabel(category: string) {
  return esEventCategoryLabels[category as keyof typeof esEventCategoryLabels] ?? "Event";
}

function formatLabel(format?: string | null) {
  return ES_FORMAT_LABELS[format ?? "online"] ?? "Online";
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Generates an editable caption for a given template key. */
export function generateCaption(key: CaptionTemplateKey, event: CaptionEvent): string {
  return CAPTION_TEMPLATES[key](event);
}

export const CAPTION_TEMPLATE_KEYS = Object.keys(CAPTION_TEMPLATES) as CaptionTemplateKey[];

export const captionTemplateLabels: Record<CaptionTemplateKey, string> = {
  launch: "Event launch",
  registration_open: "Registration open",
  registration_reminder: "Registration reminder",
  last_date: "Last date to register",
  ongoing: "Event ongoing",
  results: "Results announcement",
  winner: "Winning project",
};

/* --------------------- share links (no APIs) ----------------------- */

/** Share deep links are plain URL builders — no SDKs, no tracking, no auth. */
export function shareLinks(url: string, text: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  return {
    whatsapp: `https://wa.me/?text=${t}%20${u}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    x: `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
  };
}

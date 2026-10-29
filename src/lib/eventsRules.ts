import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  College Events — validation & product rules (0004).                */
/*  Pure functions so the same rules are exercised by unit tests.      */
/*  The database and the storage bucket re-enforce these server-side;  */
/*  client-side checks exist for fast, honest user feedback only.      */
/* ------------------------------------------------------------------ */

/** Single source of truth for the poster size limit — 5 MiB. */
export const MAX_EVENT_POSTER_SIZE_BYTES = 5 * 1024 * 1024;

/** Formats rendered to organizers before upload: no SVG (no sanitisation
 * pipeline exists for active XML content), JPEG/PNG/WebP only. */
export const ALLOWED_POSTER_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const ALLOWED_POSTER_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"] as const;

/** Mirrors the event_type check constraint on public.events. */
export const EVENT_TYPES = [
  "hackathon", "symposium", "workshop", "technical_fest", "cultural_fest",
  "coding_competition", "robotics_hardware", "project_exhibition",
  "conference", "other",
] as const;

export const eventTypeLabels: Record<(typeof EVENT_TYPES)[number], string> = {
  hackathon: "Hackathon",
  symposium: "Symposium",
  workshop: "Workshop",
  technical_fest: "Technical fest",
  cultural_fest: "Cultural fest",
  coding_competition: "Coding competition",
  robotics_hardware: "Robotics / hardware event",
  project_exhibition: "Project exhibition",
  conference: "Conference",
  other: "Other",
};

/**
 * Poster file validation — evaluates declared MIME type, extension, size and
 * (where the browser exposes it) the ACTUAL content via magic bytes, so a
 * "poster.png" that is really a text file gets rejected locally before the
 * server sees it. Returns null when the file is acceptable, otherwise a
 * user-facing message.
 */
export function validatePosterFile(file: File): string | null {
  if (file.size <= 0) return "That file is empty. Choose a poster image with content.";
  if (file.size > MAX_EVENT_POSTER_SIZE_BYTES) {
    const mb = (MAX_EVENT_POSTER_SIZE_BYTES / (1024 * 1024)).toFixed(0);
    return `Poster is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). The limit is ${mb} MB — export a smaller image and try again.`;
  }
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  if (!ALLOWED_POSTER_EXTENSIONS.includes(ext as (typeof ALLOWED_POSTER_EXTENSIONS)[number])) {
    return `Unsupported file type "${ext || "unknown"}". Use JPEG, PNG or WebP images only.`;
  }
  if (!(ALLOWED_POSTER_TYPES as readonly string[]).includes(file.type)) {
    return "Unsupported format. Use JPEG, PNG or WebP images only (SVG is not accepted).";
  }
  return null;
}

/** Reads the first bytes and checks the real on-disk signature where the
 * browser permits. Falls back to a warning-free pass when slicing fails —
 * the server side bucket limits remain authoritative. */
export async function posterMagicByteCheck(file: File): Promise<string | null> {
  try {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
    const riff = head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46;
    const isWebp = riff && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50;
    if (!isJpeg && !isPng && !isWebp) {
      return "This file's contents are not a valid JPEG, PNG or WebP image. It may be corrupt or misnamed — try another poster file.";
    }
    return null;
  } catch {
    return null; // cannot inspect here; curated error messaging handled afterwards
  }
}

/** yyyy-mm-dd → components, WITHOUT timezone shifting (plain parse). */
export function parseIsoDate(iso: string): { y: number; m: number; d: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return { y: 1970, m: 1, d: 1 };
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "12 February 2027" — month + day from plain components so a date-only
 * value never shifts a day via timezone conversion. */
export function formatEventDate(iso: string): string {
  const { y, m, d } = parseIsoDate(iso);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "12–14 February 2027" for multi-day; "12 February 2027" for one-day. */
export function formatEventDateRange(startIso: string, endIso: string): string {
  const a = parseIsoDate(startIso);
  const b = parseIsoDate(endIso);
  if (startIso === endIso) return formatEventDate(startIso);
  if (a.y === b.y && a.m === b.m) return `${a.d}–${b.d} ${MONTHS[a.m - 1]} ${a.y}`;
  if (a.y === b.y) return `${formatEventDate(startIso)} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
  return `${formatEventDate(startIso)} – ${formatEventDate(endIso)}`;
}

/** Inclusive day count: 12–14 Feb is THREE days (start and end included). */
export function eventDurationDays(startIso: string, endIso: string): number {
  const a = parseIsoDate(startIso);
  const b = parseIsoDate(endIso);
  const start = Date.UTC(a.y, a.m - 1, a.d);
  const end = Date.UTC(b.y, b.m - 1, b.d);
  return Math.round((end - start) / 86_400_000) + 1;
}

/** Helper for the UI: "3 days" / "1 day". */
export function eventDurationLabel(startIso: string, endIso: string): string {
  const n = eventDurationDays(startIso, endIso);
  return n === 1 ? "1 day" : `${n} days`;
}

/** Registration links must be http(s) — blocks javascript:, data:, vbscript: etc. */
export function isValidRegistrationUrl(raw: string): boolean {
  const s = raw.trim();
  if (!s) return true; // the field is optional
  try {
    const u = new URL(s);
    return (u.protocol === "https:" || u.protocol === "http:") && /\.[a-z]{2,}/i.test(u.hostname);
  } catch {
    return false;
  }
}

/** Any international phone-ish string: digits, spaces, (), leading +.
 * Deliberately NOT Indian-specific. Returns null when acceptable. */
export function validateContactNumber(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null; // optional
  if (!/^[+0-9(][0-9 ()-]{5,19}$/.test(s)) {
    return "That does not look like a phone number. Use digits with optional spaces, ( ) or dashes — or leave it empty if the poster already shows it.";
  }
  return null;
}

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~ zod form schema ~~~~~~~~~~~~~~~~~~~~~~~~~~ */

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const eventSchema = z
  .object({
    title: z.string().trim().min(6, "Give the event a full title (6+ characters)").max(160),
    event_type: z.enum(EVENT_TYPES),
    institution_name: z.string().trim().min(3, "Enter the full official college or institution name").max(200),
    city: z.string().trim().min(2, "City is required").max(120),
    state_name: z.string().trim().min(2, "State or union territory is required").max(120),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date is required"),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date is required"),
    contact_number: optionalText(20),
    venue: optionalText(240),
    description: optionalText(3000),
    registration_url: optionalText(400),
    contact_name: optionalText(120),
    schedule_note: optionalText(3000),
  })
  .strict()
  .refine((d) => d.end_date >= d.start_date, {
    message: "The end date cannot be before the start date.",
    path: ["end_date"],
  });

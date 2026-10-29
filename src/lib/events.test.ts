import { describe, expect, it } from "vitest";
import {
  MAX_EVENT_POSTER_SIZE_BYTES,
  validatePosterFile,
  posterMagicByteCheck,
  parseIsoDate,
  formatEventDate,
  formatEventDateRange,
  eventDurationDays,
  eventDurationLabel,
  isValidRegistrationUrl,
  validateContactNumber,
  eventSchema,
} from "./eventsRules";
import { demoEvent } from "./eventsDemo";

/* ------------------------------------------------------------------ */
/*  College Events rules — the client-side restatement of rules the    */
/*  database and the storage bucket enforce authoritatively.           */
/* ------------------------------------------------------------------ */

const mib = 1024 * 1024;

function fakeFile(opts: { name: string; type: string; size: number; bytes?: number[] }): File {
  const content = new Uint8Array(Math.max(1, opts.bytes?.length ?? Math.min(opts.size, 16)));
  if (opts.bytes) content.set(opts.bytes);
  else if (opts.size > 0) content[0] = 0xff; // arbitrary non-empty head
  const f = new File([content], opts.name, { type: opts.type });
  Object.defineProperty(f, "size", { value: opts.size });
  return f;
}

describe("poster size limit", () => {
  it("max is exactly 5 MiB (5 × 1024 × 1024)", () => {
    expect(MAX_EVENT_POSTER_SIZE_BYTES).toBe(5_242_880);
  });

  it("accepts a file at exactly the limit", () => {
    const f = fakeFile({ name: "poster.jpg", type: "image/jpeg", size: MAX_EVENT_POSTER_SIZE_BYTES });
    expect(validatePosterFile(f)).toBeNull();
  });

  it("rejects a file one byte over the limit", () => {
    const f = fakeFile({ name: "poster.jpg", type: "image/jpeg", size: MAX_EVENT_POSTER_SIZE_BYTES + 1 });
    const msg = validatePosterFile(f);
    expect(msg).toMatch(/too large|5 MB/);
  });

  it("rejects zero-byte files", () => {
    const f = fakeFile({ name: "poster.png", type: "image/png", size: 0 });
    expect(validatePosterFile(f)).toMatch(/empty/i);
  });
});

describe("poster type checks", () => {
  it("accepts jpeg, png and webp", () => {
    for (const [name, type] of [["a.jpg", "image/jpeg"], ["b.png", "image/png"], ["c.webp", "image/webp"]] as [string, string][]) {
      expect(validatePosterFile(fakeFile({ name, type, size: mib }))).toBeNull();
    }
  });

  it("rejects SVG uploads even with an image/svg+xml MIME declared", () => {
    const msg = validatePosterFile(fakeFile({ name: "poster.svg", type: "image/svg+xml", size: mib }));
    expect(msg).toBeTruthy();
    expect(msg!).toMatch(/Unsupported/i);
  });

  it("rejects a misleading extension (.jpg naming an svg)", () => {
    const msg = validatePosterFile(fakeFile({ name: "poster.jpg", type: "image/svg+xml", size: mib }));
    expect(msg).toMatch(/format|JPEG/i);
  });

  it("rejects an allowed extension with a wrong declared MIME (e.g. octet-stream)", () => {
    const msg = validatePosterFile(fakeFile({ name: "poster.png", type: "application/octet-stream", size: mib }));
    expect(msg).toMatch(/format/i);
  });

  it("rejects files without an extension", () => {
    const msg = validatePosterFile(fakeFile({ name: "poster", type: "image/png", size: mib }));
    expect(msg).toMatch(/Unsupported/i);
  });
});

describe("poster magic bytes (real content)", () => {
  it("accepts a real JPEG head", async () => {
    const f = fakeFile({ name: "a.jpg", type: "image/jpeg", size: 10, bytes: [0xff, 0xd8, 0xff, 0xe0] });
    expect(await posterMagicByteCheck(f)).toBeNull();
  });

  it("accepts a real PNG head", async () => {
    const f = fakeFile({ name: "a.png", type: "image/png", size: 10, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] });
    expect(await posterMagicByteCheck(f)).toBeNull();
  });

  it("accepts a real WebP head (RIFF....WEBP)", async () => {
    const f = fakeFile({ name: "a.webp", type: "image/webp", size: 16, bytes: [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50] });
    expect(await posterMagicByteCheck(f)).toBeNull();
  });

  it("rejects a text file named .png (misleading extension/MIME)", async () => {
    const bytes = [..."hello world"].map((c) => c.charCodeAt(0));
    const f = fakeFile({ name: "poster.png", type: "image/png", size: 11, bytes });
    const msg = await posterMagicByteCheck(f);
    expect(msg).toBeTruthy();
    expect(msg!).toMatch(/not a valid/i);
  });
});

describe("date formatting (timezone-safe)", () => {
  it("parses plain components without Date object shifting", () => {
    expect(parseIsoDate("2027-02-12")).toEqual({ y: 2027, m: 2, d: 12 });
  });

  it("formats a one-day event", () => {
    expect(formatEventDate("2027-02-12")).toBe("12 February 2027");
  });

  it("formats a same-month multi-day range", () => {
    expect(formatEventDateRange("2027-02-12", "2027-02-14")).toBe("12–14 February 2027");
  });

  it("formats a cross-month range", () => {
    expect(formatEventDateRange("2027-01-30", "2027-02-02")).toBe("30 January 2027 – 2 February 2027");
  });

  it("formats a cross-year range", () => {
    expect(formatEventDateRange("2026-12-28", "2027-01-02")).toBe("28 December 2026 – 2 January 2027");
  });
});

describe("duration days (inclusive of start and end)", () => {
  it("12–14 February is 3 days", () => {
    expect(eventDurationDays("2027-02-12", "2027-02-14")).toBe(3);
    expect(eventDurationLabel("2027-02-12", "2027-02-14")).toBe("3 days");
  });

  it("a one-day event is 1 day", () => {
    expect(eventDurationDays("2027-02-12", "2027-02-12")).toBe(1);
    expect(eventDurationLabel("2027-02-12", "2027-02-12")).toBe("1 day");
  });

  it("spans months and years correctly", () => {
    expect(eventDurationDays("2027-01-30", "2027-02-02")).toBe(4);
    expect(eventDurationDays("2026-12-31", "2027-01-02")).toBe(3);
  });
});

describe("registration URL scheme safety", () => {
  it("accepts http and https links", () => {
    expect(isValidRegistrationUrl("https://college.edu/event")).toBe(true);
    expect(isValidRegistrationUrl("http://college.edu/hackathon")).toBe(true);
  });

  it("blocks javascript: and data: and other unsafe schemes", () => {
    expect(isValidRegistrationUrl("javascript:alert(1)")).toBe(false);
    expect(isValidRegistrationUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isValidRegistrationUrl("vbscript:msgbox")).toBe(false);
    expect(isValidRegistrationUrl("file:///C:/etc")).toBe(false);
  });

  it("rejects a bare word without a real hostname dot", () => {
    expect(isValidRegistrationUrl("https://localhost")).toBe(false);
    expect(isValidRegistrationUrl("not a url")).toBe(false);
  });

  it("allows empty (the field is optional)", () => {
    expect(isValidRegistrationUrl("")).toBe(true);
    expect(isValidRegistrationUrl("   ")).toBe(true);
  });
});

describe("contact number (international, optional)", () => {
  it("accepts common formats", () => {
    for (const n of ["+91 98765 43210", "044 2230 1234", "(011) 2345-6789", "9876543210"]) {
      expect(validateContactNumber(n)).toBeNull();
    }
  });

  it("rejects letters and junk", () => {
    expect(validateContactNumber("abc")).toBeTruthy();
    expect(validateContactNumber("98765 43210 ext 22")).toBeTruthy();
  });

  it("rejects too-short values", () => {
    expect(validateContactNumber("123")).toBeTruthy();
  });

  it("allows empty (the field is optional)", () => {
    expect(validateContactNumber("")).toBeNull();
    expect(validateContactNumber("   ")).toBeNull();
  });
});

describe("event schema", () => {
  const valid = {
    title: "National Student Innovation Hackathon 2027",
    event_type: "hackathon",
    institution_name: "Example Institute of Technology",
    city: "Chennai",
    state_name: "Tamil Nadu",
    start_date: "2027-02-12",
    end_date: "2027-02-13",
  };

  it("accepts a complete valid submission", () => {
    expect(eventSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts equal start and end dates (one-day events)", () => {
    expect(eventSchema.safeParse({ ...valid, end_date: "2027-02-12" }).success).toBe(true);
  });

  it("rejects an end date before the start date", () => {
    const r = eventSchema.safeParse({ ...valid, start_date: "2027-02-14", end_date: "2027-02-12" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("end_date"))).toBe(true);
    }
  });

  it("rejects a too-short title and unknown enum values", () => {
    expect(eventSchema.safeParse({ ...valid, title: "Fest" }).success).toBe(false);
    expect(eventSchema.safeParse({ ...valid, event_type: "malware_deployment" }).success).toBe(false);
  });
});

describe("demo event safety", () => {
  it("is unmistakably labelled as a demo everywhere it matters", () => {
    expect(demoEvent.title).toContain("Demo");
    expect(demoEvent.institution_name).toContain("(Demo)");
    expect(demoEvent.venue).toContain("(Demo)");
  });

  it("never carries real contact details or a registration link", () => {
    expect(demoEvent.contact_number).toBeNull();
    expect(demoEvent.registration_url).toBeNull();
    expect(demoEvent.contact_name).toBeNull();
  });

  it("is a published 2-day event on 12–13 February 2027 in Chennai", () => {
    expect(demoEvent.status).toBe("published");
    expect(demoEvent.start_date).toBe("2027-02-12");
    expect(demoEvent.end_date).toBe("2027-02-13");
    expect(eventDurationDays(demoEvent.start_date, demoEvent.end_date)).toBe(2);
    expect(demoEvent.city).toBe("Chennai");
    expect(demoEvent.state_name).toBe("Tamil Nadu");
  });
});

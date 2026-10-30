export interface DemoEvidence {
  /** Short name of the example evidence artefact. */
  label: string;
  /** What it would show. Described only — no real upload exists. */
  description: string;
  /** File kind presented as an example, explicitly "no real file uploaded". */
  format: string;
}

/* ------------------------------------------------------------------ */
/*  Demo problem walkthrough — the full BuildProof journey as ONE      */
/*  clearly-labelled fictional example:                                */
/*                                                                      */
/*    problem → team → 7-day sprint → milestones → evidence             */
/*            → weights → contribution → generated Proof Card.          */
/*                                                                      */
/*  Safety rules (mirroring demoData.ts / eventsDemo.ts conventions):   */
/*   * Never written to the database, never uploaded to storage.        */
/*   * No real organisation, person, team or account is impersonated;   */
/*     every identity below is explicitly fictional.                    */
/*   * Always rendered behind DemoBadge / DEMO / FICTIONAL labels.      */
/*   * Pure data + pure scoring functions so unit tests pin the math.   */
/*                                                                      */
/*  HOW TO REMOVE THE DEMO WALKTHROUGH:                                 */
/*   Wiring exists in exactly three places —                            */
/*     src/App.tsx (one public route)                                   */
/*     src/pages/PublicProblemsPage.tsx (one demo entry card)           */
/*     src/features/problems/DemoProblemWalkthroughPage.tsx              */
/*   Remove those blocks, then this file, its types file and the        */
/*   walkthrough test file. No database or storage changes are needed   */
/*   because the demo never touches them.                               */
/* ------------------------------------------------------------------ */

export type DemoMilestoneStatus = "accepted" | "submitted" | "pending";

export interface DemoTeamMember {
  id: string;
  /** Fictional name — not a real user, never an account. */
  name: string;
  role: string;
  responsibilities: string[];
  /** Agreed, attributed work points out of 100 for accepted work. */
  contributionPoints: number;
  /** = contributionPoints / 100 × 100 — derived, never hand-written. */
  sharePercent: number;
  /** Milestone days this member leads. */
  leads: number[];
  note: string;
}

export interface DemoMilestone {
  id: string;
  day: number;
  title: string;
  description: string;
  /** Agreed weight out of 100, fixed BEFORE work started (illustrative agreement). */
  weight: number;
  status: DemoMilestoneStatus;
  thoroughNote?: string;
  responsibleRole: string;
  /** Example evidence is described (not uploaded): no real file exists. */
  evidence: DemoEvidence | null;
}

/* --------------------------- demo problem -------------------------- */

export const DEMO_PROBLEM_ID = "demo-reducing-material-wastage";

export function isDemoProblem(id: string | undefined): boolean {
  return id === DEMO_PROBLEM_ID;
}

/** Fixed, deterministic demo dates (do not use "today" — tests pin them). */
export const DEMO_SPRINT_START = "2026-11-09"; // Day 1 (Monday)
export const DEMO_SPRINT_DAYS = 7;

/** UTC-safe day arithmetic on plain YYYY-MM-DD strings (no timezone drift). */
export function addDaysIso(iso: string, days: number): string {
  const p = parseIso(iso);
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d + days));
  return t.toISOString().slice(0, 10);
}

function parseIso(iso: string): { y: number; m: number; d: number } {
  const parts = iso.split("-").map(Number);
  return { y: parts[0] ?? 0, m: parts[1] ?? 1, d: parts[2] ?? 1 };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-09" → "9 Nov 2026" (UTC month/day — plain, no Date widget). */
export function formatDemoDate(iso: string): string {
  const p = parseIso(iso);
  return `${p.d} ${MONTHS[p.m - 1] ?? "Jan"} ${p.y}`;
}

export const demoWalkthroughProblem = {
  id: DEMO_PROBLEM_ID,
  title: "Reducing Material Wastage in Small Manufacturing Units",
  organisation: "Demo Manufacturing Solutions",
  organisationNote: "FICTIONAL demonstration organisation — not a real customer, partner or endorsement.",
  category: "Manufacturing / Software",
  difficulty: "Beginner",
  durationDays: DEMO_SPRINT_DAYS,
  startDate: DEMO_SPRINT_START,
  deadline: addDaysIso(DEMO_SPRINT_START, DEMO_SPRINT_DAYS - 1),
  description:
    "Small manufacturing units frequently record raw material usage manually. This can lead to inaccurate inventory records, unnecessary material wastage and difficulty identifying where losses occur. The organisation is looking for an affordable digital solution that records daily material usage, tracks wastage and generates simple reports.",
  background:
    "The fictional unit works with sheet metal and packaging materials across three small shifts. Usage is written into a register at shift end and re-typed into a spreadsheet once a week. Entries are often estimated rather than measured, so the spreadsheet never matches the physical stock count. Over a month, the gap is written off simply as 'wastage' with no record of where it happened.",
  currentDifficulties: [
    "Material usage is recorded by hand at the end of each shift, often from memory.",
    "Weekly re-typing introduces transcription errors that nobody audits.",
    "Wastage is only visible as a monthly stock-count gap, never at the moment it occurs.",
    "No one can tell whether losses come from cutting scrap, storage damage or over-ordering.",
    "Existing ERP tools are priced and sized for large plants, not 10–30 person units.",
  ],
  expectedOutcome:
    "A working prototype that a shop floor worker can use to record daily material usage in under a minute, that flags unusual wastage as it is entered, that shows a simple dashboard, and that prints or exports a daily report. The goal is to REPLACE A PAPER PROCESS in a demonstration sense only — this demo does not claim any real deployment.",
  requirements: [
    "Record daily material usage per shift (material, quantity used, quantity wasted, reason).",
    "Maintain a simple materials list the organisation can edit without technical help.",
    "Track wastage by material, reason and shift so patterns become visible.",
    "Dashboard: current stock position, week-on-week wastage share, top three loss reasons.",
    "Generate a printable daily usage-and-wastage report.",
    "Work on an ordinary laptop browser; no special hardware required.",
    "Ship with realistic sample data so the dashboard is meaningful on first open.",
  ],
  constraints: [
    "Beginner-level project: no machine-integration, IoT or barcode hardware in scope.",
    "Single-device usage expected at first; multi-user conflict handling can be simplified.",
    "No purchase of paid services; the prototype must run without a licence.",
    "Sample data must be clearly synthetic and labelled — never presented as real plant data.",
  ],
  deliverables: [
    "Material usage recording.",
    "Wastage tracking.",
    "Dashboard.",
    "Daily report generation.",
    "Working prototype with sample data.",
  ],
  evaluationCriteria: [
    "Can a first-time user record a shift's usage in under one minute without instructions?",
    "Does the wastage view show material, reason and shift breakdowns correctly for the sample data?",
    "Does the daily report contain every entry made that day with no missing rows?",
    "Are the dashboard numbers arithmetically consistent with the recorded entries?",
    "Is the handover documentation sufficient for the organisation's staff to run it?",
  ],
  honesty: {
    problem: "Fictional problem — written for demonstration, not reported by a real unit.",
    screening: "Screens as 'approved' in this walkthrough only — no real screening happened.",
    source: "Company-source example (illustrative) — no real company stands behind it.",
  },
} as const;

/* --------------------------- demo team ----------------------------- */

export const demoTeamMembers: DemoTeamMember[] = [
  {
    id: "demo-member-lead",
    name: "A. Sharma (demo identity)",
    role: "Team Lead",
    responsibilities: [
      "Problem research plan and interview questions for the fictional unit.",
      "Daily coordination, sprint tracking and unblocking the team.",
      "Validation of the finished prototype against the evaluation criteria.",
    ],
    contributionPoints: 25,
    sharePercent: 25,
    leads: [1, 2, 7],
    note: "Fictional student — no real account, profile or verification exists behind this name.",
  },
  {
    id: "demo-member-developer",
    name: "R. Iyer (demo identity)",
    role: "Developer",
    responsibilities: [
      "Data-entry screens for usage and wastage recording.",
      "Dashboard views and the daily report generator.",
      "Sample-data seeding so the prototype is meaningful on first open.",
    ],
    contributionPoints: 35,
    sharePercent: 35,
    leads: [4, 5],
    note: "Fictional student — largest share because development owned the heaviest weighted days.",
  },
  {
    id: "demo-member-designer",
    name: "M. Kaur (demo identity)",
    role: "Designer",
    responsibilities: [
      "UI structure and the one-minute data-entry flow.",
      "Low-fi wireframes and the visual system for dashboard and report.",
      "Usability walkthrough before testing day.",
    ],
    contributionPoints: 20,
    sharePercent: 20,
    leads: [3],
    note: "Fictional student — no real account or portfolio behind this name.",
  },
  {
    id: "demo-member-analyst",
    name: "S. Das (demo identity)",
    role: "Analyst",
    responsibilities: [
      "Realistic synthetic sample data set and its rationale.",
      "Test checklist execution and defect logging.",
      "Final documentation and handover notes.",
    ],
    contributionPoints: 20,
    sharePercent: 20,
    leads: [6],
    note: "Fictional student — no real account behind this name.",
  },
];

/* ------------------------- demo sprint plan ------------------------ */

export const demoMilestones: DemoMilestone[] = [
  {
    id: "demo-ms-day1",
    day: 1,
    title: "Problem research",
    description:
      "Desk research on manual material logging in small units; a short fictional interview script; list of what 'wastage' actually hides.",
    weight: 15,
    status: "accepted",
    responsibleRole: "Team Lead",
    evidence: {
      label: "Research summary note",
      description: "3 pages: process map of the paper register flow, 5 wastage causes, top-3 data fields to capture.",
      format: "Note (example only — no real file uploaded)",
    },
  },
  {
    id: "demo-ms-day2",
    day: 2,
    title: "Requirements and planning",
    description:
      "Agreed scope: the seven requirements and constraints, plus the milestone weights frozen for the sprint.",
    weight: 15,
    status: "accepted",
    responsibleRole: "Team Lead",
    evidence: {
      label: "One-page requirement sheet",
      description: "7 numbered requirements, 4 constraints, agreed milestone weights totalling 100 points.",
      format: "Document (example only — no real file uploaded)",
    },
  },
  {
    id: "demo-ms-day3",
    day: 3,
    title: "UI design and architecture",
    description:
      "Wireframes for entry, wastage log and dashboard; simple data model (materials, usage entries, reasons).",
    weight: 15,
    status: "accepted",
    responsibleRole: "Designer",
    evidence: {
      label: "Wireframes v1",
      description: "4 screens sketched with the entry flow timed against the 'under one minute' criterion.",
      format: "Sketch set (example only — no real file uploaded)",
    },
  },
  {
    id: "demo-ms-day4",
    day: 4,
    title: "Prototype development (1/2)",
    description:
      "Build the usage-entry flow and the materials list; start the sample-data set so screens are never empty.",
    weight: 15,
    status: "accepted",
    responsibleRole: "Developer (sample data: Analyst)",
    evidence: {
      label: "Entry-flow build log",
      description: "Working entry screen over 20 synthetic usage entries; list editing without technical help.",
      format: "Build log + screenshot list (example only — no real file uploaded)",
    },
  },
  {
    id: "demo-ms-day5",
    day: 5,
    title: "Prototype development (2/2)",
    description:
      "Dashboard and wastage views wired to the sample data; daily report generated as a printable page.",
    weight: 15,
    status: "accepted",
    responsibleRole: "Developer",
    evidence: {
      label: "Dashboard + report walkthrough",
      description: "Dashboard renders top-3 loss reasons; report prints all entries for any chosen day.",
      format: "Build log + screenshot list (example only — no real file uploaded)",
    },
  },
  {
    id: "demo-ms-day6",
    day: 6,
    title: "Testing and improvements",
    description:
      "Checklist testing of entry, dashboard arithmetic and report completeness; defects fixed the same day.",
    weight: 15,
    status: "accepted",
    responsibleRole: "Analyst",
    evidence: {
      label: "Test checklist run",
      description: "21 automated-and-manual checks executed; 19 passed, 2 deferred; fixes re-verified same day.",
      format: "Test record (example only — no real file uploaded)",
    },
  },
  {
    id: "demo-ms-day7",
    day: 7,
    title: "Final demonstration and documentation",
    description:
      "Full demonstration against the evaluation criteria, handover documentation and owner-adoptability review.",
    weight: 10,
    status: "pending",
    thoroughNote:
      "Pending on purpose — walkthroughs must show incomplete work honestly, not manufacture a perfect record.",
    responsibleRole: "Team Lead (documentation: Analyst)",
    evidence: null,
  },
];

/* --------------------------- scoring model ------------------------- */
/*  Pure functions — the same formulas the Proof Card section renders.   */
/*  The live milestone model stores status only (pending / in_progress   */
/*  / done / late); agreed per-milestone WEIGHTS are a demo extension    */
/*  of that model, frozen in the (fictional) Day-2 requirement sheet.    */

export function totalAgreedWeight(milestones: DemoMilestone[]): number {
  return milestones.reduce((sum, m) => sum + m.weight, 0);
}

/** Accepted milestone weight / total agreed milestone weight × 100. */
export function milestoneCompletionPercent(milestones: DemoMilestone[]): number {
  const total = totalAgreedWeight(milestones);
  if (total === 0) return 0;
  const accepted = milestones
    .filter((m) => m.status === "accepted")
    .reduce((sum, m) => sum + m.weight, 0);
  return Math.round((accepted / total) * 100);
}

export interface EvidenceCoverage {
  withAcceptedEvidence: number;
  total: number;
  percent: number;
}

/** Milestones with submitted-and-accepted example evidence / all milestones. */
export function evidenceCoverage(milestones: DemoMilestone[]): EvidenceCoverage {
  const total = milestones.length;
  const withAcceptedEvidence = milestones.filter((m) => m.evidence && m.status !== "pending").length;
  const percent = total === 0 ? 0 : Math.round((withAcceptedEvidence / total) * 100);
  return { withAcceptedEvidence, total, percent };
}

export interface DemoTestResults {
  total: number;
  passed: number;
  deferred: number;
  note: string;
}

/** Demo testing record — clearly labelled illustrative results, never real QA. */
export const demoTestResults: DemoTestResults = {
  total: 21,
  passed: 19,
  deferred: 2,
  note:
    "Demo testing record. The 2 deferred checks both belong to the pending Day-7 area (final demonstration flow). Deferred ≠ failed: they are not yet executed.",
};

/* --------------------------- proof card ---------------------------- */

/** Honest outcome: completed-and-demonstrated, explicitly NOT adopted. */
export const demoProofCard = {
  title: "Proof Card — Material-Wastage Tracker (Demo)",
  projectTitle: demoWalkthroughProblem.title,
  problemStatement: demoWalkthroughProblem.description,
  organisation: demoWalkthroughProblem.organisation,
  teamNames: demoTeamMembers.map((m) => `${m.name} — ${m.role}`),
  durationLabel: `${demoWalkthroughProblem.durationDays}-day sprint (fixed dates)`,
  deadlineLabel: formatDemoDate(demoWalkthroughProblem.deadline),
  outcomeLabel:
    "Working prototype completed and demonstrated with sample data — NOT adopted. The final owner-adoptability review (Day 7) is still pending.",
  tierLabel: "Tier 2 (illustrative) — evidence reviewed by a demo facilitator",
  reviewStatusLabel: "approved (illustrative review)",
  contributionDenominatorNote:
    "Each member's share = their accepted, attributed work points ÷ 100 agreed work points for the whole sprint. Shares are illustrative and are NOT independently verified measurements — real cards derive them from recorded team membership and evidence reviews.",
  completionFormula:
    "Milestone completion = accepted milestone weight ÷ total agreed milestone weight × 100",
  neverImplicationNote:
    "90% milestone completion does NOT mean 90% project quality or 90% success. It states precisely what it measures — how much of the agreed, weighted milestone work was accepted.",
} as const;

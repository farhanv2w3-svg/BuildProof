/* ------------------------------------------------------------------ */
/*  Demo data — FICTIONAL examples used to teach how each domain works. */
/*  Nothing here is real platform activity. Every entity, person,      */
/*  company, payment, review, outcome and amount below is invented for  */
/*  demonstration only and must always be rendered behind a DemoBadge.  */
/*  Demo data is NEVER written to the database and never mixed with    */
/*  real user records (product principles 5, 8, 10 + §18, §24).        */
/* ------------------------------------------------------------------ */

export interface DemoRecord {
  id: string;
  /** The domain this demo teaches. */
  domain:
    | "problems"
    | "teams"
    | "validation"
    | "build"
    | "company-projects"
    | "solutions"
    | "startups"
    | "hardware"
    | "opportunities"
    | "proof";
  title: string;
  summary: string;
  details?: { label: string; value: string }[];
  skills?: string[];
  status?: string;
  /** Numbered to the 12 demos required by the product brief. */
  demoNo: number;
}

export const DEMO_SOURCE_NOTE =
  "Demo — fictional example. Not a real company, payment, review or project outcome.";

/* Demo 1 — company problem (equipment-maintenance dashboard) */
export const demoCompanyProblem: DemoRecord = {
  id: "demo-company-problem",
  demoNo: 1,
  domain: "problems",
  title: "Equipment-maintenance records are spread across paper logs",
  summary:
    "A fictional engineering unit maintains 40 pumps and motors. Maintenance records live in paper logbooks, so breakdown cause analysis takes days. They want a dashboard that consolidates these records.",
  status: "approved",
  skills: ["Frontend development", "Database design", "UI/UX design"],
  details: [
    { label: "Industry", value: "Manufacturing operations" },
    { label: "Who experiences it", value: "Maintenance supervisors and plant managers" },
    { label: "Current process", value: "Paper logbooks + Excel summaries, updated weekly" },
    { label: "Desired outcome", value: "One dashboard per machine with downtime and repair history" },
    { label: "Looking for", value: "A prototype first; production build discussed after review" },
    { label: "Budget", value: "Budget noted as available — illustrative amount only (₹60,000)" },
    { label: "Deliverables", value: "Data model, dashboard prototype, test checklist, handover note" },
  ],
};

/* Demo 2 — individual problem (household water tracking) */
export const demoIndividualProblem: DemoRecord = {
  id: "demo-individual-problem",
  demoNo: 2,
  domain: "problems",
  title: "Households cannot see where their water goes",
  summary:
    "A fictional resident notices summer water bills rising but has no way to see which activities consume the most water. They want a simple tracking method that does not require installing smart meters.",
  status: "screening",
  skills: ["Business research", "Frontend development"],
  details: [
    { label: "Who experiences it", value: "Residents in areas with metered municipal supply" },
    { label: "Frequency", value: "Daily usage decisions, monthly bill comparison" },
    { label: "Current process", value: "Reading the meter once a month" },
    { label: "Hypothesis (unvalidated)", value: "Manual per-activity logging can reveal wastage" },
  ],
};

/* Demo 3 — beginner-friendly paid task */
export const demoBeginnerTask: DemoRecord = {
  id: "demo-beginner-task",
  demoNo: 3,
  domain: "company-projects",
  title: "Small UI component: inventory-row status chips",
  summary:
    "A fictional retail-software company needs polished status chips for its inventory table, matching its existing design tokens.",
  status: "listed",
  skills: ["Frontend development", "UI/UX design"],
  details: [
    { label: "Level", value: "Beginner — clearly scoped, suitable for a first paid task" },
    { label: "Deliverables", value: "Component code, usage notes, three UI states, screenshot review" },
    { label: "Budget (illustrative)", value: "₹4,000 – ₹6,000" },
    { label: "Payment schedule", value: "Single milestone, paid after acceptance" },
    { label: "Acceptance criteria", value: "Matches design tokens, keyboard accessible, no console warnings" },
    { label: "Duration", value: "1 week" },
  ],
};

/* Demo 4 — advanced paid task */
export const demoAdvancedTask: DemoRecord = {
  id: "demo-advanced-task",
  demoNo: 4,
  domain: "company-projects",
  title: "Invoice API integration with webhook reconciliation",
  summary:
    "A fictional finance-software team wants a documented invoice-provider integration: API client, webhook handler with signature verification, idempotent reconciliation job and test suite.",
  status: "listed",
  skills: ["Backend development", "Cybersecurity", "Software testing and quality assurance"],
  details: [
    { label: "Level", value: "Advanced — production-oriented, larger budget, stricter review" },
    { label: "Security requirements", value: "Webhook signature validation, idempotency keys, secret handling via server config" },
    { label: "Tests", value: "Unit + integration tests; failure-path coverage required" },
    { label: "Budget (illustrative)", value: "₹80,000 – ₹1,20,000 across three milestones" },
    { label: "Payment schedule", value: "30% setup, 40% integration demo, 30% after acceptance criteria met" },
    { label: "Revision policy", value: "Two revision rounds included; further changes scoped separately" },
  ],
};

/* Demo 5 — promising software solution seeking a builder/adopter */
export const demoSoftwareSolution: DemoRecord = {
  id: "demo-software-solution",
  demoNo: 5,
  domain: "solutions",
  title: "WaterLog — community water-consumption logger",
  summary:
    "A fictional student team built and user-tested a lightweight logger after validating Demo 2's problem. It works, has known limitations, and they are open to adoption or further-development discussions.",
  status: "tested",
  skills: [],
  details: [
    { label: "Original problem", value: "Household water tracking (see Problems demo)" },
    { label: "Evidence of testing", value: "12 interactive sessions with 9 volunteer households (illustrative)" },
    { label: "Known limitations", value: "No offline mode; English-only; entries are self-reported" },
    { label: "Unresolved", value: "Hindi localisation and utility-bill format support" },
    { label: "Licensing", value: "Not commercial yet — creators retain ownership" },
    { label: "Next steps", value: "Localisation, pilot with one residents' association" },
  ],
};

/* Demo 6 — founder with resources, no idea/team */
export const demoFounderNoIdea: DemoRecord = {
  id: "demo-founder-no-idea",
  demoNo: 6,
  domain: "startups",
  title: "A prospective founder exploring validated problem areas",
  summary:
    "A fictional founder with savings and domain contacts but no team browses evidence-backed problem reports and eligible solutions, then requests introductions.",
  status: "under_discussion",
  details: [
    { label: "What they see", value: "Validation evidence, feasibility findings, unresolved limitations — not sales pitches" },
    { label: "What they cannot assume", value: "Access to a team or solution grants no ownership without an agreed transfer" },
  ],
};

/* Demo 7 — founder with an idea, no team */
export const demoFounderNoTeam: DemoRecord = {
  id: "demo-founder-no-team",
  demoNo: 7,
  domain: "startups",
  title: "Specifying roles, ownership and compensation before work begins",
  summary:
    "A fictional founder lists the roles they need, invites contributors, and drafts ownership and compensation terms in a transfer agreement before any restricted access is granted.",
  status: "agreed",
  details: [
    { label: "Roles needed", value: "Frontend, Android, market research" },
    { label: "Agreement drafted", value: "Assignment of new work, creator attribution retained, milestone-based compensation" },
    { label: "Access rule", value: "Restricted repository only after agreement is executed" },
  ],
};

/* Demo 8 — hardware prototype */
export const demoHardwareProject: DemoRecord = {
  id: "demo-hardware-project",
  demoNo: 8,
  domain: "hardware",
  title: "Automated irrigation controller (stage 6 of 12)",
  summary:
    "A fictional student team built a working controller for two 12V solenoid valves with a moisture sensor. Measured values below are illustrative.",
  status: "prototype",
  skills: ["Electronics and embedded systems", "Mechanical design"],
  details: [
    { label: "What works", value: "Scheduled and sensor-based switching; 8-hour continuous bench run" },
    { label: "Evidence (illustrative)", value: "Bench log with switching accuracy ±2% moisture reading" },
    { label: "Bill of materials (illustrative)", value: "₹1,850 total across microcontroller, relay board, sensor, enclosure" },
    { label: "Remaining work", value: "Weatherproof enclosure, firmware OTA update, 4-week field trial" },
    { label: "Safety note", value: "Mains isolation required before any real deployment; not production-ready" },
  ],
};

/* Demo 9 — student career progression */
export const demoCareerProgression: DemoRecord = {
  id: "demo-career-progression",
  demoNo: 9,
  domain: "opportunities",
  title: "From a beginner task to an interview invitation",
  summary:
    "A fictional student completes the status-chips task (Demo 3), then a documentation task, then joins the invoice-integration project — and the same fictional company invites them to interview for an internship.",
  status: "interviewing",
  details: [
    { label: "Evidence used", value: "Deliverables, reviewer feedback, deadline history — not a single numeric score" },
    { label: "Important", value: "Completing projects never guarantees an internship or job" },
  ],
};

/* Demo 10 — failed but valuable project */
export const demoFailedProject: DemoRecord = {
  id: "demo-failed-project",
  demoNo: 10,
  domain: "proof",
  title: "Tested, reviewed — and not adopted",
  summary:
    "A fictional team's prototype passed its agreed functional tests (8 of 10) but the problem owner decided not to adopt it. Their Proof Card records the fair, individual outcome.",
  status: "done",
  details: [
    { label: "Project outcome", value: "Not adopted — owner chose to continue with their current process" },
    { label: "Individual performance", value: "Both contributors met agreed deliverables; reviews recorded separately" },
    { label: "Percentage denominator", value: "8 of 10 agreed functional tests passed" },
    { label: "What was learned", value: "Adoption depended on an operational constraint discovered late" },
  ],
};

/* Demo 11 — hardware funding pathway */
export const demoHardwareFunding: DemoRecord = {
  id: "demo-hardware-funding",
  demoNo: 11,
  domain: "hardware",
  title: "Funding a near-complete controller, safely",
  summary:
    "A fictional funder evaluates Demo 8's project: what works, what remains, and the safety/regulatory review required before any field deployment — without treating the prototype as production-ready.",
  status: "under_review",
  details: [
    { label: "Funding requested (illustrative)", value: "₹25,000 for enclosure, field trial and certification prep" },
    { label: "Funder diligence", value: "Review of bench logs, BOM, safety assessment and test plan" },
    { label: "Not replaced by funding", value: "Electrical-safety review and regulatory checks remain mandatory" },
  ],
};

/* Demo 12 — multidisciplinary team */
export const demoMultidisciplinaryTeam: DemoRecord = {
  id: "demo-multidisciplinary-team",
  demoNo: 12,
  domain: "teams",
  title: "Six contributors, one problem, different roles",
  summary:
    "A fictional team on the equipment-maintenance problem includes frontend, backend, QA, market research, finance and a domain-savvy operations student — each with recorded responsibilities and contributions.",
  status: "active",
  skills: ["Frontend development", "Backend development", "Software testing and quality assurance", "Market research", "Finance and costing", "Operations"],
  details: [
    { label: "Role requirements", value: "Published per role with seat counts and expectations" },
    { label: "Attribution", value: "Every member's contribution is recorded on the Proof Card separately" },
  ],
};

/* Convenience packs per page ---------------------------------------- */

export const problemDemos = [demoCompanyProblem, demoIndividualProblem];
export const teamDemos = [demoMultidisciplinaryTeam];
export const buildDemos = [demoMultidisciplinaryTeam, demoFailedProject];
export const companyProjectDemos = [demoBeginnerTask, demoAdvancedTask];
export const solutionDemos = [demoSoftwareSolution];
export const startupDemos = [demoFounderNoIdea, demoFounderNoTeam];
export const hardwareDemos = [demoHardwareProject, demoHardwareFunding];
export const opportunityDemos = [demoCareerProgression];
export const proofDemos = [demoFailedProject, demoCompanyProblem];

/** All demo records — used by tests to assert every item is self-labelling. */
export const allDemos: DemoRecord[] = [
  demoCompanyProblem, demoIndividualProblem, demoBeginnerTask, demoAdvancedTask,
  demoSoftwareSolution, demoFounderNoIdea, demoFounderNoTeam, demoHardwareProject,
  demoCareerProgression, demoFailedProject, demoHardwareFunding, demoMultidisciplinaryTeam,
];

import {
  CheckCircle2, CircleAlert, ClipboardCheck, FileText, ListChecks,
  ShieldCheck,
} from "lucide-react";
import {
  Badge, ButtonLink, Card, CardHeader, InfoNote,
} from "../../components/ui";
import { DemoBadge, DemoBlock } from "../../components/DomainKit";
import { cn } from "../../lib/utils";
import {
  DEMO_SPRINT_START, demoMilestones, demoProofCard, demoTeamMembers, demoTestResults,
  demoWalkthroughProblem, evidenceCoverage, formatDemoDate, milestoneCompletionPercent,
  totalAgreedWeight,
} from "../../lib/demoWalkthrough";
import type { DemoMilestone } from "../../lib/demoWalkthrough";

/* ------------------------------------------------------------------ */
/*  End-to-end DEMO walkthrough (public, no sign-in). One fictional    */
/*  problem shown across the whole journey: problem → team → sprint    */
/*  → milestones → evidence → generated Proof Card. Every section is   */
/*  labelled DEMO / FICTIONAL / ILLUSTRATIVE; nothing touches the DB.  */
/* ------------------------------------------------------------------ */

const STEPS = [
  { id: "problem", label: "1 · Problem statement" },
  { id: "team", label: "2 · Student team" },
  { id: "sprint", label: "3 · Sprint & milestones" },
  { id: "evidence", label: "4 · Evidence" },
  { id: "proof", label: "5 · Proof Card" },
] as const;

const statusTone: Record<string, "success" | "info" | "neutral"> = {
  accepted: "success",
  submitted: "info",
  pending: "neutral",
};
const statusLabel: Record<string, string> = {
  accepted: "Accepted",
  submitted: "Submitted (awaiting review)",
  pending: "Pending",
};

function Bar({ percent, tone = "brand" }: { percent: number; tone?: "brand" | "amber" }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-canvas ring-1 ring-line" role="img" aria-label={`${percent}%`}>
      <div
        className={cn("h-full rounded-full", tone === "brand" ? "bg-brand-500" : "bg-amber-400")}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

function SectionHeading({ id, n, title, sub }: { id: string; n: number; title: string; sub: string }) {
  return (
    <div id={id} className="scroll-mt-24">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-[13px] font-bold text-brand-700 ring-1 ring-brand-200" aria-hidden>
          {n}
        </span>
        <h2 className="text-[19px] font-bold text-ink">{title}</h2>
        <DemoBadge compact />
      </div>
      <p className="mt-1 max-w-3xl text-[13.5px] text-ink-soft">{sub}</p>
    </div>
  );
}

function FactRow({ label, value, wide = false }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn("grid grid-cols-[135px_1fr] gap-2 text-[13px]", wide && "col-span-full")}>
      <dt className="font-semibold text-ink">{label}</dt>
      <dd className="text-ink-soft">{value}</dd>
    </div>
  );
}

export default function DemoProblemWalkthroughPage() {
  const completion = milestoneCompletionPercent(demoMilestones);
  const cov = evidenceCoverage(demoMilestones);

  return (
    <div className="min-h-screen bg-canvas py-8">
      {/* Top honesty banner */}
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <DemoBlock className="!p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-bold uppercase tracking-wide text-amber-800">
                Demo walkthrough — everything below is fictional
              </p>
              <p className="mt-0.5 text-[13px] text-ink-soft">
                A complete, invented example that shows how the BuildProof workflow fits together:
                problem → team → timed sprint → weighted milestones → evidence → generated Proof Card.
                No real organisation, student, upload or result is involved anywhere on this page.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="warn">DEMO</Badge>
              <Badge tone="warn">FICTIONAL ORGANISATION</Badge>
              <Badge tone="warn">ILLUSTRATIVE RESULTS</Badge>
            </div>
          </div>
        </DemoBlock>
      </div>

      {/* Hero */}
      <div className="mx-auto mt-6 w-full max-w-6xl px-4 sm:px-6">
        <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-soft">
          Demo problem · end-to-end example
        </p>
        <h1 className="mt-1 text-2xl font-bold leading-snug text-ink sm:text-[28px]">
          {demoWalkthroughProblem.title}
        </h1>
        <Card className="mt-4 p-5">
          <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            <FactRow label="Submitting organisation" value={
              <span>
                {demoWalkthroughProblem.organisation}{" "}
                <Badge tone="warn">Fictional organisation</Badge>
              </span>
            } />
            <FactRow label="Category" value={demoWalkthroughProblem.category} />
            <FactRow label="Difficulty" value={demoWalkthroughProblem.difficulty} />
            <FactRow label="Duration" value={`${demoWalkthroughProblem.durationDays}-day sprint, ${formatDemoDate(demoWalkthroughProblem.startDate)} → ${formatDemoDate(demoWalkthroughProblem.deadline)}`} />
            <FactRow label="Deadline" value={`${formatDemoDate(demoWalkthroughProblem.deadline)} — exactly 7 days after the demo project start date (${formatDemoDate(DEMO_SPRINT_START)})`} />
            <FactRow label="Status" value={demoWalkthroughProblem.honesty.screening} />
          </dl>
        </Card>

        {/* Journey navigation */}
        <nav aria-label="Walkthrough sections" className="sticky top-0 z-10 mt-4 rounded-card border border-line bg-surface/95 p-2 backdrop-blur">
          <ol className="flex flex-wrap gap-1.5">
            {STEPS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="rounded-md px-2.5 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:bg-brand-50 hover:text-brand-700">
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* 1 · Problem statement */}
      <section className="mx-auto mt-10 w-full max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="problem" n={1}
          title="The problem statement"
          sub="What the fictional organisation is asking for, why it matters to them, and how a real submission would be screened."
        />
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <CardHeader title="Description" sub={demoWalkthroughProblem.honesty.problem} />
            <p className="px-5 pb-5 text-[13.5px] leading-relaxed text-ink-soft">
              {demoWalkthroughProblem.description}
            </p>
          </Card>
          <Card className="p-5">
            <CardHeader title="Background" sub="The fictional context behind the request." />
            <p className="px-5 pb-5 text-[13.5px] leading-relaxed text-ink-soft">
              {demoWalkthroughProblem.background}
            </p>
          </Card>
          <Card className="p-5">
            <CardHeader title="Current difficulties" sub="Why the manual process fails today." />
            <ul className="space-y-2 px-5 pb-5">
              {demoWalkthroughProblem.currentDifficulties.map((d) => (
                <li key={d} className="flex gap-2 text-[13.5px] text-ink-soft">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                  {d}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <CardHeader title="Expected outcome" sub="What success looks like for this demo project." />
            <p className="px-5 pb-5 text-[13.5px] leading-relaxed text-ink-soft">
              {demoWalkthroughProblem.expectedOutcome}
            </p>
          </Card>
          <Card className="p-5">
            <CardHeader title="Requirements" sub="The agreed scope the team works against." />
            <ul className="space-y-2 px-5 pb-5">
              {demoWalkthroughProblem.requirements.map((r) => (
                <li key={r} className="flex gap-2 text-[13.5px] text-ink-soft">
                  <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                  {r}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <CardHeader title="Constraints" sub="Deliberate limits that keep this a beginner project." />
            <ul className="space-y-2 px-5 pb-5">
              {demoWalkthroughProblem.constraints.map((c) => (
                <li key={c} className="flex gap-2 text-[13.5px] text-ink-soft">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                  {c}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <CardHeader title="Deliverables" sub="The five concrete outputs agreed up front." />
            <ul className="space-y-2 px-5 pb-5">
              {demoWalkthroughProblem.deliverables.map((d) => (
                <li key={d} className="flex gap-2 text-[13.5px] text-ink-soft">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                  {d}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <CardHeader title="Evaluation criteria" sub="How the fictional organisation would judge the work." />
            <ul className="space-y-2 px-5 pb-5">
              {demoWalkthroughProblem.evaluationCriteria.map((c) => (
                <li key={c} className="flex gap-2 text-[13.5px] text-ink-soft">
                  <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                  {c}
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <InfoNote>
          On real submissions this brief would live inside the app after sign-in, with the problem owner's
          own account behind it. Here everything is fictional by design — {demoWalkthroughProblem.honesty.source}
        </InfoNote>
      </section>

      {/* 2 · Team */}
      <section className="mx-auto mt-12 w-full max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="team" n={2}
          title="The demonstrator student team"
          sub="Four fictional identities with distinct roles and responsibilities — the same role structure a real team plans under Team roles."
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {demoTeamMembers.map((m) => (
            <DemoBlock key={m.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-[15px] font-bold text-ink">{m.name}</h3>
                  <p className="text-[13px] font-semibold text-brand-700">{m.role}</p>
                </div>
                <div className="w-28 text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Contribution</p>
                  <p className="text-[15px] font-bold text-ink">{m.sharePercent}%</p>
                </div>
              </div>
              <Bar percent={m.sharePercent} />
              <ul className="mt-2 space-y-1.5">
                {m.responsibilities.map((r) => (
                  <li key={r} className="flex gap-2 text-[13px] text-ink-soft">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden />
                    {r}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[12px] text-ink-soft">
                Leads sprint day{m.leads.length > 1 ? "s" : ""} {m.leads.join(", ")} · share explained in the Proof Card below.
              </p>
              <p className="mt-1 text-[12px] italic text-amber-800">{m.note}</p>
            </DemoBlock>
          ))}
        </div>
        <InfoNote>
          These are demo identities, not user accounts. No profile, endorsement or verification exists
          behind any name above — BuildProof never fabricates real users or verified identities.
        </InfoNote>
      </section>

      {/* 3 · Sprint */}
      <section className="mx-auto mt-12 w-full max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="sprint" n={3}
          title="The 7-day sprint, milestone by milestone"
          sub="Each milestone carries an agreed weight (fixed on Day 2, totalling 100 points). Weights are a demo extension of the live milestone model, which records status (pending / in progress / done / late)."
        />
        <div className="mt-4 space-y-3">
          {demoMilestones.map((m) => (
            <MilestoneRow key={m.id} m={m} />
          ))}
        </div>
      </section>

      {/* 4 · Evidence */}
      <section className="mx-auto mt-12 w-full max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="evidence" n={4}
          title="Evidence coverage"
          sub="Which milestones have submitted-and-accepted example evidence, and which are pending — the input to Determination D on the Proof Card."
        />
        <div className="mt-4 grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card className="p-5">
            <p className="text-[12px] font-bold uppercase tracking-wide text-ink-soft">Coverage summary</p>
            <p className="mt-2 text-[34px] font-bold leading-none text-ink">
              {cov.withAcceptedEvidence}<span className="text-[18px] font-semibold text-ink-soft"> / {cov.total}</span>
            </p>
            <p className="mt-1 text-[13px] text-ink-soft">milestones with accepted example evidence</p>
            <div className="mt-3"><Bar percent={cov.percent} /></div>
            <p className="mt-2 text-[12.5px] text-ink-soft">
              {cov.percent}% — lower than the {completion}% completion score on purpose: the pending
              Day-7 milestone cannot yet carry accepted evidence, so the two metrics stay independent.
            </p>
          </Card>
          <div className="space-y-2">
            {demoMilestones.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
                <span className="text-[12.5px] font-semibold text-ink">Day {m.day}</span>
                <span className="min-w-[180px] flex-1 truncate text-[12.5px] text-ink-soft">{m.title}</span>
                <Badge tone={m.evidence ? (m.status === "accepted" ? "success" : "neutral") : "warn"}>
                  {m.evidence ? (m.status === "accepted" ? "Submitted + accepted" : "Submitted (in review)") : "No evidence yet — pending milestone"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
        <InfoNote>
          Real teams upload evidence files into a private, access-controlled store that reviewers see by
          policy. This walkthrough only <em>describes</em> example evidence — nothing was uploaded anywhere,
          so no demo item can be confused with a real attachment.
        </InfoNote>
      </section>

      {/* 5 · Proof Card */}
      <section className="mx-auto mt-12 w-full max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="proof" n={5}
          title="The generated Proof Card"
          sub="What BuildProof would generate at the end of this sprint — every number explained, not just displayed."
        />
        <DemoBlock className="!p-0">
          <div className="border-b border-amber-200 bg-amber-50/60 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[17px] font-bold text-ink">{demoProofCard.title}</h3>
              <div className="flex flex-wrap gap-2">
                <Badge tone="brand">{demoProofCard.tierLabel}</Badge>
                <Badge tone="success">{demoProofCard.reviewStatusLabel}</Badge>
              </div>
            </div>
          </div>

          <div className="space-y-5 px-5 py-5">
            {/* A */}
            <Card className="p-5">
              <p className="text-[12px] font-bold uppercase tracking-wide text-ink-soft">A · Project identity</p>
              <dl className="mt-2 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                <FactRow label="Project title" value={demoProofCard.projectTitle} />
                <FactRow label="Submitting organisation" value={`${demoProofCard.organisation} (fictional)`} />
                <FactRow label="Team" value={demoProofCard.teamNames.join(" · ")} wide />
                <FactRow label="Duration" value={demoProofCard.durationLabel} />
                <FactRow label="Deadline" value={demoProofCard.deadlineLabel} />
              </dl>
              <div className="mt-3 rounded-lg border border-line bg-canvas p-3">
                <p className="text-[12px] font-semibold text-ink">Problem statement</p>
                <p className="mt-1 text-[13px] text-ink-soft">{demoProofCard.problemStatement}</p>
              </div>
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-[12px] font-semibold text-amber-800">F · Project outcome</p>
                <p className="mt-1 text-[13px] text-ink-soft">{demoProofCard.outcomeLabel}</p>
              </div>
            </Card>

            {/* B */}
            <Card className="p-5">
              <p className="text-[12px] font-bold uppercase tracking-wide text-ink-soft">B · Overall milestone completion — team-level</p>
              <p className="mt-3 font-mono text-[13px] text-ink">{demoProofCard.completionFormula}</p>
              <div className="mt-2 rounded-lg border border-line bg-canvas p-3 font-mono text-[13px] text-ink-soft">
                {completion}% = 90 accepted ÷ 100 agreed × 100
              </div>
              <div className="mt-3"><Bar percent={completion} /></div>
              <ul className="mt-3 space-y-1.5 text-[13px] text-ink-soft">
                <li>· <strong className="text-ink">Agreed weight</strong>: frozen on Day 2 (15+15+15+15+15+15+10 = {totalAgreedWeight(demoMilestones)} points).</li>
                <li>· <strong className="text-ink">Accepted weight</strong>: Days 1–6 accepted (90 points); Day 7 pending (10 points).</li>
                <li>· <strong className="text-ink">What this does not say</strong>: {demoProofCard.neverImplicationNote}</li>
              </ul>
            </Card>

            {/* C */}
            <Card className="p-5">
              <p className="text-[12px] font-bold uppercase tracking-wide text-ink-soft">C · Individual contribution — per person</p>
              <div className="mt-3 space-y-3">
                {demoTeamMembers.map((m) => (
                  <div key={m.id}>
                    <div className="flex items-baseline justify-between gap-2 text-[13px]">
                      <span className="font-semibold text-ink">{m.name} — {m.role}</span>
                      <span className="font-mono text-ink-soft">{m.contributionPoints} ÷ 100 = {m.sharePercent}%</span>
                    </div>
                    <div className="mt-1"><Bar percent={m.sharePercent} tone={m.sharePercent >= 35 ? "brand" : "amber"} /></div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[13px] text-ink-soft">{demoProofCard.contributionDenominatorNote}</p>
              <p className="mt-2 text-[12.5px] text-ink-soft">
                Read per role: the Developer's 35% reflects owning the heaviest weighted days (Days 4–5);
                it is a share of accepted, attributed work points — never a quality score of the person.
              </p>
            </Card>

            {/* D */}
            <Card className="p-5">
              <p className="text-[12px] font-bold uppercase tracking-wide text-ink-soft">D · Evidence coverage</p>
              <p className="mt-2 font-mono text-[13px] text-ink-soft">
                {cov.withAcceptedEvidence} ÷ {cov.total} milestones × 100 = {cov.percent}%
              </p>
              <div className="mt-2"><Bar percent={cov.percent} /></div>
              <p className="mt-2 text-[13px] text-ink-soft">
                Determination of which milestones have submitted and accepted evidence (Days 1–6) versus
                pending (Day 7, no evidence yet). Deliberately mismatched against completion (90%) so the
                two metrics are never conflated.
              </p>
            </Card>

            {/* E */}
            <Card className="p-5">
              <p className="text-[12px] font-bold uppercase tracking-wide text-ink-soft">E · Testing results (demo results)</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-line bg-canvas p-3 text-center">
                  <p className="text-[22px] font-bold text-ink">{demoTestResults.total}</p>
                  <p className="text-[12px] text-ink-soft">checks executed</p>
                </div>
                <div className="rounded-lg border border-line bg-canvas p-3 text-center">
                  <p className="text-[22px] font-bold text-success">{demoTestResults.passed}</p>
                  <p className="text-[12px] text-ink-soft">passed</p>
                </div>
                <div className="rounded-lg border border-line bg-canvas p-3 text-center">
                  <p className="text-[22px] font-bold text-amber-700">{demoTestResults.deferred}</p>
                  <p className="text-[12px] text-ink-soft">deferred</p>
                </div>
              </div>
              <p className="mt-2 text-[13px] text-ink-soft">{demoTestResults.note}</p>
            </Card>

            {/* F */}
            <Card className="p-5">
              <p className="text-[12px] font-bold uppercase tracking-wide text-ink-soft">F · Project outcome — honest label</p>
              <Badge tone="warn" className="mt-2">Completed &amp; demonstrated — not adopted</Badge>
              <p className="mt-2 text-[13px] text-ink-soft">
                The card reports the outcome the evidence supports and nothing more. {demoProofCard.outcomeLabel}{" "}
                A real card's outcome is confirmed by a human problem owner — it is never awarded automatically,
                and this demo owner never confirmed anything because it does not exist.
              </p>
            </Card>

            {/* G */}
            <Card className="p-5">
              <p className="text-[12px] font-bold uppercase tracking-wide text-ink-soft">G · Auditability — how this card was produced</p>
              <ol className="mt-2 space-y-1.5 text-[13px] text-ink-soft">
                <li>1. The team and the (fictional) organisation agreed the scope and the weighted milestones on Day 2 — before work started.</li>
                <li>2. Each day's work was described as example evidence and reviewed for acceptance; pending milestones stay visibly pending.</li>
                <li>3. Completion compares accepted weight against the agreed total — a formula, not a judgement call.</li>
                <li>4. Contribution shares come from attributed work points recorded against each member's responsibilities.</li>
                <li>5. The testing record, the coverage count and the outcome label are each shown separately — no composite "score" hides them.</li>
                <li>6. A reviewer's tier setting records how much of this a real reviewer verified; here it is labelled illustrative (Tier 2, demo facilitator).</li>
              </ol>
              <p className="mt-3 text-[13px] text-ink-soft">
                On a real card these traces are produced by database records (team membership, milestones,
                evidence attachments, reviews) with access policies, so every figure can be traced back to
                an agreed, recorded step.
              </p>
            </Card>
          </div>
        </DemoBlock>
      </section>

      {/* Close */}
      <section className="mx-auto mt-12 w-full max-w-6xl px-4 sm:px-6">
        <div className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-[16px] font-bold text-ink">What is real on this page?</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
            Only the workflow itself — the screens, rules and formulas real BuildProof teams use. Every problem
            detail, person, name, sprint, weight, evidence item, test result and review here is fictional
            demonstration content. BuildProof fabricates no users and no verified organisations, and demo
            material never enters the platform database.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink to="/problems" variant="secondary" size="sm">Back to Problems</ButtonLink>
            <ButtonLink to="/how-it-works" variant="secondary" size="sm">How BuildProof works</ButtonLink>
            <ButtonLink to="/signup" size="sm">Create an account to try it</ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}

function MilestoneRow({ m }: { m: DemoMilestone }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-7 items-center rounded-md bg-brand-50 px-2 text-[12px] font-bold text-brand-700 ring-1 ring-brand-200">
          Day {m.day}
        </span>
        <h3 className="text-[14.5px] font-bold text-ink">{m.title}</h3>
        <Badge tone={statusTone[m.status]}>{statusLabel[m.status]}</Badge>
        <span className="ml-auto text-[12px] font-semibold text-ink-soft">
          weight {m.weight} / {totalAgreedWeight(demoMilestones)} pts
        </span>
      </div>
      <Bar percent={(m.weight / totalAgreedWeight(demoMilestones)) * 100} />
      <p className="mt-2 text-[13.5px] text-ink-soft">{m.description}</p>
      <p className="mt-1 text-[12.5px] text-ink-soft">Led by: {m.responsibleRole}</p>
      {m.evidence ? (
        <div className="mt-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-2.5">
          <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-amber-800">
            <FileText className="h-3.5 w-3.5" aria-hidden /> Example evidence (demo — not a real upload)
          </p>
          <p className="mt-1 text-[13px] text-ink">
            <strong>{m.evidence.label}</strong> — {m.evidence.description}
          </p>
          <p className="mt-0.5 text-[12px] text-ink-soft">{m.evidence.format}</p>
        </div>
      ) : (
        m.thoroughNote && (
          <div className="mt-2 rounded-lg border border-dashed border-line bg-canvas p-2.5">
            <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-ink-soft">
              <CircleAlert className="h-3.5 w-3.5" aria-hidden /> No evidence yet
            </p>
            <p className="mt-1 text-[13px] text-ink-soft">{m.thoroughNote}</p>
          </div>
        )
      )}
    </div>
  );
}

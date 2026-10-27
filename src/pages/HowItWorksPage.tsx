import { ButtonLink, InfoNote } from "../components/ui";
import { CheckList, NotYetList } from "../components/CheckLists";

const stages = [
  {
    n: "1",
    title: "Discover & submit problems",
    body: "Anyone signed in can submit a real-world problem with the affected users, location, current workaround and evidence that it matters. Platform admins screen each submission — approve, request more info, or reject. Nothing is auto-approved and reviewers' notes are stored with access control.",
  },
  {
    n: "2",
    title: "Cohorts & teams",
    body: "An authorised institution or college runs a cohort (typically one college, five teams, 20–30 students). Teams form inside a cohort; members are 'proposed' until they personally accept. Team data is private to members, assigned mentors, cohort staff and authorised problem owners.",
  },
  {
    n: "3",
    title: "Validate the problem",
    body: "Teams conduct genuine, consented adult interviews, recorded with anonymised participant labels, consent confirmation and key findings. The suggested gate is eight interviews per team before a validation decision — configurable by facilitators. Raw notes stay private, forever. Decisions can be continue, pivot or stop; stopping is a legitimate, honest outcome.",
  },
  {
    n: "4",
    title: "Feasibility assessment",
    body: "A structured review across technical feasibility, cost/resources, time, access to users, dependencies, risks and expected value, ending in a recommended next step. Reviewers leave feedback. A feasibility review is opinion-grounded analysis — never a guarantee of success.",
  },
  {
    n: "5",
    title: "Prototype & test (optional)",
    body: "Teams that continue build something testable: a prototype description, test plan, tasks, numbers of users approached vs actually tested, feedback and observed problems. A reviewer records continue / revise / stop.",
  },
  {
    n: "6",
    title: "Proof Cards",
    body: "The team compiles a Proof Card: what was investigated, what evidence showed, what was built, actual results and limitations, skills demonstrated with supporting evidence and contributor roles. It starts as a private draft, is reviewed by authorised facilitators/mentors, and only approved cards can be published publicly by institution or platform admins.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6">
      <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brand-600">The BuildProof process</p>
      <h1 className="display-title mt-2 text-3xl sm:text-4xl">From real problems to proven skills.</h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Six stages with real persistence, real reviews and real access control. Here's exactly what
        happens at each stage — and what stays private.
      </p>

      <ol className="mt-10 space-y-4">
        {stages.map((s) => (
          <li key={s.n} className="rounded-card border border-line bg-surface p-5 shadow-card">
            <div className="flex items-start gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 font-display text-[15px] font-extrabold text-white">
                {s.n}
              </span>
              <div>
                <h2 className="display-title text-[16px]">{s.title}</h2>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{s.body}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-10">
        <h2 className="display-title text-2xl">Verification tiers, plainly explained</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { tier: "Tier 1", title: "Self-reported", body: "Written by the team. No independent review yet. Always labelled clearly." },
            { tier: "Tier 2", title: "Evidence reviewed", body: "An authorised facilitator or mentor reviewed the evidence and confirmed the summary." },
            { tier: "Tier 3", title: "Owner-confirmed", body: "The problem owner or sponsor confirmed the work or outcome — a real person, not a button." },
          ].map((t) => (
            <div key={t.tier} className="rounded-card border border-line bg-surface p-5 shadow-card">
              <Badgeish tier={t.tier} />
              <h3 className="display-title mt-2 text-[15px]">{t.title}</h3>
              <p className="mt-1 text-[13px] text-ink-soft">{t.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <InfoNote>
            A team submits claims; reviewers decide tiers. Nobody — not even team captains — can
            raise their own tier from the app.
          </InfoNote>
        </div>
      </section>

      <section className="mt-10 grid gap-3 sm:grid-cols-2">
        <CheckList />
        <NotYetList />
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink to="/signup" size="lg">Get started</ButtonLink>
        <ButtonLink to="/for-students" variant="secondary" size="lg">Student workflow</ButtonLink>
      </div>
    </div>
  );
}

function Badgeish({ tier }: { tier: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-1 text-[11px] font-bold text-brand-700">
      {tier}
    </span>
  );
}

import { ButtonLink } from "../components/ui";
import { DemoCard, DomainHero, StatusBadge } from "../components/DomainKit";
import { hardwareDemos } from "../lib/demoData";

const STAGES = [
  "Concept & problem definition",
  "Research & technical feasibility",
  "Design & component selection",
  "Bill of materials & estimated cost",
  "Prototype construction",
  "Functional testing",
  "Safety & reliability assessment",
  "User / environmental testing",
  "Design improvements",
  "Manufacturing feasibility",
  "Pilot deployment",
  "Funding or production discussions",
];

export default function PublicHardwarePage() {
  return (
    <div className="pb-20">
      <DomainHero
        kicker="Hardware Innovation"
        title="From student prototype to manufacturable product"
        intro="Hardware deserves its own engineering pathway — robots, machines, sensors, automation, electronics, assistive devices and agri-tech. Students can register a project at any stage; nobody restarts from zero. What works, what remains and what evidence supports each claim are recorded separately, so funders can evaluate without mistaking a prototype for a production-ready product."
        actions={
          <>
            <ButtonLink to="/signup" size="md">Register a hardware project</ButtonLink>
            <ButtonLink to="/startups-funding" variant="secondary" size="md">Explore funding pathways</ButtonLink>
          </>
        }
      />

      {/* 12-stage pathway */}
      <div className="mx-auto mt-8 w-full max-w-6xl px-4 sm:px-6">
        <div className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-[14px] font-bold text-ink">The engineering pathway</h2>
          <ol className="mt-3 grid gap-1.5 text-[13px] text-ink-soft sm:grid-cols-2 lg:grid-cols-3">
            {STAGES.map((s, i) => (
              <li key={s} className="flex gap-2">
                <span className={`font-semibold ${i < 6 ? "text-brand-600" : "text-ink"}`}>{i + 1}.</span> {s}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">
            Projects enter at any stage. Near-complete prototypes get a dedicated track: what already works,
            remaining engineering, the testing needed before deployment, resources required, and who could help complete it.
          </p>
        </div>
      </div>

      {/* What gets recorded */}
      <div className="mx-auto mt-8 grid w-full max-w-6xl gap-3 px-4 sm:grid-cols-3 sm:px-6">
        {[
          ["Technical record", "Description, intended use, specifications, circuit/CAD documentation, BOM, estimated prototype and manufacturing costs."],
          ["Evidence & safety", "Test methods and measured results, safety considerations, performance limitations, evidence notes — hypothetical values always labelled."],
          ["Ownership & funding", "IP status, required equipment or lab access, potential buyers, funding needs, manufacturing partners or support needs."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-card border border-line bg-surface p-4">
            <h3 className="text-[13px] font-bold text-ink">{t}</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{d}</p>
          </div>
        ))}
      </div>

      {/* Demo projects */}
      <div className="mx-auto mt-12 w-full max-w-6xl px-4 sm:px-6">
        <h2 className="display-title text-2xl">Two fictional hardware walkthroughs</h2>
        <p className="mt-2 max-w-2xl text-[14px] text-ink-soft">
          A prototype still being engineered, and how a funder could responsibly evaluate it. All measurements and costs are hypothetical and labelled.
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {hardwareDemos.map((d) => <DemoCard key={d.id} demo={d} />)}
        </div>
      </div>

      {/* Honesty rule */}
      <div className="mx-auto mt-10 w-full max-w-6xl px-4 sm:px-6">
        <div className="rounded-card border border-line bg-surface p-4 text-[12.5px] leading-relaxed text-ink-soft">
          <StatusBadge status="unverified" />
          <p className="mt-2">
            Nothing here is labelled production-ready without appropriate evidence, and funding decisions never
            replace necessary safety, regulatory or engineering reviews. Hardware records in the app are private to
            the team and its reviewers by default — public showcase happens only when a team chooses to publish.
          </p>
        </div>
      </div>
    </div>
  );
}

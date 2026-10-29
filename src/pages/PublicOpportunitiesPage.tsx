import { useEffect, useState } from "react";
import { ButtonLink } from "../components/ui";
import {
  DemoCard, DomainHero, ListingCard, StatusBadge, VerificationNote,
} from "../components/DomainKit";
import { errMessage, listOpportunities } from "../lib/api";
import type { JobOpportunity } from "../types/database";
import { opportunityDemos } from "../lib/demoData";

type JobRow = JobOpportunity & { organization: { name: string; verification_status: string } | null };

const KIND_LABELS: Record<string, string> = {
  internship: "Internship",
  entry_level: "Entry-level role",
  apprenticeship: "Apprenticeship / supervised learning",
  research: "Research opportunity",
  hardware_role: "Hardware development role",
  founding_team: "Startup founding team",
  project_contract: "Project-based paid contract",
};

export default function PublicOpportunitiesPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let live = true;
    listOpportunities()
      .then((rows) => { if (live) setJobs(rows as JobRow[]); })
      .catch((e) => { if (live) setError(errMessage(e)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const filtered = jobs.filter(
    (j) => (kind === "all" || j.kind === kind) && (!query || `${j.title} ${j.description}`.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="pb-20">
      <DomainHero
        kicker="Opportunities"
        title="Internships, roles and continued work — matched by evidence"
        intro="BuildProof connects evidence of real work to opportunities, rather than acting as a generic job board. Relevance is explained through demonstrated skills, task complexity, deliverable quality, reviewer feedback and reliability — never a single numeric score. Project work is always recorded as project work, never dressed up as formal employment."
        actions={
          <>
            <ButtonLink to="/signup" size="md">Apply with your Proof</ButtonLink>
            <ButtonLink to="/company-projects" variant="secondary" size="md">Also see paid projects</ButtonLink>
          </>
        }
      />

      {/* What matching considers */}
      <div className="mx-auto mt-8 w-full max-w-6xl px-4 sm:px-6">
        <div className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-[14px] font-bold text-ink">What evidence-based matching considers</h2>
          <ul className="mt-2 grid gap-1.5 text-[12.5px] text-ink-soft sm:grid-cols-3">
            {[
              "Skills demonstrated and tasks completed",
              "Complexity of previous work",
              "Actual individual contributions",
              "Quality of deliverables and testing",
              "Documentation and collaboration",
              "Reliability and deadline history",
              "Reviewer feedback",
              "Relevant domain experience",
              "Stated interests and availability",
            ].map((i) => (
              <li key={i} className="flex gap-2"><span className="text-brand-600">•</span>{i}</li>
            ))}
          </ul>
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">
            The app also explains which requirements remain unmet. Companies can view a contributor's permitted
            project history and progress over time — but previous experience never guarantees hiring.
          </p>
        </div>
      </div>

      {/* Kind filter — distinguish experience types */}
      <div className="mx-auto mt-8 w-full max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={`rounded-md border px-2.5 py-1.5 text-[12.5px] font-medium ${kind === "all" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line bg-surface text-ink-soft"}`}
            onClick={() => setKind("all")}
          >
            All kinds
          </button>
          {Object.entries(KIND_LABELS).map(([k, label]) => (
            <button
              key={k}
              className={`rounded-md border px-2.5 py-1.5 text-[12.5px] font-medium ${kind === k ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line bg-surface text-ink-soft"}`}
              onClick={() => setKind(k)}
            >
              {label}
            </button>
          ))}
          <input
            className="min-w-[200px] flex-1 rounded-md border border-line bg-surface px-3 py-1.5 text-[12.5px]"
            placeholder="Search opportunities and skills…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search opportunities"
          />
        </div>
      </div>

      {/* Listings */}
      <div className="mx-auto mt-6 w-full max-w-6xl px-4 sm:px-6">
        <h2 className="text-[17px] font-bold text-ink">Open opportunities</h2>
        {error && <p className="mt-2 text-[13px] text-danger" role="alert">{error}</p>}
        {loading ? (
          <p className="mt-3 text-[13.5px] text-ink-soft">Loading opportunities…</p>
        ) : filtered.length === 0 ? (
          <div className="mt-3 rounded-card border border-dashed border-line bg-surface p-6 text-center">
            <p className="text-[14px] font-semibold text-ink">No opportunities listed yet.</p>
            <p className="mt-1 text-[13px] text-ink-soft">
              Opportunities come from organisations with real needs — nothing is invented to fill this space.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {filtered.map((j) => (
              <ListingCard key={j.id} title={j.title} badges={<StatusBadge status={j.status} />} skills={j.required_skills ?? []}>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={j.kind} />
                  {j.organization ? (
                    <>
                      <span className="text-[13px] font-semibold text-ink">{j.organization.name}</span>
                      <VerificationNote status={j.organization.verification_status} />
                    </>
                  ) : <VerificationNote status={j.verification_status} />}
                </div>
                <p className="mt-2">{j.description}</p>
                <dl className="mt-2 space-y-1 text-[12.5px]">
                  <div className="grid grid-cols-[110px_1fr] gap-2">
                    <dt className="font-semibold text-ink">Location</dt>
                    <dd className="text-ink-soft">{j.location_type}{j.city ? ` — ${j.city}` : ""}</dd>
                  </div>
                  {j.commitment_note && (
                    <div className="grid grid-cols-[110px_1fr] gap-2">
                      <dt className="font-semibold text-ink">Commitment</dt>
                      <dd className="text-ink-soft">{j.commitment_note}</dd>
                    </div>
                  )}
                  {j.compensation_note && (
                    <div className="grid grid-cols-[110px_1fr] gap-2">
                      <dt className="font-semibold text-ink">Compensation</dt>
                      <dd className="text-ink-soft">{j.compensation_note}</dd>
                    </div>
                  )}
                </dl>
                <div className="mt-3"><ButtonLink to="/signup" size="sm" variant="secondary">Apply via the app</ButtonLink></div>
              </ListingCard>
            ))}
          </div>
        )}
      </div>

      {/* Demo progression */}
      <div className="mx-auto mt-12 w-full max-w-6xl px-4 sm:px-6">
        <h2 className="display-title text-2xl">A student journey, honestly told</h2>
        <p className="mt-2 max-w-2xl text-[14px] text-ink-soft">
          A fictional progression from beginner task to interview invitation — including what it does and does not imply.
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {opportunityDemos.map((d) => <DemoCard key={d.id} demo={d} />)}
        </div>
      </div>
    </div>
  );
}

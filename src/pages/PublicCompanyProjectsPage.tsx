import { useEffect, useState } from "react";
import { ButtonLink } from "../components/ui";
import {
  DemoCard, DomainHero, ListingCard, StatusBadge, VerificationNote, moneyRange,
} from "../components/DomainKit";
import { errMessage, listCompanyProjects } from "../lib/api";
import type { CompanyProject } from "../types/database";
import { companyProjectDemos } from "../lib/demoData";

type OrgRef = { name: string; kind: string; verification_status: string } | null;

type ProjectRow = CompanyProject & { organization: OrgRef };

export default function PublicCompanyProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<"all" | "beginner" | "intermediate" | "advanced">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let live = true;
    listCompanyProjects()
      .then((rows) => { if (live) setProjects(rows as ProjectRow[]); })
      .catch((e) => { if (live) setError(errMessage(e)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const filtered = projects.filter(
    (p) =>
      (level === "all" || p.level === level) &&
      (!query || `${p.title} ${p.description}`.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="pb-20">
      <DomainHero
        kicker="Company Projects"
        title="Paid, real-world work — terms agreed before anyone starts"
        intro="This is a separate marketplace from community problems: companies publish tasks based on current business needs, with defined deliverables, acceptance criteria, revision policy, IP terms and payment schedule. Scope and payment are set by the company and accepted by participants — nothing is assigned artificially by a level number."
        actions={<ButtonLink to="/signup" size="md">Post or apply via the app</ButtonLink>}
      />

      {/* Level explainer */}
      <div className="mx-auto mt-8 grid w-full max-w-6xl gap-3 px-4 sm:grid-cols-3 sm:px-6">
        {[
          ["Beginner", "Clearly scoped starter tasks — a UI fix, a landing page, a small dashboard component, documentation or data-cleaning. Always useful to the company, never filler."],
          ["Intermediate", "Dashboards with defined backends, API integrations, auth flows, data pipelines and documented workflow automation."],
          ["Advanced", "Complex backend services, production data pipelines, enterprise integrations and AI features with security, performance and reliability testing."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-card border border-line bg-surface p-4">
            <h3 className="text-[13px] font-bold text-ink">{t}</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{d}</p>
          </div>
        ))}
      </div>

      {/* Workflow */}
      <div className="mx-auto mt-8 w-full max-w-6xl px-4 sm:px-6">
        <div className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-[14px] font-bold text-ink">How a project runs</h2>
          <ol className="mt-3 grid gap-2 text-[13px] text-ink-soft sm:grid-cols-2">
            {[
              "Company posts the project with identity and business need.",
              "Platform checks the posting and business information.",
              "The listing is published; students or teams apply.",
              "The company reviews applicants and evidence.",
              "Both sides agree scope and terms before work starts.",
              "Tasks and milestones are tracked in the workspace.",
              "Deliverables are submitted against acceptance criteria.",
              "Revision rounds happen under the agreed policy.",
              "Payments are recorded through agreed milestones.",
              "The project closes with feedback and Proof Card records.",
            ].map((s, i) => (
              <li key={s} className="flex gap-2">
                <span className="font-semibold text-brand-600">{i + 1}.</span> {s}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">
            If deliverables miss the acceptance criteria, the agreement's revision and payment terms apply —
            contributors do not silently forfeit compensation, and companies do not pay until agreed evidence exists.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mx-auto mt-8 w-full max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "beginner", "intermediate", "advanced"] as const).map((l) => (
            <button
              key={l}
              className={`rounded-md border px-2.5 py-1.5 text-[12.5px] font-medium ${
                level === l ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line bg-surface text-ink-soft"
              }`}
              onClick={() => setLevel(l)}
            >
              {l === "all" ? "All levels" : l.charAt(0).toUpperCase() + l.slice(1)}
            </button>
          ))}
          <input
            className="min-w-[220px] flex-1 rounded-md border border-line bg-surface px-3 py-1.5 text-[12.5px]"
            placeholder="Search projects, skills, companies…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search company projects"
          />
        </div>
      </div>

      {/* Listings */}
      <div className="mx-auto mt-6 w-full max-w-6xl px-4 sm:px-6">
        <h2 className="text-[17px] font-bold text-ink">Open listings</h2>
        {error && <p className="mt-2 text-[13px] text-danger" role="alert">{error}</p>}
        {loading ? (
          <p className="mt-3 text-[13.5px] text-ink-soft">Loading listings…</p>
        ) : filtered.length === 0 ? (
          <div className="mt-3 rounded-card border border-dashed border-line bg-surface p-6 text-center">
            <p className="text-[14px] font-semibold text-ink">No company projects to show yet.</p>
            <p className="mt-1 text-[13px] text-ink-soft">
              Company accounts publish real listings here once registered and verified where applicable.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {filtered.map((p) => (
              <ListingCard
                key={p.id}
                title={p.title}
                badges={<StatusBadge status={p.status} />}
                skills={p.required_skills ?? []}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-ink">{p.organization?.name ?? "—"}</span>
                  {p.organization && <VerificationNote status={p.organization.verification_status} />}
                  <StatusBadge status={p.level} />
                </div>
                <p className="mt-2 line-clamp-4">{p.description}</p>
                <dl className="mt-2 space-y-1 text-[12.5px]">
                  {p.budget_min_amount != null && (
                    <div className="grid grid-cols-[110px_1fr] gap-2">
                      <dt className="font-semibold text-ink">Budget</dt>
                      <dd className="text-ink-soft">
                        {moneyRange(p.budget_min_amount, p.budget_max_amount, p.budget_currency)}
                      </dd>
                    </div>
                  )}
                  {p.duration_weeks != null && (
                    <div className="grid grid-cols-[110px_1fr] gap-2">
                      <dt className="font-semibold text-ink">Duration</dt>
                      <dd className="text-ink-soft">{p.duration_weeks} week{p.duration_weeks === 1 ? "" : "s"}, team of {p.team_size}</dd>
                    </div>
                  )}
                  {p.payment_terms && (
                    <div className="grid grid-cols-[110px_1fr] gap-2">
                      <dt className="font-semibold text-ink">Payments</dt>
                      <dd className="text-ink-soft">{p.payment_terms}</dd>
                    </div>
                  )}
                  {p.ip_terms && (
                    <div className="grid grid-cols-[110px_1fr] gap-2">
                      <dt className="font-semibold text-ink">IP terms</dt>
                      <dd className="text-ink-soft">{p.ip_terms}</dd>
                    </div>
                  )}
                </dl>
                <div className="mt-3 flex gap-2">
                  <ButtonLink to="/signup" size="sm" variant="secondary">Apply via the app</ButtonLink>
                </div>
              </ListingCard>
            ))}
          </div>
        )}
        <p className="mt-3 text-[12.5px] text-ink-soft">
          Applications, milestone tracking and payment records open inside the app after sign-in.
        </p>
      </div>

      {/* Demo tasks */}
      <div className="mx-auto mt-12 w-full max-w-6xl px-4 sm:px-6">
        <h2 className="display-title text-2xl">Beginner vs advanced, side by side</h2>
        <p className="mt-2 max-w-2xl text-[14px] text-ink-soft">
          Two fictional listings that show how scope, budget, security expectations and acceptance criteria change with complexity.
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {companyProjectDemos.map((d) => <DemoCard key={d.id} demo={d} />)}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { ButtonLink } from "../components/ui";
import {
  DemoCard, DomainHero, ListingCard, StatusBadge, filterCls, VerificationNote,
} from "../components/DomainKit";
import { listProblems, errMessage } from "../lib/api";
import type { Problem } from "../types/database";
import { problemDemos } from "../lib/demoData";

const SOURCE_FILTERS = [
  { key: "all", label: "All sources" },
  { key: "company", label: "Companies" },
  { key: "individual", label: "Individuals" },
  { key: "small_business", label: "Small businesses" },
  { key: "ngo", label: "NGO & community" },
  { key: "platform", label: "BuildProof-discovered" },
] as const;

export default function PublicProblemsPage() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<(typeof SOURCE_FILTERS)[number]["key"]>("all");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let live = true;
    listProblems()
      .then((rows) => { if (live) setProblems(rows.filter((p) => p.is_public)); })
      .catch((e) => { if (live) setError(errMessage(e)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const sourceLabels: Record<string, string> = {
    company: "Company-submitted", individual: "Individual-submitted", small_business: "Small business",
    ngo: "NGO / community", platform: "BuildProof-discovered",
  };

  const filtered = problems.filter((p) => {
    if (source !== "all" && p.source_type !== source) return false;
    if (category !== "all" && p.category !== category) return false;
    if (query && !`${p.title} ${p.description}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="pb-20">
      <DomainHero
        kicker="Problems"
        title="Real problems, waiting for real teams"
        intro="Problems come from companies, individuals, small businesses, NGOs and BuildProof's own research. Each is categorised by source and reviewed before display. Submitting a problem does not make the submitter a paying customer — company-submitted problems are matched to separate paid-project workflows."
        actions={
          <>
            <ButtonLink to="/submit-problem" size="md">Submit a problem</ButtonLink>
            <ButtonLink to="/signup" variant="secondary" size="md">Form a team</ButtonLink>
          </>
        }
      />

      {/* Categories explainer */}
      <div className="mx-auto mt-8 grid w-full max-w-6xl gap-3 px-4 sm:grid-cols-5 sm:px-6">
        {[
          ["Company-submitted", "Established companies or startups with genuine requirements. Verification status shown honestly."],
          ["Individual", "Everyday, education, agriculture, accessibility and community problems from real people."],
          ["Small business", "Retailers, manufactures, service providers and local enterprises."],
          ["NGO & community", "NGOs, institutions and public-interest organisations."],
          ["BuildProof-discovered", "Problems BuildProof identifies from public or independent research — never claimed as endorsements."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-card border border-line bg-surface p-4">
            <h3 className="text-[13px] font-bold text-ink">{t}</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{d}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mx-auto mt-8 w-full max-w-6xl px-4 sm:px-6">
        <div className="rounded-card border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            {SOURCE_FILTERS.map((f) => (
              <button key={f.key} className={filterCls(source === f.key)} onClick={() => setSource(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12.5px]"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter by domain"
            >
              <option value="all">All domains</option>
              {["education", "local_business", "accessibility", "sustainability", "public_services", "operations", "technology", "other"].map((c) => (
                <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
              ))}
            </select>
            <input
              className="min-w-[220px] flex-1 rounded-md border border-line bg-surface px-3 py-1.5 text-[12.5px]"
              placeholder="Search problems…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search problems"
            />
          </div>
        </div>
      </div>

      {/* Live problems */}
      <div className="mx-auto mt-6 w-full max-w-6xl px-4 sm:px-6">
        <h2 className="text-[17px] font-bold text-ink">Submitted problems</h2>
        {error && <p className="mt-2 text-[13px] text-danger" role="alert">{error}</p>}
        {loading ? (
          <p className="mt-3 text-[13.5px] text-ink-soft">Loading problems…</p>
        ) : filtered.length === 0 ? (
          <div className="mt-3 rounded-card border border-dashed border-line bg-surface p-6 text-center">
            <p className="text-[14px] font-semibold text-ink">No problems match these filters yet.</p>
            <p className="mt-1 text-[13px] text-ink-soft">Be the first to document a real problem worth solving.</p>
            <div className="mt-3"><ButtonLink to="/submit-problem">Submit the first problem</ButtonLink></div>
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
                <dl className="space-y-1.5 text-[12.5px]">
                  <div className="grid grid-cols-[110px_1fr] gap-2">
                    <dt className="font-semibold text-ink">Source</dt>
                    <dd className="text-ink-soft">{sourceLabels[p.source_type] ?? p.source_type}</dd>
                  </div>
                  <div className="grid grid-cols-[110px_1fr] gap-2">
                    <dt className="font-semibold text-ink">Who</dt>
                    <dd className="text-ink-soft">{p.affected_users}</dd>
                  </div>
                  {p.budget_note && (
                    <div className="grid grid-cols-[110px_1fr] gap-2">
                      <dt className="font-semibold text-ink">Budget</dt>
                      <dd className="text-ink-soft">{p.budget_note}</dd>
                    </div>
                  )}
                  {p.timeline_note && (
                    <div className="grid grid-cols-[110px_1fr] gap-2">
                      <dt className="font-semibold text-ink">Timeline</dt>
                      <dd className="text-ink-soft">{p.timeline_note}</dd>
                    </div>
                  )}
                </dl>
                <p className="mt-2 line-clamp-3 text-ink-soft">{p.description}</p>
                {p.source_type === "company" && (
                  <p className="mt-2"><VerificationNote status="unverified" /></p>
                )}
              </ListingCard>
            ))}
          </div>
        )}
        <p className="mt-3 text-[12.5px] text-ink-soft">
          Full problem briefs, participation options and owner contact open inside the app after sign-in.
        </p>
      </div>

      {/* Demo examples */}
      <div className="mx-auto mt-12 w-full max-w-6xl px-4 sm:px-6">
        <h2 className="display-title text-2xl">How problems appear here</h2>
        <p className="mt-2 max-w-2xl text-[14px] text-ink-soft">
          Two illustrative examples that teach what a complete problem brief looks like.
          These are fictional and are the only fictional items on this page.
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {problemDemos.map((d) => <DemoCard key={d.id} demo={d} />)}
        </div>
      </div>

      {/* Ownership note */}
      <div className="mx-auto mt-10 w-full max-w-6xl px-4 sm:px-6">
        <div className="rounded-card border border-line bg-surface p-4 text-[12.5px] leading-relaxed text-ink-soft">
          <strong className="text-ink">Understand your submission.</strong> Submitting a problem documents a
          need — it does not create a contract, a payment obligation, or an endorsement by BuildProof.
          Company-paid work flows separately through Company Projects with explicit terms.
        </div>
      </div>
    </div>
  );
}

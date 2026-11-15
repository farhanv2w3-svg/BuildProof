import { useEffect, useState } from "react";
import { ButtonLink, Badge, InfoNote } from "../components/ui";
import {
  DemoBadge, DemoBlock, DemoCard, DomainHero, ListingCard, StatusBadge, filterCls, VerificationNote,
} from "../components/DomainKit";
import { listProblems, errMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
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
  const { user } = useAuth();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<(typeof SOURCE_FILTERS)[number]["key"]>("all");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");

  /* LIVE DATA POLICY (§5): `problems` is authenticated-only by design
     (migration 0001:716-718 — anonymous visitors see no live rows, and the
     database intentionally has NO anonymous policy for this table).

     - Signed-out visitors: no query is attempted; they see demo content and a
       clear sign-in explanation instead of a raw Postgres permission error.
     - Signed-in users: the live pool is loaded and filtered to rows intended
       for public display (is_public) that passed review (approved). */
  useEffect(() => {
    if (!user) { setProblems([]); setError(null); return; }
    let live = true;
    setLoading(true);
    listProblems()
      .then((rows) => {
        if (live) setProblems(rows.filter((p) => p.is_public && p.status === "approved"));
      })
      .catch((e) => { if (live) setError(errMessage(e)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [user]);

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

      <div className="mx-auto mt-8 w-full max-w-6xl px-4 sm:px-6">
        {/* Filters — they operate on the live list for signed-in users */}
        <div className="rounded-card border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            {SOURCE_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setSource(f.key)}
                className={filterCls(source === f.key)}
              >
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
              className="min-w-[220px] flex-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12.5px]"
              placeholder="Search problems…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search problems"
            />
          </div>
        </div>
      </div>

      {/* Live problems — status-aware block with loading / empty / error / sign-in states */}
      <div className="mx-auto mt-6 w-full max-w-6xl px-4 sm:px-6">
        <h2 className="text-[17px] font-bold text-ink">Submitted problems</h2>

        {!user && (
          <div className="mt-3">
            <InfoNote>
              <strong className="text-ink">Live problem briefs are available inside the app.</strong>{" "}
              Sign in to browse the reviewed problem pool — teams pick one of these problems to
              investigate and turn into a Proof Card. Everything below stays labelled as illustrative.
            </InfoNote>
            <div className="mt-3 flex gap-2">
              <ButtonLink to="/login" size="sm">Sign in</ButtonLink>
              <ButtonLink to="/signup" size="sm" variant="secondary">Create an account</ButtonLink>
            </div>
          </div>
        )}

        {user && loading && <p className="mt-3 text-[13.5px] text-ink-soft">Loading problems…</p>}

        {user && !loading && error && (
          <div className="mt-3 rounded-lg border border-warn/30 bg-warn-soft px-4 py-3 text-[13.5px] text-warn" role="alert">
            <p>Live problems couldn't be loaded just now — this is usually temporary.</p>
            <div className="mt-2 flex gap-2">
              <ButtonLink to="/login" size="sm" variant="secondary">Reload the page</ButtonLink>
            </div>
          </div>
        )}

        {user && !loading && !error && filtered.length === 0 && (
          <div className="mt-3 rounded-card border border-dashed border-line bg-surface p-6 text-center">
            <p className="text-[14px] font-semibold text-ink">No problems match these filters yet.</p>
            <p className="mt-1 text-[13px] text-ink-soft">Be the first to document a real problem worth solving.</p>
            <div className="mt-3"><ButtonLink to="/submit-problem">Submit the first problem</ButtonLink></div>
          </div>
        )}

        {user && !loading && !error && filtered.length > 0 && (
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
                  <p className="mt-2">
                    {/* Honest screening state (not a fabricated "verified" claim):
                        problems have no org-verification column, but approved
                        problems HAVE been reviewed by BuildProof reviewers. */}
                    {p.status === "approved"
                      ? <Badge tone="info">Reviewed & approved by BuildProof reviewers</Badge>
                      : <VerificationNote status="unverified" />}
                  </p>
                )}
              </ListingCard>
            ))}
          </div>
        )}
        <p className="mt-3 text-[12.5px] text-ink-soft">
          Full problem briefs, participation options and owner contact open inside the app after sign-in.
          Contact details are never shown publicly.
        </p>
      </div>

      {/* Demo examples */}
      <div className="mx-auto mt-12 w-full max-w-6xl px-4 sm:px-6">
        <h2 className="display-title text-2xl">How problems appear here</h2>
        <p className="mt-2 max-w-2xl text-[14px] text-ink-soft">
          Two illustrative examples that teach what a complete problem brief looks like — plus one
          end-to-end walkthrough of a fictional problem taken the whole way to a Proof Card.
          These are fictional and are the only fictional items on this page.
        </p>

        {/* End-to-end demo walkthrough entry (client-only fictional content) */}
        <DemoBlock className="mt-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <DemoBadge />
              <h3 className="mt-2 text-[16px] font-bold text-ink">
                End-to-end demo: Reducing Material Wastage in Small Manufacturing Units
              </h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
                Follow one fictional problem from Demo Manufacturing Solutions through a 7-day student
                sprint — team roles, weighted milestones, example evidence, testing and the generated
                Proof Card with every metric explained. Everything is fictional and clearly labelled.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone="warn">DEMO</Badge>
                <Badge tone="warn">FICTIONAL ORGANISATION</Badge>
                <Badge tone="warn">ILLUSTRATIVE RESULTS</Badge>
              </div>
            </div>
            <div className="flex flex-col items-start gap-2">
              <ButtonLink to="/problems/demo-material-wastage" size="sm">
                Explore the full demo walkthrough
              </ButtonLink>
              <span className="text-[11.5px] text-ink-soft">No sign-in needed — demo content only</span>
            </div>
          </div>
        </DemoBlock>

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

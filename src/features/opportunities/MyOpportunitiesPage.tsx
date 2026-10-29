import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listOpportunities, applyToOpportunity, listMyOpportunityApplications, withdrawOpportunityApplication } from "../../lib/api";
import type { JobOpportunity, OpportunityApplication } from "../../types/database";
import {
  Button, ButtonLink, Card, EmptyState, ErrorBanner, LoadingBlock, Textarea,
} from "../../components/ui";
import { DemoCard, StatusBadge, VerificationNote } from "../../components/DomainKit";
import { demoCareerProgression } from "../../lib/demoData";
import { useAuth } from "../../lib/auth";

type JobRow = JobOpportunity & { organization: { name: string; verification_status: string } | null };
type AppRow = OpportunityApplication & { opportunity: JobOpportunity | null };

export default function MyOpportunitiesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appliedFor, setAppliedFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    listOpportunities()
      .then((rows) => { if (live) setJobs(rows as JobRow[]); })
      .catch((e) => { if (live) setError(e instanceof Error ? e.message : "Failed to load."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const { data: myApps } = useQuery({
    queryKey: ["myApplications", user?.id],
    queryFn: () => listMyOpportunityApplications(user!.id),
    enabled: !!user?.id,
  });
  const apps = (myApps ?? []) as AppRow[];
  const appliedIds = new Set(apps.map((a) => a.opportunity_id));

  async function apply(id: string) {
    setBusy(true); setError(null);
    try {
      await applyToOpportunity({ opportunity_id: id, user_id: user!.id, evidence_note: note.trim() || null, proof_card_id: null });
      setAppliedFor(null); setNote("");
      setNotice("Application recorded. The hiring side sees your evidence and Proof Cards — status changes appear below.");
      await qc.invalidateQueries({ queryKey: ["myApplications", user?.id] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit application.");
    } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="display-title text-2xl">Opportunities</h1>
        <p className="mt-1 max-w-2xl text-[14px] text-ink-soft">
          Project work is always recorded as project work — never dressed up as formal employment. Applications
          reference your actual contributions, not a single score.
        </p>
      </div>

      {/* My applications */}
      <Card className="mb-6 p-5">
        <h2 className="text-[15px] font-bold text-ink">My applications</h2>
        {apps.length === 0 ? (
          <p className="mt-2 text-[13px] text-ink-soft">No applications yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {apps.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-2.5">
                <div>
                  <p className="text-[13.5px] font-semibold text-ink">{a.opportunity?.title ?? "Opportunity"}</p>
                  <p className="text-[12px] text-ink-soft">Applied {new Date(a.created_at).toLocaleDateString()}</p>
                </div>
                <span className="flex items-center gap-2">
                  <StatusBadge status={a.status} />
                  {a.status === "submitted" && (
                    <Button size="sm" variant="ghost" onClick={async () => {
                      try { await withdrawOpportunityApplication(a.id); await qc.invalidateQueries({ queryKey: ["myApplications", user?.id] }); }
                      catch (e) { setError(e instanceof Error ? e.message : "Could not withdraw."); }
                    }}>Withdraw</Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {notice && <p className="mt-2 text-[12.5px] text-success" role="status">{notice}</p>}
      </Card>

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
      {loading && <LoadingBlock />}
      {jobs.length === 0 && !loading && (
        <EmptyState title="No opportunities listed yet" description="Opportunities come from organisations with real needs — nothing is invented to fill this space." />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {jobs.map((j) => (
          <Card key={j.id} className="flex h-full flex-col p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-[15px] font-bold text-ink">{j.title}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <StatusBadge status={j.kind} />
                  {j.organization && <><span className="text-[12.5px] font-semibold text-ink">{j.organization.name}</span><VerificationNote status={j.organization.verification_status} /></>}
                </div>
              </div>
              <StatusBadge status={j.status} />
            </div>
            <p className="mt-2 flex-1 text-[13px] text-ink-soft">{j.description}</p>
            <p className="mt-2 text-[12px] text-ink-soft">{j.location_type}{j.city ? ` — ${j.city}` : ""}{j.compensation_note ? ` · ${j.compensation_note}` : ""}{j.commitment_note ? ` · ${j.commitment_note}` : ""}</p>
            {appliedIds.has(j.id) ? (
              <div className="mt-3"><StatusBadge status={apps.find((a) => a.opportunity_id === j.id)?.status ?? "submitted"} /></div>
            ) : appliedFor === j.id ? (
              <div className="mt-3 border-t border-line pt-3">
                <Textarea
                  rows={3} maxLength={2000} value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why is this relevant? Reference specific deliverables, reviews and reliability evidence."
                  aria-label="Application note"
                />
                <div className="mt-2 flex gap-2">
                  <Button size="sm" loading={busy} onClick={() => apply(j.id)}>Submit application</Button>
                  <Button size="sm" variant="secondary" onClick={() => { setAppliedFor(null); setNote(""); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => setAppliedFor(j.id)}>Apply</Button>
                <ButtonLink size="sm" variant="secondary" to="/app/my-proof">Review my proof first</ButtonLink>
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="mt-10 max-w-2xl">
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brand-600">How matching feels</p>
        <div className="mt-2"><DemoCard demo={demoCareerProgression} compact /></div>
      </div>
    </div>
  );
}

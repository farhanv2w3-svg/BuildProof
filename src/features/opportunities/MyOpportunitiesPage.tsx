import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listOpportunities, applyToOpportunity, listMyOpportunityApplications, withdrawOpportunityApplication, listMyCards, listFundingOpportunities, applyForFunding, listMyTeamMemberships } from "../../lib/api";
import type { JobOpportunity, OpportunityApplication, FundingOpportunity } from "../../types/database";
import {
  Button, ButtonLink, Card, EmptyState, ErrorBanner, Input, LoadingBlock, Textarea,
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

  // B14: the applicant's own Proof Cards — attachable to an application so the
  // hiring side sees verifiable evidence, not just a note. Ownership is
  // enforced by RLS; only the user's own team cards are ever returned.
  const { data: myCards } = useQuery({
    queryKey: ["myCards", user?.id],
    queryFn: () => listMyCards(user!.id),
    enabled: !!user?.id && appliedFor !== null,
  });
  const [proofCardId, setProofCardId] = useState("");
  async function apply(id: string) {
    setBusy(true); setError(null);
    try {
      await applyToOpportunity({ opportunity_id: id, user_id: user!.id, evidence_note: note.trim() || null, proof_card_id: proofCardId || null });
      setAppliedFor(null); setNote(""); setProofCardId("");
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
                <div className="mb-2">
                  <label className="mb-1 block text-[12px] font-semibold text-ink" htmlFor={`proof-card-select-${j.id}`}>
                    Attach a Proof Card (optional)
                  </label>
                  <select
                    id={`proof-card-select-${j.id}`}
                    className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12.5px]"
                    value={proofCardId}
                    onChange={(e) => setProofCardId(e.target.value)}
                  >
                    <option value="">— None —</option>
                    {(myCards ?? []).map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                  {(myCards ?? []).length === 0 && (
                    <p className="mt-1 text-[11.5px] text-ink-soft">You have no Proof Cards yet — you can apply without one.</p>
                  )}
                </div>
                <Textarea
                  rows={3} maxLength={2000} value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why is this relevant? Reference specific deliverables, reviews and reliability evidence."
                  aria-label="Application note"
                />
                <div className="mt-2 flex gap-2">
                  <Button size="sm" loading={busy} onClick={() => apply(j.id)}>Submit application</Button>
                  <Button size="sm" variant="secondary" onClick={() => { setAppliedFor(null); setNote(""); setProofCardId(""); }}>Cancel</Button>
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

      {/* B9 — funding applications: teams (or individuals) apply to open
          funding programmes. Funder decisions live in the org workspace. */}
      <FundingApplySection />
    </div>
  );
}

function FundingApplySection() {
  const { user } = useAuth();
  const [funding, setFunding] = useState<FundingOpportunity[] | null>(null);
  const [fundErr, setFundErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    listFundingOpportunities()
      .then((rows) => { if (live) setFunding(rows.filter((f) => f.status !== "closed")); })
      .catch((e) => { if (live) setFundErr(e instanceof Error ? e.message : "Failed to load."); });
    return () => { live = false; };
  }, []);

  const { data: memberships } = useQuery({
    queryKey: ["myTeamMemberships", user?.id],
    queryFn: () => listMyTeamMemberships(user!.id),
    enabled: !!user?.id,
  });

  if (!user) return null;

  // Only funding programmes posted by organisations are shown to applicants here.
  const rows = (funding ?? []).filter((f) => f.organization_id !== null);

  return (
    <section className="mt-10">
      <h2 className="text-[15px] font-bold text-ink">Funding programmes open for applications</h2>
      <p className="mt-1 max-w-2xl text-[13px] text-ink-soft">
        Apply as yourself or on behalf of one of your teams. Funders see your pitch; decisions appear
        in the funder's workspace and your application status is visible to you only.
      </p>
      {fundErr && <div className="mt-2 max-w-xl"><ErrorBanner message={fundErr} /></div>}
      {funding === null ? (
        <p className="mt-3 text-[13px] text-ink-soft">Loading funding programmes…</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-soft">No open funding programmes right now.</p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {rows.map((f) => <FundingApplyRow key={f.id} funding={f} memberships={memberships ?? []} />)}
        </div>
      )}    </section>
  );
}

function FundingApplyRow({
  funding, memberships,
}: {
  funding: FundingOpportunity;
  memberships: { team: { id: string; name: string; status: string } | null }[];
}) {
  const [open, setOpen] = useState(false);
  const [teamId, setTeamId] = useState("");
  const [pitch, setPitch] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { user } = useAuth();

  const submit = async () => {
    setErr(null); setNote(null);
    if (pitch.trim().length < 20) {
      setErr("Write a pitch of at least 20 characters.");
      return;
    }
    setBusy(true);
    try {
      await applyForFunding({
        opportunity_id: funding.id,
        applicant: user!.id,
        applicant_team: teamId || null,
        pitch: pitch.trim(),
        requested_amount: amount === "" ? null : Math.max(0, Number(amount)),
      });
      setOpen(false);
      setPitch(""); setAmount(""); setTeamId("");
      setNote("Application submitted. The funder reviews it privately — nothing is public.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not submit application.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-[15px] font-bold text-ink">{funding.title}</h3>
        <StatusBadge status={funding.status} />
      </div>
      <p className="mt-2 flex-1 text-[13px] text-ink-soft">{funding.description}</p>
      {note && <p className="mt-2 text-[12.5px] text-success" role="status">{note}</p>}
      {err && <div className="mt-2"><ErrorBanner message={err} /></div>}
      {!open ? (
        <div className="mt-3"><Button size="sm" onClick={() => setOpen(true)}>Apply</Button></div>
      ) : (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-ink" htmlFor={`fund-team-${funding.id}`}>
              Apply on behalf of (optional)
            </label>
            <select
              id={`fund-team-${funding.id}`}
              className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12.5px]"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
            >
              <option value="">— Myself —</option>
              {memberships
                .filter((m) => m.team && m.team.status !== "stopped")
                .map((m) => (
                  <option key={m.team!.id} value={m.team!.id}>{m.team!.name}</option>
                ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-ink" htmlFor={`fund-pitch-${funding.id}`}>
              Pitch (at least 20 characters)
            </label>
            <Textarea
              id={`fund-pitch-${funding.id}`}
              rows={3}
              maxLength={3000}
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              placeholder="What would the funding enable? State scope, evidence and honest timelines."
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-ink" htmlFor={`fund-amount-${funding.id}`}>
              Requested amount in rupees (optional)
            </label>
            <Input
              id={`fund-amount-${funding.id}`}
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 25000"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" loading={busy} onClick={submit}>Submit application</Button>
            <Button size="sm" variant="secondary" onClick={() => { setOpen(false); setErr(null); }}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

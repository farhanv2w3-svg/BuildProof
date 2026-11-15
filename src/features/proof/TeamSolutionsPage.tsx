import { useOutletContext } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listTeamSolutions, createSolution, updateSolution, listSolutionInterests, updateInterestStatus,
  listTransferAgreements, proposeTransferAgreement, updateTransferAgreement,
} from "../../lib/api";
import type { Solution, SolutionInterest, SolutionTransferAgreement } from "../../types/database";
import {
  Button, Card, ErrorBanner, Field, Input, LoadingBlock, Select, Textarea,
} from "../../components/ui";
import { DemoCard, StatusBadge, VerificationNote } from "../../components/DomainKit";
import { demoSoftwareSolution } from "../../lib/demoData";
import { useAuth } from "../../lib/auth";

type Ctx = { team: { id: string; name: string } };

export default function TeamSolutionsPage() {
  const { team } = useOutletContext<Ctx>();

  const { data: solutions, isLoading } = useQuery({
    queryKey: ["teamSolutions", team.id],
    queryFn: () => listTeamSolutions(team.id),    enabled: !!team?.id,
  });

  if (isLoading) return <LoadingBlock />;
  const rows = (solutions ?? []) as Solution[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="display-title text-2xl">Marketplace</h1>
        <p className="mt-1 max-w-2xl text-[14px] text-ink-soft">
          Publish this team's tested work as a solution listing — with stage, evidence, limitations and next steps
          exposed only when the team chooses. Private and restricted listings never appear publicly.
        </p>
      </div>

      <Card className="p-5">
        <h2 className="text-[15px] font-bold text-ink">Listings from this team</h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-[13px] text-ink-soft">No listings yet. Create one below when a prototype is ready to represent honestly.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {rows.map((s) => <SolutionRow key={s.id} solution={s} teamId={team.id} />)}
          </ul>
        )}

        <NewListingForm teamId={team.id} />
      </Card>

      <Card className="p-5">
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brand-600">Example listing</p>
        <div className="mt-2"><DemoCard demo={demoSoftwareSolution} compact /></div>
        <p className="mt-2 text-[11.5px] text-ink-soft">Fictional example — real listings above come from database records you control.</p>
      </Card>
    </div>
  );
}

function NewListingForm({ teamId }: { teamId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [f, setF] = useState({ name: "", summary: "", category: "software", stage: "prototype", demo_url: "", limitations: "", next_steps: "", exposure: "restricted" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          if (f.name.trim().length < 4 || f.summary.trim().length < 20)
            throw new Error("Name needs 4+ characters and summary 20+.");
          await createSolution({
            team_id: teamId,
            proof_card_id: null,
            name: f.name.trim(),
            summary: f.summary.trim(),
            category: f.category as Solution["category"],
            stage: f.stage as Solution["stage"],
            exposure: f.exposure as Solution["exposure"],
            demo_url: f.demo_url.trim() || null,
            license_status: "unavailable",
            known_limitations: f.limitations.trim() || null,
            next_steps: f.next_steps.trim() || null,
            created_by: user!.id,
          });
          setF({ ...f, name: "", summary: "", demo_url: "", limitations: "", next_steps: "" });
          await qc.invalidateQueries({ queryKey: ["teamSolutions", teamId] });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not create listing.");
        } finally { setBusy(false); }
      }}
    >
      <Field label="Solution name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={4} maxLength={180} /></Field>
      <Field label="Category">
        <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          {["software", "ai_data", "business_automation", "education", "social_impact", "agriculture", "electronics", "robotics", "hardware", "other"].map((c) => (
            <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
          ))}
        </Select>
      </Field>
      <Field label="Development stage">
        <Select value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })}>
          {["prototype", "tested", "pilot", "commercially_in_use"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </Select>
      </Field>
      <Field label="Exposure (who can see it)">
        <Select value={f.exposure} onChange={(e) => setF({ ...f, exposure: e.target.value })}>
          <option value="private">Private — team only</option>
          <option value="restricted">Restricted — approved parties</option>
          <option value="listed">Listed — public marketplace</option>
        </Select>
      </Field>
      <div className="sm:col-span-2"><Field label="Summary (what it does, for whom)"><Textarea value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} rows={3} required minLength={20} maxLength={3000} /></Field></div>
      <Field label="Demo URL (optional)"><Input value={f.demo_url} onChange={(e) => setF({ ...f, demo_url: e.target.value })} maxLength={300} placeholder="https://…" /></Field>
      <div className="sm:col-span-2"><Field label="Known limitations (honesty builds trust)"><Textarea value={f.limitations} onChange={(e) => setF({ ...f, limitations: e.target.value })} rows={2} maxLength={2000} /></Field></div>
      <div className="sm:col-span-2"><Field label="Next steps needed"><Textarea value={f.next_steps} onChange={(e) => setF({ ...f, next_steps: e.target.value })} rows={2} maxLength={1500} /></Field></div>
      <div className="sm:col-span-2 flex items-center gap-3">
        <Button type="submit" loading={busy}>Create listing</Button>
        {error && <span className="text-[12.5px] text-danger" role="alert">{error}</span>}
      </div>
    </form>
  );
}

function SolutionRow({ solution, teamId }: { solution: Solution; teamId: string }) {
  const qc = useQueryClient();
  const { data: interests } = useQuery({
    queryKey: ["solutionInterests", solution.id],
    queryFn: () => listSolutionInterests(solution.id),
  });
  const { data: agreements } = useQuery({
    queryKey: ["agreements", solution.id],
    queryFn: () => listTransferAgreements(solution.id),
  });
  const [err, setErr] = useState<string | null>(null);

  const intRows = (interests ?? []) as (SolutionInterest & { profile: { full_name: string } | null })[];

  return (
    <li className="rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[14px] font-semibold text-ink">{solution.name}</p>
          <p className="text-[12px] text-ink-soft">{solution.category.replace(/_/g, " ")} · created {new Date(solution.created_at).toLocaleDateString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={solution.stage} />
          <StatusBadge status={solution.exposure} />
        </div>
      </div>
      {solution.known_limitations && <p className="mt-1 text-[12px] text-ink-soft"><strong>Limitations:</strong> {solution.known_limitations}</p>}

      <div className="mt-2 flex flex-wrap gap-2">
        {solution.license_status !== "seek_adopters" && (
          <Button size="sm" variant="secondary" onClick={async () => {
            try { await updateSolution(solution.id, { license_status: "seek_adopters", exposure: "listed" }); await qc.invalidateQueries({ queryKey: ["teamSolutions", teamId] }); }
            catch (e) { setErr(e instanceof Error ? e.message : "Failed."); }
          }}>List publicly & seek adopters</Button>
        )}
        {solution.license_status !== "unavailable" && (
          <Button size="sm" variant="ghost" onClick={async () => {
            try { await updateSolution(solution.id, { license_status: "unavailable", exposure: "restricted" }); await qc.invalidateQueries({ queryKey: ["teamSolutions", teamId] }); }
            catch (e) { setErr(e instanceof Error ? e.message : "Failed."); }
          }}>Unlist (back to restricted)</Button>
        )}
        {solution.exposure !== "private" && (
          <Button size="sm" variant="ghost" onClick={async () => {
            try { await updateSolution(solution.id, { exposure: "private" }); await qc.invalidateQueries({ queryKey: ["teamSolutions", teamId] }); }
            catch (e) { setErr(e instanceof Error ? e.message : "Failed."); }
          }}>Make private</Button>
        )}
      </div>
      {err && <div className="mt-2"><ErrorBanner message={err} /></div>}

      {intRows.length > 0 && (
        <div className="mt-3 border-t border-line pt-2">
          <h4 className="text-[12.5px] font-bold text-ink">Expressions of interest</h4>
          <ul className="mt-1 space-y-1.5">
            {intRows.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-line bg-surface px-2 py-1.5">
                <span className="text-[12px] text-ink-soft">
                  <strong className="text-ink">{i.profile?.full_name ?? "Interested party"}</strong> · {i.interest_type}{i.message ? ` — “${i.message}”` : ""}
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={i.status} />
                  <Select
                    aria-label="Interest status"
                    className="w-28 text-[11px]"
                    value={i.status}
                    onChange={async (e) => {
                      try { await updateInterestStatus(i.id, e.target.value as SolutionInterest["status"]); await qc.invalidateQueries({ queryKey: ["solutionInterests", solution.id] }); }
                      catch (err2) { setErr(err2 instanceof Error ? err2.message : "Failed."); }
                    }}
                  >
                    {["new", "in_contact", "closed"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                  </Select>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AgreementsSection solutionId={solution.id} rows={(agreements ?? []) as SolutionTransferAgreement[]} />
    </li>
  );
}

function AgreementsSection({ solutionId, rows }: { solutionId: string; rows: SolutionTransferAgreement[] }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [f, setF] = useState({ type: "license", terms: "", compensation: "", rights: "", attribution: true });
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="mt-3 border-t border-line pt-2">
      <h4 className="text-[12.5px] font-bold text-ink">Transfer agreements (negotiable drafts — not legal contracts)</h4>
      <p className="text-[11.5px] text-ink-soft">For consequential transactions both sides should get qualified legal advice.</p>
      {rows.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {rows.map((a) => (
            <li key={a.id} className="rounded border border-line bg-surface p-2.5 text-[12px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong className="text-ink">{a.agreement_type.replace(/_/g, " ")}</strong>
                  {a.attribution_keeping ? " · creator attribution kept" : " · attribution waived"} · proposed {new Date(a.created_at).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={a.status} />
                  <Select
                    aria-label="Agreement status"
                    className="w-36 text-[11px]"
                    value={a.status}
                    onChange={async (e) => {
                      try {
                        await updateTransferAgreement(a.id, {
                          status: e.target.value as SolutionTransferAgreement["status"],
                        });
                        await qc.invalidateQueries({ queryKey: ["agreements", solutionId] });
                      } catch (err2) { setErr(err2 instanceof Error ? err2.message : "Failed."); }
                    }}
                  >
                    {["draft", "under_discussion", "agreed", "executed", "cancelled"].map((s) => <option key={s} value={s} disabled={(s === "agreed" || s === "executed") && !(a.agreed_by_creator && a.agreed_by_other)}>{s.replace(/_/g, " ")}</option>)}
                  </Select>
                </span>
              </div>
              <p className="mt-1 text-ink-soft">{a.terms}</p>
              {a.compensation_note && <p className="text-ink-soft"><strong>Compensation:</strong> {a.compensation_note}</p>}
              {a.creator_rights_note && <p className="text-ink-soft"><strong>Creator rights:</strong> {a.creator_rights_note}</p>}
              <div className="mt-2 flex flex-wrap gap-2 border-t border-line pt-2">
                <Button
                  size="sm"
                  variant={a.agreed_by_creator ? "secondary" : "primary"}
                  disabled={a.agreed_by_creator || a.status === "cancelled"}
                  onClick={async () => {
                    try {
                      await updateTransferAgreement(a.id, { agreed_by_creator: true });
                      await qc.invalidateQueries({ queryKey: ["agreements", solutionId] });
                    } catch (err2) { setErr(err2 instanceof Error ? err2.message : "Failed to record consent."); }
                  }}
                >
                  {a.agreed_by_creator ? "Creator team consent recorded" : "Creator team consents"}
                </Button>
                {user?.id === a.proposed_by && (
                  <Button
                    size="sm"
                    variant={a.agreed_by_other ? "secondary" : "primary"}
                    disabled={a.agreed_by_other || a.status === "cancelled"}
                    onClick={async () => {
                      try {
                        await updateTransferAgreement(a.id, { agreed_by_other: true });
                        await qc.invalidateQueries({ queryKey: ["agreements", solutionId] });
                      } catch (err2) { setErr(err2 instanceof Error ? err2.message : "Failed to record consent."); }
                    }}
                  >
                    {a.agreed_by_other ? "Your consent recorded" : "I consent as proposer"}
                  </Button>
                )}
                <span className="self-center text-[11px] text-ink-soft">
                  Mutual consent: {a.agreed_by_creator && a.agreed_by_other ? "complete" : "pending"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {err && <p className="mt-1 text-[12px] text-danger" role="alert">{err}</p>}
      <form
        className="mt-2 grid gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            if (f.terms.trim().length < 20) throw new Error("Agreement terms need 20+ characters — spell out the actual deal.");
            await proposeTransferAgreement(
              {
                solution_id: solutionId,
                proposed_by: user!.id,
                agreement_type: f.type as SolutionTransferAgreement["agreement_type"],
                terms: f.terms.trim(),
                compensation_note: f.compensation.trim() || null,
                creator_rights_note: f.rights.trim() || null,
                attribution_keeping: f.attribution,
                confidential_access_note: null,
                status: "draft",
                agreed_by_creator: false,
                agreed_by_other: false,
              }
            );
            setF({ type: "license", terms: "", compensation: "", rights: "", attribution: true });
            await qc.invalidateQueries({ queryKey: ["agreements", solutionId] });
          } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Failed."); }
        }}
      >
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Type" className="w-44">
            <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              {["license", "assignment", "acquisition", "further_development"].map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </Select>
          </Field>
          <label className="flex items-center gap-2 pb-2 text-[12px] text-ink-soft">
            <input type="checkbox" className="h-3.5 w-3.5" checked={f.attribution} onChange={(e) => setF({ ...f, attribution: e.target.checked })} />
            Creators keep attribution
          </label>
        </div>
        <Field label="Terms — ownership, scope, confidentiality, revocation"><Textarea value={f.terms} onChange={(e) => setF({ ...f, terms: e.target.value })} rows={2} maxLength={4000} /></Field>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Compensation note" className="w-64"><Input value={f.compensation} onChange={(e) => setF({ ...f, compensation: e.target.value })} maxLength={1500} /></Field>
          <Field label="Creator rights note" className="w-64"><Input value={f.rights} onChange={(e) => setF({ ...f, rights: e.target.value })} maxLength={1000} /></Field>
          <Button type="submit" size="sm">Draft agreement</Button>
        </div>
      </form>
      <div className="mt-2"><VerificationNote status="unverified" /></div>
    </div>
  );
}

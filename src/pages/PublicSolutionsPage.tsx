import { useEffect, useState } from "react";
import { Button, ButtonLink, ErrorBanner } from "../components/ui";
import {
  DemoCard, DomainHero, ListingCard, StatusBadge, VerificationNote,
} from "../components/DomainKit";
import { errMessage, listSolutions, expressSolutionInterest, reportContent } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Solution } from "../types/database";
import { solutionDemos } from "../lib/demoData";

const CATEGORY_LABELS: Record<string, string> = {
  software: "Software prototype",
  ai_data: "AI & data",
  business_automation: "Business automation",
  education: "Educational tool",
  social_impact: "Social impact",
  agriculture: "Agriculture & sustainability",
  electronics: "Electronics & embedded",
  robotics: "Robotics & automation",
  hardware: "Hardware device",
  other: "Other",
};

export default function PublicSolutionsPage() {
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    listSolutions()
      .then((rows) => { if (live) setSolutions(rows); })
      .catch((e) => { if (live) setError(errMessage(e)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  return (
    <div className="pb-20">
      <DomainHero
        kicker="Solutions Marketplace"
        title="Work that already exists — with evidence"
        intro="Unlike Problems, these are prototypes teams have already built, tested or piloted. Each listing shows its stage, evidence, known limitations and licensing stance. A prototype existing never means it is commercially validated — every listing says exactly what is proven and what is not."
        actions={<ButtonLink to="/signup" size="md">Publish your solution</ButtonLink>}
      />

      <div className="mx-auto mt-8 grid w-full max-w-6xl gap-4 px-4 sm:px-6 lg:grid-cols-3">
        {[
          ["Stage, honestly labelled", "Prototype → Tested → Pilot → Commercially in use. Status changes require evidence, not optimism."],
          ["Permitted exposure", "Listed solutions show only what the team chose to publish. Confidential source and documents stay private."],
          ["Structured interest", "Adopters, founders and funders express interest through a recordable, trackable workflow."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-card border border-line bg-surface p-4">
            <h3 className="text-[13px] font-bold text-ink">{t}</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{d}</p>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-8 w-full max-w-6xl px-4 sm:px-6">
        <h2 className="text-[17px] font-bold text-ink">Listed solutions</h2>
        {error && <p className="mt-2 text-[13px] text-danger" role="alert">{error}</p>}
        {loading ? (
          <p className="mt-3 text-[13.5px] text-ink-soft">Loading solutions…</p>
        ) : solutions.length === 0 ? (
          <div className="mt-3 rounded-card border border-dashed border-line bg-surface p-6 text-center">
            <p className="text-[14px] font-semibold text-ink">No solutions are publicly listed yet.</p>
            <p className="mt-1 text-[13px] text-ink-soft">Teams publish here once they have a tested prototype and choose listing.</p>
            <div className="mt-3"><ButtonLink to="/signup">Start a project</ButtonLink></div>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {solutions.map((s) => (
              <ListingCard
                key={s.id}
                title={s.name}
                badges={<StatusBadge status={s.stage} />}
                skills={[]}
              >
                <span className="text-ink">{CATEGORY_LABELS[s.category] ?? s.category}</span>
                <p className="mt-1">{s.summary}</p>
                {s.known_limitations && (
                  <p className="mt-2 text-[12.5px]"><span className="font-semibold text-ink">Limitations:</span> {s.known_limitations}</p>
                )}
                {s.next_steps && (
                  <p className="mt-1 text-[12.5px]"><span className="font-semibold text-ink">Next steps:</span> {s.next_steps}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[12px] text-ink-soft">Licensing:</span> <StatusBadge status={s.license_status} />
                </div>
                {/* B8 — structured interest; B12 — honest reporting. */}
                <SolutionActions solutionId={s.id} ownerId={s.team_id} />
              </ListingCard>
            ))}
          </div>
        )}
      </div>

      <div className="mx-auto mt-12 w-full max-w-6xl px-4 sm:px-6">
        <h2 className="display-title text-2xl">What a listing teaches</h2>
        <p className="mt-2 max-w-2xl text-[14px] text-ink-soft">
          This fictional example shows how evidence, limitations and creator rights are presented.
          It is labelled fiction and never represents real activity.
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {solutionDemos.map((d) => <DemoCard key={d.id} demo={d} />)}
        </div>
      </div>

      <div className="mx-auto mt-10 w-full max-w-6xl px-4 sm:px-6">
        <VerificationNote status="unverified" />
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">
          Solutions move between private → restricted (approved parties only) → listed. Teams keep
          attribution; any transfer of ownership follows a written agreement step in the app before
          restricted access changes — and students' rights are never automatically removed.
        </p>
      </div>
    </div>
  );
}

/** B8 — interest expression + B12 — content reporting, per listed solution.
 * Duplicate interests are prevented by the database upsert
 * (solution_id,user_id,interest_type). Reports are visible to platform admins
 * only (RLS), never publicly. */
function SolutionActions({ solutionId }: { solutionId: string; ownerId: string | null }) {
  const { user } = useAuth();
  const [type, setType] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("misleading");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!user) {
    return (
      <p className="mt-2 text-[12px] text-ink-soft">
        <ButtonLink to="/login" size="sm" variant="secondary">Sign in</ButtonLink>{" "}
        to express structured interest in this solution or report a problem with it.
      </p>
    );
  }

  const send = async () => {
    setBusy(true); setErr(null);
    try {
      await expressSolutionInterest(solutionId, user.id, type as "license" | "fund" | "commission" | "collaborate" | "adopt" | "startup", null);
      setDone("Interest recorded. The team sees it in their workspace.");
      setType("");
    } catch (e) {
      setErr(errMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const report = async () => {
    setBusy(true); setErr(null);
    try {
      await reportContent({
        reporter: user.id,
        subject_type: "solution",
        subject_id: solutionId,
        reason: reason as "misleading" | "inappropriate" | "spam" | "other",
        detail: detail.trim() || null,
      });
      setReporting(false);
      setDetail("");
      setDone("Report recorded. Platform admins review reports privately.");
    } catch (e) {
      setErr(errMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 border-t border-line pt-3">
      {done && <p className="mb-2 text-[12.5px] font-medium text-success" role="status">{done}</p>}
      {err && <ErrorBanner message={err} />}
      {reporting ? (
        <div className="space-y-1.5">
          <select
            className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12.5px]"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-label="Report reason"
          >
            <option value="misleading">Misleading claims</option>
            <option value="inappropriate">Inappropriate content</option>
            <option value="spam">Spam</option>
            <option value="other">Other</option>
          </select>
          <textarea
            className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12.5px]"
            rows={2}
            maxLength={500}
            placeholder="What's wrong? (optional, admin-visible only)"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            aria-label="Report detail"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="danger" loading={busy} onClick={report}>Send report</Button>
            <Button size="sm" variant="secondary" onClick={() => setReporting(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <select
              className="min-w-[170px] rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12.5px]"
              value={type}
              onChange={(e) => setType(e.target.value)}
              aria-label="Interest type"
            >
              <option value="">— I'm interested to…</option>
              <option value="adopt">Adopt / use it</option>
              <option value="license">License it</option>
              <option value="commission">Commission work from this team</option>
              <option value="collaborate">Collaborate</option>
              <option value="fund">Fund it</option>
              <option value="startup">Start a company around it</option>
            </select>
            <Button size="sm" loading={busy} disabled={!type} onClick={send}>Express interest</Button>
            <Button size="sm" variant="ghost" onClick={() => setReporting(true)}>Report</Button>
          </div>
          <p className="mt-1 text-[11.5px] text-ink-soft">
            Interest is sent to the team as a record — nothing is promised or committed on your behalf.
          </p>
        </>
      )}
    </div>
  );
}

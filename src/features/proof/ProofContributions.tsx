import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listContributions, addContribution, deleteContribution } from "../../lib/api";
import type { ProofContribution } from "../../types/database";
import { Button, Field, Input, LoadingBlock, Select } from "../../components/ui";
import { StatusBadge } from "../../components/DomainKit";
import { useAuth } from "../../lib/auth";

/** Per-card contribution records: individual attribution, deliverable links,
 * paid-work flag and the kind of experience — deliberately separate from the
 * card's project outcome. Team editors record them; members see their own. */
export function ProofCardContributions({ cardId }: { cardId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [contribution, setContribution] = useState("");
  const [palLinks, setPalLinks] = useState("");
  const [kind, setKind] = useState<ProofContribution["kind"]>("project_work");
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: contributions, isLoading } = useQuery({
    queryKey: ["proofContributions", cardId],
    queryFn: () => listContributions(cardId!),
    enabled: !!cardId,
  });
  // Membership-sensitive listing: RLS decides which records this viewer may see.
  if (isLoading) return <LoadingBlock label="Loading contributions…" />;

  const rows = (contributions ?? []) as ProofContribution[];

  return (
    <div className="mt-4 border-t border-line pt-3">
      <h3 className="text-[13.5px] font-bold text-ink">Individual contributions</h3>
      {rows.length === 0 ? (
        <p className="mt-1 text-[12.5px] text-ink-soft">No contribution records yet. Team editors record who did what, with links to evidence.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {rows.map((r, i) => (
            <li key={r.id} className="flex items-start justify-between gap-2 rounded-lg border border-line p-2.5">
              <div>
                <p className="text-[12.5px] text-ink-soft">
                  <span className="font-semibold text-ink">{r.user_id === user?.id ? "You" : `Contributor ${i + 1}`}</span> · {r.kind.replace(/_/g, " ")}
                  {r.paid ? " · paid work" : ""}
                </p>
                <p className="text-[12.5px] text-ink-soft">{r.contribution}</p>
                {r.deliverable_links.length > 0 && (
                  <p className="mt-0.5 break-all text-[11.5px] text-ink-soft">Evidence links: {r.deliverable_links.join(", ")}</p>
                )}
                {r.outcome_note && <p className="mt-0.5 text-[11.5px] text-ink-soft">Outcome note: {r.outcome_note}</p>}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={r.paid ? "paid" : "agreed"} />
                <button
                  className="rounded p-1 text-[11px] text-ink-soft hover:text-danger"
                  aria-label="Delete contribution record"
                  onClick={async () => {
                    try { await deleteContribution(r.id); await qc.invalidateQueries({ queryKey: ["proofContributions", cardId] }); }
                    catch (e) { setError(e instanceof Error ? e.message : "Failed to delete."); }
                  }}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Recording form — RLS permits team editors only; others get an honest error */}
      <form
        className="mt-3 space-y-2 rounded-lg border border-dashed border-line p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (contribution.trim().length < 5) { setError("Describe the contribution (at least 5 characters)."); return; }
          setBusy(true); setError(null);
          try {
            const links = palLinks.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
            await addContribution(
              {
                card_id: cardId,
                user_id: user!.id,
                contribution: contribution.trim(),
                deliverable_links: links,
                outcome_note: null,
                paid,
                kind,
              }
            );
            setContribution(""); setPalLinks(""); setPaid(false);
            await qc.invalidateQueries({ queryKey: ["proofContributions", cardId] });
          } catch (err2) {
            setError(err2 instanceof Error ? err2.message : "Could not record contribution (team editors only).");
          } finally { setBusy(false); }
        }}
      >
        <Field label="Record a contribution (team editors)">
          <Input value={contribution} onChange={(e) => setContribution(e.target.value)} maxLength={2000} placeholder="e.g. Built the REST endpoints and wrote the integration tests" />
        </Field>
        <Field label="Deliverable links (one per line)">
          <Input value={palLinks} onChange={(e) => setPalLinks(e.target.value)} placeholder="repo URL, deployed demo, test report…" />
        </Field>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Experience type" className="w-48">
            <Select value={kind} onChange={(e) => setKind(e.target.value as ProofContribution["kind"])}>
              {["project_work", "community", "company_assignment", "internship", "employment", "founding"].map((k) => (
                <option key={k} value={k}>{k.replace(/_/g, " ")}</option>
              ))}
            </Select>
          </Field>
          <label className="flex items-center gap-2 pb-2 text-[12.5px] text-ink-soft">
            <input type="checkbox" className="h-3.5 w-3.5" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            This was paid work
          </label>
          <Button type="submit" size="sm" loading={busy}>Add record</Button>
        </div>
        {error && <p className="text-[12.5px] text-danger" role="alert">{error}</p>}
      </form>
    </div>
  );
}

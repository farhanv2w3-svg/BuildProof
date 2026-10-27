import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createTeamDecision, fetchTeamDecisions, errMessage } from "../../lib/api";
import { Badge, Button, ErrorBanner, Field, Textarea } from "../../components/ui";
import { decisionSchema } from "../../lib/validation";
import { titleize } from "../../lib/utils";
import { z } from "zod";

type DecisionForm = z.infer<typeof decisionSchema>;

/** Team decision recorder — continue / pivot / stop, with required rationale. */
export function DecisionPanel({
  teamId,
  userId,
  stage,
}: {
  teamId: string;
  userId: string;
  stage: DecisionForm["stage"];
}) {
  const qc = useQueryClient();
  const [decision, setDecision] = useState("");
  const [rationale, setRationale] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsed = decisionSchema.safeParse({ stage, decision, rationale });
  const canSubmit = parsed.success;

  return (
    <div className="space-y-3">
      {err && <ErrorBanner message={err} />}
      <div className="flex flex-wrap gap-2">
        {(["continue", "pivot", "stop"] as const).map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={decision === d}
            onClick={() => setDecision(d)}
            className={
              decision === d
                ? "rounded-lg border border-brand-600 bg-brand-50 px-3 py-1.5 text-[13px] font-semibold text-brand-700"
                : "rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-ink-soft hover:text-ink"
            }
          >
            {titleize(d)}
          </button>
        ))}
      </div>
      <Field label="Rationale" required>
        <Textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          rows={3}
          placeholder="Based on the evidence we saw…"
        />
      </Field>
      {!canSubmit && rationale.trim() !== "" && (
        <p className="text-[12.5px] text-danger">
          {decision === "" ? "Choose continue, pivot or stop." : parsed.error.issues[0]?.message}
        </p>
      )}
      <Button
        loading={busy}
        disabled={!canSubmit}
        onClick={async () => {
          if (!parsed.success) return;
          setBusy(true);
          setErr(null);
          try {
            await createTeamDecision(
              { team_id: teamId, stage, decision: parsed.data.decision, rationale: parsed.data.rationale },
              userId
            );
            setDecision("");
            setRationale("");
            await qc.invalidateQueries({ queryKey: ["decisions", teamId] });
          } catch (e) {
            setErr(errMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Record decision
      </Button>
    </div>
  );
}

/** Renders previously recorded decisions of a stage. */
export function DecisionList({
  teamId,
  stage,
}: {
  teamId: string;
  stage: DecisionForm["stage"];
}) {
  return <ExistingDecisions teamId={teamId} stage={stage} />;
}

function ExistingDecisions({ teamId, stage }: { teamId: string; stage: DecisionForm["stage"] }) {
  const { data: decisions } = useQuery({
    queryKey: ["decisions", teamId],
    queryFn: () => fetchTeamDecisions(teamId),
  });
  const list = (decisions ?? []).filter((d) => d.stage === stage);
  if (list.length === 0) return null;
  return (
    <ul className="border-t border-line px-5 py-4">
      {list.map((d) => (
        <li key={d.id} className="py-1 text-[13px]">
          <Badge tone={d.decision === "stop" ? "danger" : d.decision === "continue" ? "success" : "warn"}>
            {d.decision}
          </Badge>{" "}
          {d.rationale}
        </li>
      ))}
    </ul>
  );
}

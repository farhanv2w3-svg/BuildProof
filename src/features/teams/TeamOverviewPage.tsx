import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchTeam, fetchInterviews, fetchFeasibility, fetchPrototype, fetchTeamDecisions } from "../../lib/api";
import { Card, CardHeader, Badge, LoadingBlock, EmptyState } from "../../components/ui";
import { teamStatusLabel, interviewGap } from "../../lib/rbac";
import { formatDate } from "../../lib/utils";

/** Team overview: stage summary of validation → feasibility → testing → card. */
export default function TeamOverviewPage() {
  const { teamId } = useParams();
  const { data: team, isLoading } = useQuery({
    queryKey: ["team", teamId],
    queryFn: () => fetchTeam(teamId!),
    enabled: !!teamId,
  });
  const { data: interviews } = useQuery({
    queryKey: ["interviews", teamId],
    queryFn: () => fetchInterviews(teamId!),
    enabled: !!teamId,
  });
  const { data: feasibility } = useQuery({
    queryKey: ["feasibility", teamId],
    queryFn: () => fetchFeasibility(teamId!),
    enabled: !!teamId,
  });
  const { data: prototype } = useQuery({
    queryKey: ["prototype", teamId],
    queryFn: () => fetchPrototype(teamId!),
    enabled: !!teamId,
  });
  const { data: decisions } = useQuery({
    queryKey: ["decisions", teamId],
    queryFn: () => fetchTeamDecisions(teamId!),
    enabled: !!teamId,
  });

  if (isLoading) return <LoadingBlock />;
  if (!team) return <EmptyState title="Team not available" />;

  // For gate display we use a default of 8 when this team's cohort config isn't loaded.
  const gap = interviewGap(interviews ?? [], 8);
  const validationDecision = (decisions ?? []).find((d) => d.stage === "validation");

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader
          title="Current stage"
          sub={`Team status: ${teamStatusLabel({ status: team.status })}`}
        />
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-4">
          <StageChip
            n={1}
            title="Validate"
            state={
              validationDecision
                ? `decision: ${validationDecision.decision}`
                : `${gap.done}/${gap.target} interviews`
            }
            to={`evidence`}
          />
          <StageChip n={2} title="Feasibility" state={feasibility?.status ?? "not started"} to="feasibility" />
          <StageChip n={3} title="Prototype & test" state={prototype?.status ?? "optional / not started"} to="tests" />
          <StageChip n={4} title="Proof Card" state="create & review" to="evidence" />
        </div>
      </Card>

      <Card>
        <CardHeader title="Validation progress" sub="Genuine, consented adult interviews recorded by this team (suggested gate shown as guidance)." />
        <div className="px-5 pb-5">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${gap.percent}%` }} />
          </div>
          <p className="mt-2 text-[12.5px] text-ink-soft">
            {gap.done} consented interview{gap.done === 1 ? "" : "s"} recorded · suggested gate {gap.target}
            {gap.met ? " · gate met — you can record a validation decision" : ""}
          </p>
          <Link to={`evidence`} className="mt-3 inline-block text-[13px] font-semibold text-brand-700 hover:underline">
            Manage evidence & interviews →
          </Link>
        </div>
      </Card>

      {(decisions ?? []).length > 0 && (
        <Card>
          <CardHeader title="Recorded decisions" sub="Continue/pivot/stop records — stopping a weak idea is a legitimate outcome." />
          <ul className="px-5 pb-5">
            {(decisions ?? []).map((d) => (
              <li key={d.id} className="border-b border-line py-2 text-[13px] last:border-0">
                <Badge tone={d.decision === "stop" ? "danger" : d.decision === "continue" ? "success" : "warn"}>
                  {d.stage}
                </Badge>{" "}
                <strong className="ml-1">{d.decision}</strong> — {d.rationale}
                <span className="ml-2 text-[11.5px] text-ink-soft">{formatDate(d.created_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function StageChip({ n, title, state, to }: { n: number; title: string; state: string; to: string }) {
  return (
    <Link to={to} className="rounded-lg border border-line bg-canvas p-3 text-center transition-colors hover:border-brand-400">
      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">Stage {n}</p>
      <p className="mt-0.5 text-[13.5px] font-bold text-ink">{title}</p>
      <p className="mt-0.5 text-[11.5px] text-ink-soft">{state}</p>
    </Link>
  );
}

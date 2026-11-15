import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTeam, fetchInterviews, fetchFeasibility, fetchPrototype, fetchTeamDecisions, fetchTeamMembers, fetchComments, addComment, errMessage } from "../../lib/api";
import { Card, CardHeader, Badge, Button, LoadingBlock, EmptyState, Textarea, ErrorBanner } from "../../components/ui";
import { teamStatusLabel, interviewGap } from "../../lib/rbac";
import { formatDate } from "../../lib/utils";
import { ProofCardBuilder } from "../proof-cards/ProofCardBuilder";
import { useAuth } from "../../lib/auth";

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
  const { data: members } = useQuery({
    queryKey: ["teamMembers", teamId],
    queryFn: () => fetchTeamMembers(teamId!),
    enabled: !!teamId,
  });
  const { data: decisions } = useQuery({
    queryKey: ["decisions", teamId],
    queryFn: () => fetchTeamDecisions(teamId!),
    enabled: !!teamId,
  });
  const { user } = useAuth();
  const [cardFormOpen, setCardFormOpen] = useState(false);

  const isEditor = (members ?? []).some(
    (m) => m.user_id === user?.id && m.status === "accepted"
  );

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

      {/* B7 — team comments. fetchComments/addComment were implemented but
          never reachable from any page. Reviewer-audience comments are filtered
          by RLS: ordinary members never receive them. */}
      {isEditor && <TeamComments teamId={team.id} />}

      {/* B6 — Proof Card creation. Mounted here so team editors can actually
          create the card; the builder was fully implemented but never rendered
          anywhere before (createCard was unreachable). */}
      {isEditor && (
        <Card>
          <CardHeader
            title="Proof Card"
            sub="Compile your validated work into a card. It starts as a private draft — only reviewed, approved cards can ever be published by staff."
          />
          <div className="px-5 pb-5">
            {!cardFormOpen ? (
              <Button size="sm" onClick={() => setCardFormOpen(true)}>
                Build a Proof Card for this team
              </Button>
            ) : (
              <ProofCardBuilder teamId={team.id} />
            )}
          </div>
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

/** B7 — team comments (audience "team"). Author attribution comes from the
 * joined profile; the database policies already bind author_id to auth.uid()
 * so impersonation is impossible. */
function TeamComments({ teamId }: { teamId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { data: comments } = useQuery({
    queryKey: ["teamComments", teamId],
    queryFn: () => fetchComments(teamId, null),
  });

  const post = async () => {
    setErr(null);
    if (body.trim().length < 1) return;
    setBusy(true);
    try {
      await addComment(teamId, user!.id, body.trim(), "team");
      setBody("");
      await qc.invalidateQueries({ queryKey: ["teamComments", teamId] });
    } catch (e) {
      setErr(errMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Team notes" sub="Visible to you and your reviewers. Author names are the poster's own." />
      <div className="px-5 pb-5">
        {(comments ?? []).length === 0 ? (
          <p className="text-[13px] text-ink-soft">No notes yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {(comments ?? []).map((c) => (
              <li key={c.id} className="rounded-lg border border-line bg-canvas px-3 py-2 text-[13px]">
                <p className="font-semibold">
                  {c.profile?.full_name ?? "Member"}
                  <span className="ml-2 text-[11.5px] font-normal text-ink-soft">{formatDate(c.created_at)}</span>
                </p>
                {c.body}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap items-start gap-2">
          <Textarea
            className="min-w-[240px] flex-1"
            rows={2}
            maxLength={2000}
            placeholder="Add a note for the team and reviewers…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            aria-label="Comment"
          />
          <Button loading={busy} onClick={post}>Post</Button>
        </div>
        {err && <div className="mt-2"><ErrorBanner message={err} /></div>}
      </div>
    </Card>
  );
}

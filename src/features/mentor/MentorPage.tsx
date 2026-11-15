import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchMyMentorTeams, fetchTeam, fetchInterviews, fetchFeasibility, fetchPrototype, listEvidence, listMyReviewAssignments, submitReviewRecord, updateReviewAssignment, errMessage } from "../../lib/api";
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageTitle,
  Textarea,
  Button,
} from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { formatDate, titleize } from "../../lib/utils";
import type { ReviewDimension } from "../../types/database";

export default function MentorPage() {
  const { user } = useAuth();
  const { data: teams, isLoading } = useQuery({
    queryKey: ["mentorTeams", user?.id],
    queryFn: () => fetchMyMentorTeams(user!.id),
    enabled: !!user,
  });

  if (isLoading) return <LoadingBlock />;
  if (!user) return null;

  return (
    <div>
      <PageTitle
        title="Mentoring"
        sub="Teams assigned to you. Assignment is created by cohort staff — mentors only see explicitly assigned work."
      />
      {(teams ?? []).length === 0 ? (
        <EmptyState
          title="No teams assigned"
          description="When a facilitator assigns you a team, it appears here with its current state."
        />
      ) : (
        <div className="grid gap-4">
          {(teams ?? []).map((t) => (
            <MentorTeamCard key={t.id} teamId={t.id} />
          ))}
        </div>
      )}

      {/* B11 — reviewer programme: an assigned reviewer submits a structured,
          signed review here. Reviews are marked "verified" only by platform
          admins afterwards — never self-claimed. */}
      <section className="mt-10">
        <h2 className="display-title text-xl">My review assignments</h2>
        <p className="mt-1 max-w-2xl text-[13px] text-ink-soft">
          Structured reviews assigned to you by a platform admin. Your review is recorded with your
          name and later marked verified by BuildProof — state only what you checked.
        </p>
        <div className="mt-4 grid gap-4">
          <ReviewQueue userId={user!.id} />
        </div>
      </section>
    </div>
  );
}

function ReviewQueue({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["myReviewAssignments", userId],
    queryFn: () => listMyReviewAssignments(userId),
  });

  if (isLoading) return <LoadingBlock />;

  return (
    <>
      {err && <div><ErrorBanner message={err} /></div>}
      {(data ?? []).length === 0 ? (
        <EmptyState
          title="No review assignments"
          description="Admins assign structured reviews by email; assigned work appears here."
        />
      ) : (
        (data ?? []).map((a) => <ReviewAssignmentCard key={a.id} assignment={a} userId={userId} onBusy={(id) => setBusyId(id)} busyId={busyId} onError={setErr} onDone={qc} />)
      )}
    </>
  );
}

function ReviewAssignmentCard({
  assignment, userId, onBusy, busyId, onError, onDone,
}: {
  assignment: Awaited<ReturnType<typeof listMyReviewAssignments>>[number];
  userId: string;
  onBusy: (id: string | null) => void;
  busyId: string | null;
  onError: (s: string | null) => void;
  onDone: ReturnType<typeof useQueryClient>;
}) {
  const [verdict, setVerdict] = useState("");
  const [feedback, setFeedback] = useState("");
  const [note, setNote] = useState("");
  const [dim, setDim] = useState("");

  const submit = async () => {
    onError(null);
    if (verdict.trim().length === 0) {
      onError("Pick a verdict first.");
      return;
    }
    if (feedback.trim().length < 20) {
      onError("Write at least 20 characters of grounded feedback.");
      return;
    }
    onBusy(assignment.id);
    try {
      const dimensions: ReviewDimension[] = note.trim() && dim.trim()
        ? [{ name: dim.trim(), note: note.trim() }]
        : [];
      await submitReviewRecord({
        assignment_id: assignment.id,
        dimensions,
        verdict: verdict as "accepted" | "needs_revision" | "rejected" | "inconclusive",
        feedback: feedback.trim(),
      });
      await updateReviewAssignment(assignment.id, { status: "completed" });
      await onDone.invalidateQueries({ queryKey: ["myReviewAssignments", userId] });
    } catch (e) {
      onError(errMessage(e));
    } finally {
      onBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title={`${titleize(assignment.subject_type)} review`}
        sub={`${titleize(assignment.reviewer_type)} reviewer · subject ${assignment.subject_id.slice(0, 8)}… · ${titleize(assignment.status)}`}
        action={assignment.due_date ? <span className="text-[12px] text-ink-soft">Due {formatDate(assignment.due_date)}</span> : undefined}
      />
      {assignment.status !== "completed" && (
        <div className="px-5 pb-5">
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-ink">Verdict</span>
              <select
                className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12.5px]"
                value={verdict}
                onChange={(e) => setVerdict(e.target.value)}
                aria-label="Review verdict"
              >
                <option value="">— Verdict —</option>
                <option value="accepted">Accepted — work is backed by evidence</option>
                <option value="needs_revision">Needs revision</option>
                <option value="rejected">Rejected — claims not supported</option>
                <option value="inconclusive">Inconclusive</option>
              </select>
            </label>
            <label className="block flex-1 min-w-[240px]">
              <span className="mb-1 block text-[12px] font-semibold text-ink">Dimension assessed (optional)</span>
              <input
                className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12.5px]"
                value={dim}
                onChange={(e) => setDim(e.target.value)}
                placeholder="e.g. measurement methodology"
              />
            </label>
          </div>
          <div className="mt-2">
            <span className="mb-1 block text-[12px] font-semibold text-ink">Feedback (at least 20 characters)</span>
            <Textarea rows={3} maxLength={3000} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What did you check, what held up, what didn't?" />
          </div>
          <div className="mt-1">
            <span className="mb-1 block text-[12px] font-semibold text-ink">Dimension note (optional)</span>
            <input
              className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12.5px]"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="mt-3">
            <Button loading={busyId === assignment.id} onClick={submit}>Submit review</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function MentorTeamCard({ teamId }: { teamId: string }) {
  const { data: team } = useQuery({ queryKey: ["team", teamId], queryFn: () => fetchTeam(teamId) });
  const { data: interviews } = useQuery({ queryKey: ["interviews", teamId], queryFn: () => fetchInterviews(teamId) });
  const { data: feas } = useQuery({ queryKey: ["feasibility", teamId], queryFn: () => fetchFeasibility(teamId) });
  const { data: proto } = useQuery({ queryKey: ["prototype", teamId], queryFn: () => fetchPrototype(teamId) });
  const { data: attachments } = useQuery({ queryKey: ["evidence", teamId], queryFn: () => listEvidence(teamId) });

  if (!team) return null;
  return (
    <Card>
      <CardHeader
        title={team.name}
        sub={`Status: ${titleize(team.status)} · ${interviews?.length ?? 0} interviews · feasibility: ${feas ? titleize(feas.status) : "none"} · prototype: ${proto ? titleize(proto.status) : "none"} · attachments: ${attachments?.length ?? 0}`}
        action={
          <Link to={`/app/teams/${team.id}`} className="text-[13px] font-semibold text-brand-700 hover:underline">
            Open workspace →
          </Link>
        }
      />
      <ul className="px-5 pb-4 text-[12.5px] text-ink-soft">
        <li>Latest interview: {interviews?.[0] ? `${formatDate(interviews[0].interview_date)} — ${interviews[0].participant_label}` : "none"}</li>
        <li>Feasibility decision: {feas?.decision ? titleize(feas.decision) : "not recorded"}</li>
        <li>Prototype decision: {proto?.decision ? titleize(proto.decision) : "not recorded"}</li>
      </ul>
    </Card>
  );
}

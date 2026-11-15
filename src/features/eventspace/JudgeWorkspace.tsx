import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorBanner,
  Field,
  LoadingBlock,
  PageTitle,
  Select,
  SuccessBanner,
  Textarea,
  PrivacyNote,
} from "../../components/ui";
import {
  getEventById,
  getEvaluation,
  getSubmission,
  listMyJudgeAssignments,
  saveEvaluation,
  submissionFileDownloadUrl,
  listSubmissionFiles,
} from "../../lib/eventspace";
import { ES_SUBMISSION_FIELD_LABELS, ES_URL_FIELD_KEYS } from "../../lib/eventspaceRules";
import { errMessage } from "../../lib/api";
import { formatDate } from "../../lib/utils";

export default function JudgeWorkspace() {
  const { data: assignments, isLoading, error } = useQuery({
    queryKey: ["es_my_judge_assignments"],
    queryFn: listMyJudgeAssignments,
  });

  if (error) return <ErrorBanner message={errMessage(error)} />;

  return (
    <div className="space-y-5">
      <PageTitle title="Judge workspace" sub="You only see submissions explicitly assigned to you. Scores stay private." />

      {isLoading ? (
        <LoadingBlock />
      ) : !assignments || assignments.length === 0 ? (
        <EmptyState
          title="No assignments yet"
          description="When an organiser assigns a submission to you, it appears here with its evaluation rubric."
        />
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <AssignmentRow key={a.id} assignment={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function AssignmentRow({
  assignment,
}: {
  assignment: Awaited<ReturnType<typeof listMyJudgeAssignments>>[number];
}) {
  const { data: event } = useQuery({
    queryKey: ["es_event_by_id", assignment.event_id],
    queryFn: () => getEventById(assignment.event_id),
  });
  const { data: submission } = useQuery({
    queryKey: ["es_submission", assignment.submission_id],
    queryFn: () => getSubmission(assignment.submission_id),
  });

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-600">
            {event?.title ?? "Event"}
          </p>
          <p className="font-bold text-ink">
            {(submission?.data as Record<string, unknown>)?.["title"]?.toString() ?? "Loading project…"}
          </p>
          <p className="text-xs text-ink-soft">
            Assigned {formatDate(assignment.created_at)} · {assignment.status.replace(/_/g, " ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {submission ? (
            <Badge
              tone={assignment.status === "completed" ? "success" : assignment.status === "in_progress" ? "warning" : "neutral"}
            >
              {assignment.status.replace(/_/g, " ")}
            </Badge>
          ) : null}
          {submission ? (
            <Link to={`/app/eventspace/judging/${assignment.id}`} className="no-underline">
              <Button size="sm">{assignment.status === "completed" ? "Review evaluation" : "Evaluate"}</Button>
            </Link>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

/* --------------------------- evaluate page -------------------------- */

export function JudgeEvaluationPage() {
  const { assignmentId = "" } = useParams();
  const qc = useQueryClient();
  const { data: assignments } = useQuery({
    queryKey: ["es_my_judge_assignments"],
    queryFn: listMyJudgeAssignments,
  });
  const assignment = (assignments ?? []).find((a) => a.id === assignmentId);

  const { data: event } = useQuery({
    queryKey: ["es_event_by_id", assignment?.event_id ?? ""],
    queryFn: () => getEventById(assignment!.event_id),
    enabled: !!assignment,
  });
  const { data: submission, isLoading: subLoading } = useQuery({
    queryKey: ["es_submission", assignment?.submission_id ?? ""],
    queryFn: () => getSubmission(assignment!.submission_id),
    enabled: !!assignment,
  });
  const { data: evaluation, isLoading: evalLoading } = useQuery({
    queryKey: ["es_evaluation", assignmentId],
    queryFn: () => getEvaluation(assignmentId),
    enabled: !!assignment,
  });
  const { data: files } = useQuery({
    queryKey: ["es_judge_files", submission?.id ?? ""],
    queryFn: () => listSubmissionFiles(submission!.id),
    enabled: !!submission,
  });

  const criteria = event?.evaluation_criteria ?? [];
  const [scores, setScores] = useState<Record<string, number | null>>({});
  const [privateNotes, setPrivateNotes] = useState("");
  const [feedback, setFeedback] = useState("");
  const [recommendation, setRecommendation] = useState("none");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (evaluation) {
      const map: Record<string, number | null> = {};
      for (const s of evaluation.scores ?? []) map[s.criterion] = s.score;
      setScores(map);
      setPrivateNotes(evaluation.private_notes ?? "");
      setFeedback(evaluation.feedback ?? "");
      setRecommendation(evaluation.recommendation ?? "none");
    }
  }, [evaluation]);

  if (!assignments) return <LoadingBlock />;
  if (!assignment) return <EmptyState title="Assignment not found" description="This evaluation is not in your assignment list." />;
  if (subLoading || evalLoading) return <LoadingBlock label="Loading submission…" />;
  if (!submission || !event) return <EmptyState title="Submission unavailable" />;

  const scoredAll = criteria.every((c) => scores[c.name] !== undefined && scores[c.name] !== null);

  async function persist(isDraft: boolean) {
    setError(null);
    if (!isDraft && !scoredAll) {
      setError("Score every criterion before submitting your final evaluation.");
      return;
    }
    setBusy(true);
    try {
      await saveEvaluation({
        assignment_id: assignmentId,
        scores: criteria.map((c) => ({ criterion: c.name, score: scores[c.name] ?? null })),
        private_notes: privateNotes,
        feedback: feedback,
        recommendation: recommendation,
        is_draft: isDraft,
      });
      setSaved(isDraft ? "Draft saved." : "Final evaluation submitted.");
      qc.invalidateQueries({ queryKey: ["es_evaluation", assignmentId] });
      qc.invalidateQueries({ queryKey: ["es_my_judge_assignments"] });
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageTitle
        title="Evaluate submission"
        sub={`${event.title} · judged copy is the immutable snapshot at submission time`}
        action={
          <Link to="/app/eventspace/judging" className="no-underline">
            <Button variant="secondary">All assignments</Button>
          </Link>
        }
      />

      {saved ? <SuccessBanner message={saved} /> : null}
      {error ? <ErrorBanner message={error} /> : null}

      <Card>
        <CardHeader title="Project" />
        <div className="space-y-2 px-5 pb-5">
          {Object.entries(submission.snapshot ?? (submission.data as Record<string, unknown>)).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-line px-3 py-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">
                {ES_SUBMISSION_FIELD_LABELS[k as keyof typeof ES_SUBMISSION_FIELD_LABELS] ?? k.replace(/_/g, " ")}
              </p>
              {ES_URL_FIELD_KEYS.has(k) ? (
                <a className="break-all text-sm font-semibold text-brand-600 underline" href={String(v)} target="_blank" rel="noopener noreferrer">
                  {String(v)}
                </a>
              ) : (
                <p className="whitespace-pre-wrap break-words text-sm text-ink">{String(v)}</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {files && files.length > 0 ? (
        <Card>
          <CardHeader title="Files" sub="Short-lived private links; nothing is publicly accessible." />
          <ul className="space-y-2 px-5 pb-5">
            {files.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className="text-sm font-semibold text-brand-600 underline"
                  onClick={async () => {
                    try {
                      const url = await submissionFileDownloadUrl(f.object_key);
                      window.open(url, "_blank", "noopener");
                    } catch (e) {
                      setError(errMessage(e));
                    }
                  }}
                >
                  {f.file_name} ({f.kind}, {(f.size_bytes / 1048576).toFixed(1)} MB)
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Evaluation" sub="Each criterion is scored 0–10; the server computes the weighted total." />
        <div className="space-y-3 px-5 pb-5">
          {criteria.map((c) => (
            <div key={c.name} className="grid items-end gap-2 sm:grid-cols-6">
              <div className="sm:col-span-4">
                <Field label={`${c.name} (weight ${c.weight}%)`}>
                  <Select
                    value={scores[c.name] !== undefined && scores[c.name] !== null ? String(scores[c.name]) : ""}
                    onChange={(e) => setScores({ ...scores, [c.name]: e.target.value === "" ? null : Number(e.target.value) })}
                  >
                    <option value="">Not scored</option>
                    {Array.from({ length: 11 }, (_, i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              {c.description ? <p className="text-xs text-ink-soft sm:col-span-2">{c.description}</p> : null}
            </div>
          ))}
          <Field label="Feedback to organiser" hint="Visible to organisers; shared with participants only if the organiser enables feedback visibility.">
            <Textarea rows={3} value={feedback} maxLength={6000} onChange={(e) => setFeedback(e.target.value)} />
          </Field>
          <Field label="Private notes" hint="Never shown to participants or publicly.">
            <Textarea rows={3} value={privateNotes} maxLength={6000} onChange={(e) => setPrivateNotes(e.target.value)} />
          </Field>
          <Field label="Recommendation">
            <Select value={recommendation} onChange={(e) => setRecommendation(e.target.value)}>
              <option value="none">No recommendation</option>
              <option value="shortlist">Shortlist</option>
              <option value="accept">Accept</option>
              <option value="reject">Reject</option>
            </Select>
          </Field>
          <div className="flex gap-2">
            <Button variant="secondary" loading={busy} onClick={() => persist(true)}>Save draft</Button>
            <Button loading={busy} disabled={!scoredAll} onClick={() => persist(false)}>
              Submit final evaluation
            </Button>
          </div>
          {!scoredAll ? <p className="text-xs text-ink-soft">Score every criterion to enable the final submission.</p> : null}
        </div>
      </Card>

      <PrivacyNote>
        Judge notes and scores are private. Organisers see evaluation summaries; participants see
        feedback only when the organiser enables it.
      </PrivacyNote>
    </div>
  );
}

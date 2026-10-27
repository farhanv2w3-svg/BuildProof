import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { interviewSchema } from "../../lib/validation";
import {
  fetchInterviews,
  createInterview,
  setInterviewStatus,
  listEvidence,
  fetchTeamDecisions,
  errMessage,
} from "../../lib/api";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  LoadingBlock,
  PageTitle,
  SuccessBanner,
  Textarea,
} from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { canSetTier, interviewGap } from "../../lib/rbac";
import { StageStat, ReviewBadge, AttachmentsCard } from "../evidence/AttachmentsCard";
import { DecisionPanel, DecisionList } from "../teams/DecisionPanel";
import { formatDate, titleize } from "../../lib/utils";
import type { z } from "zod";

type InterviewForm = z.infer<typeof interviewSchema>;

export default function EvidencePage() {
  const { teamId } = useParams();
  const { user, roles } = useAuth();
  const qc = useQueryClient();

  const { data: interviews, isLoading } = useQuery({
    queryKey: ["interviews", teamId],
    queryFn: () => fetchInterviews(teamId!),
    enabled: !!teamId && !!user,
  });
  const { data: attachments } = useQuery({
    queryKey: ["evidence", teamId],
    queryFn: () => listEvidence(teamId!),
    enabled: !!teamId && !!user,
  });
  const { data: decisions } = useQuery({
    queryKey: ["decisions", teamId],
    queryFn: () => fetchTeamDecisions(teamId!),
    enabled: !!teamId && !!user,
  });
  void decisions;
  if (isLoading) return <LoadingBlock />;
  if (!user || !teamId) return null;

  const reviewer = canSetTier(roles);
  const gap = interviewGap(interviews ?? [], 8);
  const reviewedCount = (interviews ?? []).filter((i) => i.status === "reviewed").length;

  return (
    <div className="space-y-6">
      <PageTitle
        title="Validation stage"
        sub="Record genuine user interviews. Every entry needs consent confirmed. Raw notes stay private to team members and authorised reviewers."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StageStat label="Consented interviews" value={`${gap.done} / ${gap.target}`} note="suggested gate — guidance, not a hard block" />
        <StageStat label="Reviewed by staff" value={String(reviewedCount)} note="facilitator/mentor reviewed" />
        <StageStat label="Attachments" value={String((attachments ?? []).length)} note="private storage, signed links only" />
      </div>

      <InterviewLog teamId={teamId} interviews={interviews ?? []} reviewer={reviewer} qc={qc} />

      <Card>
        <CardHeader
          title="Record an interview"
          sub="Use anonymised participant labels (e.g. Participant A). Never record participant names or contact details."
        />
        <div className="px-5 pb-5">
          <InterviewFormPanel teamId={teamId} userId={user.id} />
        </div>
      </Card>

      <AttachmentsCard teamId={teamId} userId={user.id} stage="validation" />

      <Card>
        <CardHeader
          title="Validation decision"
          sub="Record continue / pivot / stop with a rationale — this is what facilitators and mentors review."
        />
        <div className="px-5 pb-5">
          <DecisionPanel teamId={teamId} userId={user.id} stage="validation" />
        </div>
        <DecisionList teamId={teamId} stage="validation" />
      </Card>
    </div>
  );
}

function InterviewLog({
  teamId,
  interviews,
  reviewer,
  qc, // used by reviewer actions below
}: {
  teamId: string;
  interviews: Awaited<ReturnType<typeof fetchInterviews>>;
  reviewer: boolean;
  qc: ReturnType<typeof useQueryClient>;
}) {
  if (interviews.length === 0) {
    return (
      <EmptyState
        title="No interviews yet"
        description="Start with people who actually experience the problem. Get consent, ask about their current workaround, and record what you honestly learn."
      />
    );
  }
  return (
    <Card>
      <CardHeader title="Interview log" sub="Private to your team and authorised reviewers. Never public." />
      <ul className="space-y-3 px-5 pb-5">
        {interviews.map((i) => (
          <li key={i.id} className="rounded-lg border border-line bg-canvas p-4">
            <div className="flex flex-wrap items-center gap-2">
              <ReviewBadge status={i.status} />
              <span className="text-[12.5px] text-ink-soft">
                {formatDate(i.interview_date)} · {i.participant_label} ({titleize(i.participant_type)})
              </span>
              {reviewer && i.status !== "reviewed" && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="ml-auto"
                  onClick={async () => {
                    try {
                      await setInterviewStatus(i.id, "reviewed");
                      await qc.invalidateQueries({ queryKey: ["interviews", teamId] });
                    } catch (e) {
                      alert(e instanceof Error ? e.message : "Could not mark as reviewed");
                    }
                  }}
                >
                  Mark reviewed
                </Button>
              )}
            </div>
            <p className="mt-2 text-[13.5px]">{i.key_findings}</p>
            {i.pain_points && <p className="mt-1 text-[12.5px] text-ink-soft"><strong className="text-ink">Pain points:</strong> {i.pain_points}</p>}
            {i.patterns && <p className="mt-1 text-[12.5px] text-ink-soft"><strong className="text-ink">Patterns:</strong> {i.patterns}</p>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function InterviewFormPanel({ teamId, userId }: { teamId: string; userId: string }) {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InterviewForm>({
    resolver: zodResolver(interviewSchema),
    defaultValues: { interview_date: new Date().toISOString().slice(0, 10) },
  });

  const onSubmit = async (v: InterviewForm) => {
    setOk(false);
    setErr(null);
    try {
      await createInterview(
        {
          team_id: teamId,
          interview_date: v.interview_date,
          participant_label: v.participant_label,
          participant_type: v.participant_type,
          consent: true,
          key_findings: v.key_findings,
          pain_points: v.pain_points || null,
          patterns: v.patterns || null,
        },
        userId
      );
      setOk(true);
      reset({ interview_date: new Date().toISOString().slice(0, 10) });
      await qc.invalidateQueries({ queryKey: ["interviews", teamId] });
    } catch (e) {
      setErr(errMessage(e));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {err && <ErrorBanner message={err} />}
      {ok && <SuccessBanner message="Interview recorded. Private to your team and authorised reviewers." />}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Interview date" required error={errors.interview_date?.message}>
          <Input type="date" {...register("interview_date")} />
        </Field>
        <Field label="Participant label" required error={errors.participant_label?.message} hint="Anonymous. e.g. Participant A">
          <Input {...register("participant_label")} placeholder="Participant A" />
        </Field>
        <Field label="Participant type" required error={errors.participant_type?.message} hint="e.g. Shop owner, Student, Teacher">
          <Input {...register("participant_type")} placeholder="Shop owner" />
        </Field>
      </div>
      <Field label="Key findings" required error={errors.key_findings?.message}>
        <Textarea {...register("key_findings")} rows={3} placeholder="What did you learn? Be specific and honest." />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Pain points" error={errors.pain_points?.message}>
          <Textarea {...register("pain_points")} rows={2} />
        </Field>
        <Field label="Repeated patterns" error={errors.patterns?.message}>
          <Textarea {...register("patterns")} rows={2} />
        </Field>
      </div>
      <Field
        label="Consent confirmation"
        required
        error={errors.consent?.message}
        hint="Suggested gate: 8 consented adult interviews per team before a validation decision."
      >
        <label className="flex items-start gap-2 text-[12.5px] text-ink-soft">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-600" {...register("consent")} />
          <span>
            The participant is an adult and gave informed consent to participate and be referenced
            anonymously.
          </span>
        </label>
      </Field>
      <Button type="submit" loading={isSubmitting}>Save interview</Button>
    </form>
  );
}

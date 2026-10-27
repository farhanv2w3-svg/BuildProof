import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { prototypeSchema, userTestSchema } from "../../lib/validation";
import {
  fetchPrototype,
  savePrototype,
  reviewPrototype,
  fetchUserTests,
  createUserTest,
  errMessage,
} from "../../lib/api";
import {
  Button,
  Card,
  CardHeader,
  Field,
  InfoNote,
  Input,
  LoadingBlock,
  PageTitle,
  Textarea,
  SuccessBanner,
  ErrorBanner,
} from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { AttachmentsCard, StageStat } from "../evidence/AttachmentsCard";
import { titleize } from "../../lib/utils";
import { z } from "zod";

type ProtoForm = z.infer<typeof prototypeSchema>;
type TestForm = z.infer<typeof userTestSchema>;

export default function TestsPage() {
  const { teamId } = useParams();
  const { user, roles } = useAuth();

  const { data: record, isLoading } = useQuery({
    queryKey: ["prototype", teamId],
    queryFn: () => fetchPrototype(teamId!),
    enabled: !!teamId && !!user,
  });
  const { data: tests } = useQuery({
    queryKey: ["userTests", record?.id],
    queryFn: () => fetchUserTests(record!.id),
    enabled: !!record?.id,
  });

  const isReviewer = roles.some((r) =>
    (["facilitator", "mentor", "faculty_coordinator", "institution_admin", "platform_admin"] as string[]).includes(r)
  );

  if (isLoading) return <LoadingBlock />;
  if (!user || !teamId) return null;

  const totals = (tests ?? []).reduce(
    (acc, t) => ({ approached: acc.approached + t.users_approached, tested: acc.tested + t.users_tested }),
    { approached: 0, tested: 0 }
  );

  return (
    <div className="space-y-6">
      <PageTitle
        title="Prototype & testing"
        sub="Optional stage after validation. Describe the solution, test it with real users, record honest outcomes."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StageStat label="Users approached" value={String(totals.approached)} />
        <StageStat label="Users actually tested" value={String(totals.tested)} />
        <StageStat label="Review status" value={record ? titleize(record.status) : "Not started"} />
      </div>

      <InfoNote>
        "Approached" vs "tested" must be honest — a landing-page view is not a user test. If a
        prototype doesn't exist yet, treat this stage as optional and only record it when real.
      </InfoNote>

      <Card>
        <CardHeader title="Prototype description & test plan" />
        <div className="px-5 pb-5">
          <PrototypeForm teamId={teamId} record={record ?? null} />
        </div>
      </Card>

      <Card>
        <CardHeader title="User tests" sub="One entry per test session (anonymised participant label)." />
        <div className="px-5 pb-5">
          <TestFormPanel testId={record?.id ?? null} teamId={teamId} />
          {(tests ?? []).length === 0 ? (
            <p className="mt-4 text-[12.5px] text-ink-soft">No user tests recorded yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {(tests ?? []).map((t) => (
                <li key={t.id} className="rounded-lg border border-line bg-canvas p-3 text-[13px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{t.participant_label}</span>
                    <span className="text-[12px] text-ink-soft">
                      approached {t.users_approached} · tested {t.users_tested}
                    </span>
                  </div>
                  <p className="mt-1"><strong>Tasks:</strong> {t.tasks}</p>
                  <p className="mt-0.5"><strong>Outcome:</strong> {t.outcome}</p>
                  {t.feedback && <p className="mt-0.5 text-ink-soft"><strong>Feedback:</strong> {t.feedback}</p>}
                  {t.observed_problems && (
                    <p className="mt-0.5 text-ink-soft"><strong>Observed problems:</strong> {t.observed_problems}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <AttachmentsCard teamId={teamId} userId={user.id} stage="prototype" />

      <Card>
        <CardHeader title="Final decision" sub="Continue, revise, or stop." />
        <div className="px-5 pb-5">
          <DecisionPanelStage teamId={teamId} userId={user.id} />
        </div>
      </Card>

      {isReviewer && record && (
        <Card>
          <CardHeader title="Reviewer decision (staff only)" />
          <div className="px-5 pb-5">
            <ReviewerPanel recordId={record.id} teamId={teamId} />
          </div>
        </Card>
      )}
    </div>
  );
}

function PrototypeForm({
  teamId,
  record,
}: {
  teamId: string;
  record: Awaited<ReturnType<typeof fetchPrototype>>;
}) {
  const qc = useQueryClient();
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProtoForm>({
    resolver: zodResolver(prototypeSchema),
    values: {
      solution_description: record?.solution_description ?? "",
      test_plan: record?.test_plan ?? "",
      iterations: record?.iterations ?? "",
    },
  });

  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        setOk(false);
        setErr(null);
        try {
          await savePrototype(teamId, record?.id ?? null, {
            solution_description: v.solution_description,
            test_plan: v.test_plan,
            iterations: v.iterations || "",
          });
          setOk(true);
          await qc.invalidateQueries({ queryKey: ["prototype", teamId] });
        } catch (e) {
          setErr(errMessage(e));
        }
      })}
      className="space-y-4"
      noValidate
    >
      {err && <ErrorBanner message={err} />}
      {ok && <SuccessBanner message="Prototype stage saved." />}
      <Field label="Prototype / proposed solution" required error={errors.solution_description?.message}>
        <Textarea {...register("solution_description")} rows={4} placeholder="What did you build or storyboard?" />
      </Field>
      <Field label="Test plan" required error={errors.test_plan?.message}>
        <Textarea {...register("test_plan")} rows={3} placeholder="Tasks users attempt, success criteria, how you record outcome." />
      </Field>
      <Field label="Iterations & changes" error={errors.iterations?.message}>
        <Textarea {...register("iterations")} rows={2} placeholder="What changed between test rounds?" />
      </Field>
      <Button type="submit" loading={isSubmitting}>{record ? "Update" : "Save"}</Button>
    </form>
  );
}

function TestFormPanel({ testId, teamId }: { testId: string | null; teamId: string }) {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TestForm>({ resolver: zodResolver(userTestSchema) });

  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        setErr(null);
        try {
          await createUserTest({
            test_id: testId as string,
            participant_label: v.participant_label,
            users_approached: v.users_approached,
            users_tested: v.users_tested,
            tasks: v.tasks,
            outcome: v.outcome,
            feedback: v.feedback || null,
            observed_problems: v.observed_problems || null,
          });
          reset();
          await qc.invalidateQueries({ queryKey: ["userTests", testId] });
          void teamId;
        } catch (e) {
          setErr(errMessage(e));
        }
      })}
      className="space-y-3"
      noValidate
    >
      {err && <ErrorBanner message={err} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Participant label" required error={errors.participant_label?.message}>
          <Input {...register("participant_label")} placeholder="Tester A" />
        </Field>
        <Field label="Users approached" required error={errors.users_approached?.message}>
          <Input type="number" {...register("users_approached")} />
        </Field>
        <Field label="Users tested" required error={errors.users_tested?.message}>
          <Input type="number" {...register("users_tested")} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tasks attempted" required error={errors.tasks?.message}>
          <Textarea {...register("tasks")} rows={2} />
        </Field>
        <Field label="Outcome" required error={errors.outcome?.message}>
          <Textarea {...register("outcome")} rows={2} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Feedback" error={errors.feedback?.message}>
          <Textarea {...register("feedback")} rows={2} />
        </Field>
        <Field label="Observed problems" error={errors.observed_problems?.message}>
          <Textarea {...register("observed_problems")} rows={2} />
        </Field>
      </div>
      <Button type="submit" loading={isSubmitting} disabled={!testId}>
        {testId ? "Save test record" : "Save prototype first"}
      </Button>
      {testId == null && (
        <p className="text-[12px] text-ink-soft">Save the prototype description and test plan first.</p>
      )}
    </form>
  );
}

function DecisionPanelStage({ teamId, userId }: { teamId: string; userId: string }) {
  const qc = useQueryClient();
  const [decision, setDecision] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-end gap-2">
      {(["continue", "revise", "stop"] as const).map((d) => (
        <button
          key={d}
          type="button"
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
      <Button
        disabled={!decision}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            const proto = await fetchPrototype(teamId);
            if (!proto) throw new Error("Save the prototype stage first.");
            await reviewPrototype(proto.id, userId, proto.reviewer_feedback ?? "", "reviewed", decision as "continue" | "revise" | "stop");

            await qc.invalidateQueries({ queryKey: ["prototype", teamId] });
          } catch (e) {
            setErr(errMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Record final decision
      </Button>
      {err && <span className="text-[12px] text-danger">{err}</span>}
    </div>
  );
}

function ReviewerPanel({ recordId, teamId }: { recordId: string; teamId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <div className="space-y-3">
      <Field label="Reviewer comment">
        <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} />
      </Field>
      <Button
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await reviewPrototype(recordId, user!.id, feedback.trim() || null, "reviewed", null);
            setDone(true);
            await qc.invalidateQueries({ queryKey: ["prototype", teamId] });
          } finally {
            setBusy(false);
          }
        }}
      >
        {done ? "Saved" : "Save review comment"}
      </Button>
    </div>
  );
}


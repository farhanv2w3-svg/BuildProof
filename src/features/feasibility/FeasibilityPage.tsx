import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { feasibilitySchema } from "../../lib/validation";
import {
  fetchFeasibility,
  saveFeasibility,
  reviewFeasibility,
  errMessage,
} from "../../lib/api";
import {
  Button,
  Badge,
  Card,
  CardHeader,
  ErrorBanner,
  Field,
  InfoNote,
  LoadingBlock,
  PageTitle,
  Select,
  SuccessBanner,
  Textarea,
} from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { AttachmentsCard, StageStat, ReviewBadge } from "../evidence/AttachmentsCard";
import { DecisionPanel, DecisionList } from "../teams/DecisionPanel";
import { titleize } from "../../lib/utils";
import type { z } from "zod";

type FormValues = z.infer<typeof feasibilitySchema>;

const FIELDS: [keyof FormValues, string, string | undefined][] = [
  ["technical_feasibility", "Technical feasibility", "Can we actually build this with available skills/tech?"],
  ["cost_resources", "Cost & available resources", "What will it cost? What tools, data, access do we already have?"],
  ["time_required", "Time required", "Honest estimate to reach a testable state."],
  ["user_access", "Access to users", "Do we have credible access to the affected users? How?"],
  ["dependencies", "Dependencies & constraints", "External approvals, data, APIs, permissions…"],
  ["risks", "Risks", "What could realistically make this fail?"],
  ["expected_value", "Expected value", "Value for the problem owner and users if it works."],
  ["recommended_next_step", "Recommended next step", "Concretely, what do you do next?"],
];

export default function FeasibilityPage() {
  const { teamId } = useParams();
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const { data: record, isLoading } = useQuery({
    queryKey: ["feasibility", teamId],
    queryFn: () => fetchFeasibility(teamId!),
    enabled: !!teamId && !!user,
  });

  const isReviewer = canSetTierHelper(roles);
  const reviewerFeedbackValue = record?.reviewer_feedback ?? "";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(feasibilitySchema),
    values: {
      technical_feasibility: record?.technical_feasibility ?? "",
      cost_resources: record?.cost_resources ?? "",
      time_required: record?.time_required ?? "",
      user_access: record?.user_access ?? "",
      dependencies: record?.dependencies ?? "",
      risks: record?.risks ?? "",
      expected_value: record?.expected_value ?? "",
      recommended_next_step: record?.recommended_next_step ?? "",
    },
  });

  const [feedback, setFeedback] = useState(reviewerFeedbackValue);
  const [fbStatus, setFbStatus] = useState<"draft" | "reviewed">("reviewed");
  const [fbDecision, setFbDecision] = useState<"" | "continue" | "revise" | "stop">("");

  if (isLoading) return <LoadingBlock />;
  if (!user || !teamId) return null;

  const onSubmit = async (v: FormValues) => {
    setOk(false);
    setErr(null);
    try {
      await saveFeasibility(teamId, user.id, record?.id ?? null, {
        technical_feasibility: v.technical_feasibility,
        cost_resources: v.cost_resources,
        time_required: v.time_required,
        user_access: v.user_access,
        dependencies: v.dependencies || "",
        risks: v.risks,
        expected_value: v.expected_value,
        recommended_next_step: v.recommended_next_step,
        status: "submitted",
      });
      setOk(true);
      await qc.invalidateQueries({ queryKey: ["feasibility", teamId] });
    } catch (e) {
      setErr(errMessage(e));
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        title="Feasibility assessment"
        sub="A structured, honest review. A feasibility review is guidance — not a guarantee of success."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StageStat label="Status" value={record ? titleize(record.status) : "Not started"} />
        <StageStat
          label="Reviewed by"
          value={record?.reviewer_feedback ? "Yes" : "No"}
          note={record?.reviewer_id ? "feedback recorded" : "pending reviewer"}
        />
        <StageStat label="Reviewer decision" value={record?.decision ? titleize(record.decision) : "Not set"} />
      </div>

      <InfoNote>
        Answer with evidence from your validation work where possible. Empty sales talk helps
        nobody — reviewers can tell, and it weakens your Proof Card.
      </InfoNote>

      <Card>
        <CardHeader title="Assessment" sub={record ? "Saved assessment found — editing updates it." : "Create the assessment."} />
        <div className="px-5 pb-5">
          {err && <div className="mb-3"><ErrorBanner message={err} /></div>}
          {ok && <div className="mb-3"><SuccessBanner message="Assessment saved and marked for review." /></div>}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {FIELDS.map(([name, label, hint]) => (
              <Field key={name} label={label} required={name !== "dependencies"} error={errors[name as keyof FormValues]?.message as string | undefined} hint={hint}>
                <Textarea {...register(name as keyof FormValues)} rows={2} />
              </Field>
            ))}
            <Button type="submit" loading={isSubmitting}>
              {record ? "Update assessment" : "Save assessment"}
            </Button>
          </form>
        </div>
        {record?.status && (
          <div className="border-t border-line px-5 py-3">
            <ReviewBadge status={record.status} />
          </div>
        )}
      </Card>

      {isReviewer && record && (
        <Card>
          <CardHeader title="Reviewer feedback (staff only)" sub="Visible to the team. Feeds the Proof Card review." />
          <div className="px-5 pb-5">
            <Field label="Feedback">
              <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} placeholder="What's strong? What's missing or unrealistic?" />
            </Field>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Field label="Status">
                <Select value={fbStatus} onChange={(e) => setFbStatus(e.target.value as "draft" | "reviewed")}>
                  <option value="reviewed">Reviewed</option>
                  <option value="draft">Request changes (back to draft)</option>
                </Select>
              </Field>
              <Field label="Reviewer decision" hint="Written to the assessment — shown in the page stats.">
                <Select value={fbDecision} onChange={(e) => setFbDecision(e.target.value as typeof fbDecision)}>
                  <option value="">Leave unchanged</option>
                  <option value="continue">Continue</option>
                  <option value="revise">Revise</option>
                  <option value="stop">Stop</option>
                </Select>
              </Field>
              <Button
                onClick={async () => {
                  try {
                    await reviewFeasibility(record.id, user.id, feedback.trim() || null, fbStatus as "draft" | "reviewed", fbDecision || null);
                    await qc.invalidateQueries({ queryKey: ["feasibility", teamId] });
                  } catch (e) {
                    setErr(errMessage(e));
                  }
                }}
              >
                Save feedback
              </Button>
            </div>
          </div>
        </Card>
      )}

      {record?.reviewer_feedback && (
        <Card>
          <CardHeader title="Reviewer feedback" />
          <p className="px-5 pb-5 text-[13.5px]">{record.reviewer_feedback}</p>
        </Card>
      )}

      <AttachmentsCard teamId={teamId} userId={user.id} stage="feasibility" />

      <Card>
        <CardHeader title="Stage decision" sub="Continue / pivot / stop after feasibility." />
        <div className="px-5 pb-5">
          <DecisionPanel teamId={teamId} userId={user.id} stage="feasibility" />
        </div>
        <DecisionList teamId={teamId} stage="feasibility" />
      </Card>

      {/* Platform-provided deterministic tier is impossible; show honest note */}
      <p className="text-[12px] text-ink-soft">
        Badge: <Badge tone="neutral">{record?.decision ? titleize(record.decision) : "no decision recorded"}</Badge>{" "}
        — recorded decisions keep the process auditable.
      </p>
    </div>
  );
}

function canSetTierHelper(roles: string[]) {
  return roles.some((r) =>
    ["facilitator", "mentor", "faculty_coordinator", "institution_admin", "platform_admin"].includes(r)
  );
}

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  LoadingBlock,
  PageTitle,
  Select,
  SuccessBanner,
  Textarea,
  PrivacyNote,
} from "../../components/ui";
import {
  createSubmissionDraft,
  deleteSubmissionFile,
  getEventById,
  getMySubmission,
  getShowcaseForSubmission,
  listSubmissionFiles,
  submissionFileDownloadUrl,
  updateSubmission,
  uploadSubmissionFile,
  createShowcaseDraft,
  approveShowcase,
} from "../../lib/eventspace";
import {
  ALLOWED_SUBMISSION_FILE_TYPES,
  ES_SUBMISSION_FIELD_LABELS,
  ES_URL_FIELD_KEYS,
  MAX_SUBMISSION_FILE_SIZE_BYTES,
  submissionWindowOpen,
  validateDeclarations,
  validateSubmissionPayload,
} from "../../lib/eventspaceRules";
import { errMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { formatDate } from "../../lib/utils";
import type { EsSubmissionFileRow } from "../../types/database";

const FILE_KIND_LABELS: Record<EsSubmissionFileRow["kind"], string> = {
  presentation: "Presentation (PDF/PPT)",
  document: "Document",
  screenshot: "Screenshot",
  supporting: "Supporting file",
};

const DECLARATION_ITEMS: Array<{ key: string; label: string }> = [
  { key: "originality", label: "This work is our own original work and does not copy others' submissions." },
  { key: "rights", label: "We hold the rights to submit this project and its materials." },
  { key: "rules_ack", label: "We have read and accept the event rules, including disqualification terms." },
];

export default function SubmissionWorkspace() {
  const { eventId = "" } = useParams();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: event, isLoading: eventLoading, error: eventError } = useQuery({
    queryKey: ["es_event_by_id", eventId],
    queryFn: () => getEventById(eventId),
  });
  const { data: submission, isLoading: subLoading } = useQuery({
    queryKey: ["es_my_submission", eventId],
    queryFn: () => getMySubmission(eventId, user!.id),
  });

  const [data, setData] = useState<Record<string, string>>({});
  const [declarations, setDeclarations] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  useEffect(() => {
    if (submission) {
      setData((submission.data ?? {}) as Record<string, string>);
      setDeclarations((submission.declarations ?? {}) as Record<string, string>);
    }
  }, [submission]);

  const submitOpen = event ? submissionWindowOpen(event) : false;
  const resubmitOpen = event
    ? submissionWindowOpen(event, new Date(), {
        isResubmission: submission?.status === "revision_requested",
      })
    : false;

  const showcase = useQuery({
    queryKey: ["es_showcase", submission?.id ?? ""],
    queryFn: () => getShowcaseForSubmission(submission!.id),
    enabled: !!submission,
  });

  if (eventLoading || subLoading) return <LoadingBlock label="Loading workspace…" />;
  if (eventError) return <ErrorBanner message={errMessage(eventError)} />;
  if (!event || !user) return <EmptyState title="Event not found" />;

  async function persist(status: "draft" | "submitted" | "resubmitted" | "withdrawn") {
    setError(null);
    try {
      await updateSubmission(submission!.id, {
        data,
        declarations,
        status,
      });
      setSaved(status === "draft" ? "Draft saved." : null);
      qc.invalidateQueries({ queryKey: ["es_my_submission", eventId] });
    } catch (e) {
      setError(errMessage(e));
    }
  }

  if (!submission) {
    if (!submitOpen) {
      return <EmptyState title="Submissions are closed" description="This event is not accepting new submissions." />;
    }
    return <StartSubmission eventId={eventId} userId={user.id} participation={event.participation} />;
  }

  const fields = event.submission_fields ?? [];
  const editable = submission.status === "draft" || submission.status === "revision_requested";
  const payloadCheck = validateSubmissionPayload(fields, data);
  const declCheck = validateDeclarations(declarations as never);

  return (
    <div className="space-y-6">
      <PageTitle
        title="Submission workspace"
        sub={`${event.title} · private to you, the organisers and your assigned judges`}
        action={
          <Link to="/app/eventspace" className="no-underline">
            <Button variant="secondary">Dashboard</Button>
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge
          tone={
            submission.status === "accepted" || submission.status === "shortlisted"
              ? "success"
              : submission.status === "rejected" || submission.status === "withdrawn"
                ? "danger"
                : submission.status === "draft"
                  ? "neutral"
                  : "warning"
          }
        >
          {submission.status.replace(/_/g, " ")}
        </Badge>
        {submission.submitted_at ? (
          <span className="text-xs text-ink-soft">Snapshot v{submission.snapshot_version} · {formatDate(submission.submitted_at)}</span>
        ) : null}
        {submission.revision_reason ? (
          <span className="text-xs font-semibold text-accent-700">Revision requested: {submission.revision_reason}</span>
        ) : null}
      </div>

      {saved ? <SuccessBanner message={saved} /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {!editable && submission.status !== "resubmitted" ? (
        <InfoLock status={submission.status} />
      ) : null}

      <Card>
        <CardHeader title="Project details" sub="Plain text only — links are validated, and nothing here executes." />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className={ES_URL_FIELD_KEYS.has(f.key) || f.key === "title" || f.key === "tagline" ? "sm:col-span-2" : ""}>
              <Field label={ES_SUBMISSION_FIELD_LABELS[f.key as keyof typeof ES_SUBMISSION_FIELD_LABELS] ?? f.label} required={f.required}>
                {ES_URL_FIELD_KEYS.has(f.key) ? (
                  <Input
                    type="url"
                    placeholder="https://…"
                    value={data[f.key] ?? ""}
                    onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
                    disabled={!editable}
                  />
                ) : f.key === "technologies" || f.key === "target_users" ? (
                  <Input
                    value={data[f.key] ?? ""}
                    onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
                    disabled={!editable}
                  />
                ) : (
                  <Textarea
                    rows={3}
                    value={data[f.key] ?? ""}
                    onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
                    disabled={!editable}
                  />
                )}
              </Field>
            </div>
          ))}
          {fields.length === 0 ? (
            <p className="text-sm text-ink-soft">This event has no configured submission fields — add your details below or contact the organiser.</p>
          ) : null}
        </div>
      </Card>

      <FilesCard submissionId={submission.id} editable={editable} userId={user.id} />

      <Card>
        <CardHeader title="Declarations" sub="All three are required to submit." />
        <div className="space-y-2 px-5 pb-5 text-sm">
          {DECLARATION_ITEMS.map(({ key, label }) => (
            <label key={key} className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={declarations[key] === "true"}
                disabled={!editable}
                onChange={(e) => setDeclarations({ ...declarations, [key]: e.target.checked ? "true" : "false" })}
              />
              <span className="text-ink-soft">{label}</span>
            </label>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {editable ? (
          <>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await persist("draft");
                } catch (e) {
                  setError(errMessage(e));
                }
              }}
            >
              Save draft
            </Button>
            <Button
              disabled={
                !payloadCheck.ok ||
                !declCheck.ok ||
                (submission.status === "revision_requested" ? !resubmitOpen : !submitOpen)
              }
              onClick={() => setConfirmSubmit(true)}
            >
              {submission.status === "revision_requested" ? "Resubmit project" : "Submit project"}
            </Button>
          </>
        ) : null}
        {(submission.status === "revision_requested" ? resubmitOpen : submitOpen) &&
        submission.status !== "draft" &&
        submission.status !== "withdrawn" &&
        submission.status !== "accepted" ? (
          <Button variant="ghost" onClick={() => setConfirmWithdraw(true)}>
            Withdraw
          </Button>
        ) : null}
      </div>
      {!payloadCheck.ok && editable ? <p className="text-xs text-ink-soft">{payloadCheck.message}</p> : null}
      {!declCheck.ok && editable ? <p className="text-xs text-ink-soft">{declCheck.message}</p> : null}

      <ShowcaseSection
        submissionId={submission.id}
        eventId={event.id}
        eventSlug={event.slug}
        userId={user.id}
        canCreate={["accepted", "shortlisted"].includes(submission.status)}
        existing={showcase.data ?? null}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["es_showcase", submission.id] })}
      />

      <ConfirmDialog
        open={confirmSubmit}
        title={submission.status === "revision_requested" ? "Resubmit project?" : "Submit project?"}
        description="Submitting creates an immutable snapshot of exactly what judges will see. You can edit only while the window is open or the organiser requests a revision."
        confirmLabel="Submit now"
        onConfirm={async () => {
          setConfirmSubmit(false);
          await persist(submission.status === "revision_requested" ? "resubmitted" : "submitted");
        }}
        onCancel={() => setConfirmSubmit(false)}
      />
      <ConfirmDialog
        open={confirmWithdraw}
        title="Withdraw submission?"
        description="Your submission will be removed from judging. This cannot be undone while the window is open."
        confirmLabel="Withdraw"
        destructive
        onConfirm={async () => {
          setConfirmWithdraw(false);
          await persist("withdrawn");
        }}
        onCancel={() => setConfirmWithdraw(false)}
      />

      <PrivacyNote>
        Files are stored in a private bucket. Only your team, this event's organisers and your
        assigned judges can open them — through short-lived signed links, never public URLs.
      </PrivacyNote>
    </div>
  );
}

function InfoLock({ status }: { status: string }) {
  const labels: Record<string, string> = {
    submitted: "Submitted — locked until the organiser reviews it.",
    under_review: "Under review by the organisers/judges.",
    shortlisted: "Shortlisted! Congratulations — submissions are locked during final judging.",
    accepted: "Accepted. You can now prepare a public showcase below.",
    rejected: "Not selected this time. Organiser feedback appears below if provided.",
  };
  return <InfoNote>{labels[status] ?? `Status: ${status}`}</InfoNote>;
}

function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-brand-50 px-4 py-3 text-sm text-brand-800">
      {children}
    </div>
  );
}

function StartSubmission({
  eventId,
  userId,
  participation,
}: {
  eventId: string;
  userId: string;
  participation: string;
}) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: async () => {
      // For team events the participant dashboard links to their team; an
      // individual-only submission is not permitted by RLS for team events.
      const ownerType = participation === "team" ? "team" : "individual";
      if (ownerType === "team") {
        // Team submissions are created via the dashboard once the team is active.
        throw new Error(
          "Team events submit as a team. Ask your team leader to open the submission from the dashboard."
        );
      }
      return createSubmissionDraft({
        event_id: eventId,
        owner_type: "individual",
        owner_user_id: userId,
        team_id: null,
      });
    },
    onSuccess: () => navigate(0),
    onError: (e) => setError(errMessage(e)),
  });

  return (
    <div className="space-y-4">
      <PageTitle title="Start your submission" sub="Begin a private draft for this event." />
      {error ? <ErrorBanner message={error} /> : null}
      <Button loading={create.isPending} onClick={() => create.mutate()}>
        Create draft
      </Button>
    </div>
  );
}

function FilesCard({ submissionId, editable, userId }: { submissionId: string; editable: boolean; userId: string }) {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<EsSubmissionFileRow["kind"]>("supporting");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: files, isLoading } = useQuery({
    queryKey: ["es_sub_files", submissionId],
    queryFn: () => listSubmissionFiles(submissionId),
  });

  async function upload(file: File) {
    setError(null);
    if (!(ALLOWED_SUBMISSION_FILE_TYPES as readonly string[]).includes(file.type)) {
      setError(`Unsupported file type "${file.type || "unknown"}". Allowed: images, PDF, PPTX, DOCX, XLSX, ZIP.`);
      return;
    }
    if (file.size > MAX_SUBMISSION_FILE_SIZE_BYTES) {
      setError(`File too large (${(file.size / 1048576).toFixed(1)} MB). Limit is 50 MB.`);
      return;
    }
    if (file.size === 0) {
      setError("That file is empty.");
      return;
    }
    setBusy(true);
    try {
      await uploadSubmissionFile(submissionId, userId, file, kind);
      qc.invalidateQueries({ queryKey: ["es_sub_files", submissionId] });
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader title="Files" sub="Private: PDF, PPTX, DOCX, XLSX, ZIP or images · max 50 MB each." />
      <div className="space-y-3 px-5 pb-5">
        {isLoading ? <LoadingBlock /> : null}
        {files && files.length > 0 ? (
          <ul className="space-y-2">
            {files.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-ink">{f.file_name}</p>
                  <p className="text-xs text-ink-soft">
                    {FILE_KIND_LABELS[f.kind]} · {(f.size_bytes / 1048576).toFixed(2)} MB
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      try {
                        const url = await submissionFileDownloadUrl(f.object_key);
                        window.open(url, "_blank", "noopener");
                      } catch (e) {
                        setError(errMessage(e));
                      }
                    }}
                  >
                    Open
                  </Button>
                  {editable ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await deleteSubmissionFile(f);
                          qc.invalidateQueries({ queryKey: ["es_sub_files", submissionId] });
                        } catch (e) {
                          setError(errMessage(e));
                        }
                      }}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">No files yet. Presentations and documents are usually required — check the event's submission requirements.</p>
        )}
        {editable ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-48">
              <Select value={kind} onChange={(e) => setKind(e.target.value as EsSubmissionFileRow["kind"])} aria-label="File kind">
                {Object.entries(FILE_KIND_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </Select>
            </div>
            <input
              ref={fileInput}
              type="file"
              className="text-sm"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
              disabled={busy}
            />
            {busy ? <span className="text-xs text-ink-soft">Uploading…</span> : null}
          </div>
        ) : null}
        {error ? <ErrorBanner message={error} /> : null}
      </div>
    </Card>
  );
}

function ShowcaseSection({
  submissionId,
  eventId,
  eventSlug,
  userId,
  canCreate,
  existing,
  onRefresh,
}: {
  submissionId: string;
  eventId: string;
  eventSlug: string;
  userId: string;
  canCreate: boolean;
  existing: Awaited<ReturnType<typeof getShowcaseForSubmission>>;
  onRefresh: () => void;
}) {
  const [form, setForm] = useState({
    approved_title: "",
    approved_summary: "",
    approved_problem: "",
    approved_solution: "",
    approved_demo_url: "",
    approved_github_url: "",
    team_names: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (existing) {
    return (
      <Card>
        <CardHeader
          title="Public showcase"
          action={<Badge tone={existing.status === "published" ? "success" : "neutral"}>{existing.status.replace(/_/g, " ")}</Badge>}
        />
        <div className="space-y-2 px-5 pb-5 text-sm text-ink-soft">
          <p>
            {existing.status === "published"
              ? "Published! View it on the event's public showcase page."
              : existing.status === "owner_approved"
                ? "Approved by you — waiting for the organiser to publish."
                : existing.status === "unpublished"
                  ? "Unpublished. You can re-approve to make it public again."
                  : "Draft — approve it when you're ready."}
          </p>
          <div className="flex flex-wrap gap-2">
            {existing.status !== "published" && existing.status !== "owner_approved" ? (
              <Button
                size="sm"
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await approveShowcase(existing.id);
                    onRefresh();
                  } catch (e) {
                    setError(errMessage(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Approve for publication
              </Button>
            ) : null}
            {existing.status === "published" || existing.status === "owner_approved" ? (
              <Link to={`/eventspace/${eventSlug}/showcase`} className="no-underline">
                <Button size="sm" variant="secondary">View public showcase</Button>
              </Link>
            ) : null}
          </div>
          {error ? <ErrorBanner message={error} /> : null}
        </div>
      </Card>
    );
  }

  if (!canCreate) {
    return null;
  }

  return (
    <Card>
      <CardHeader
        title="Create a public showcase"
        sub="Chosen content only. Private files, judge notes and personal contacts are never published."
      />
      <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
        <Field label="Public title" required>
          <Input value={form.approved_title} onChange={(e) => setForm({ ...form, approved_title: e.target.value })} maxLength={180} />
        </Field>
        <Field label="Team member names (public attribution)" hint="Comma-separated.">
          <Input value={form.team_names} onChange={(e) => setForm({ ...form, team_names: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Public summary" required>
            <Textarea rows={3} value={form.approved_summary} onChange={(e) => setForm({ ...form, approved_summary: e.target.value })} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Problem (approved for publication, optional)">
            <Textarea rows={2} value={form.approved_problem} onChange={(e) => setForm({ ...form, approved_problem: e.target.value })} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Solution (approved for publication, optional)">
            <Textarea rows={2} value={form.approved_solution} onChange={(e) => setForm({ ...form, approved_solution: e.target.value })} />
          </Field>
        </div>
        <Field label="Public demo link (optional)">
          <Input type="url" value={form.approved_demo_url} onChange={(e) => setForm({ ...form, approved_demo_url: e.target.value })} />
        </Field>
        <Field label="Public GitHub link (optional)">
          <Input type="url" value={form.approved_github_url} onChange={(e) => setForm({ ...form, approved_github_url: e.target.value })} />
        </Field>
        {error ? <div className="sm:col-span-2"><ErrorBanner message={error} /></div> : null}
        <div className="sm:col-span-2">
          <Button
            loading={busy}
            disabled={form.approved_title.trim().length < 4 || form.approved_summary.trim().length < 20}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await createShowcaseDraft({
                  event_id: eventId,
                  submission_id: submissionId,
                  created_by: userId,
                  approved_title: form.approved_title.trim(),
                  approved_summary: form.approved_summary.trim(),
                  approved_problem: form.approved_problem || null,
                  approved_solution: form.approved_solution || null,
                  approved_demo_url: form.approved_demo_url || null,
                  approved_github_url: form.approved_github_url || null,
                  team_attribution: form.team_names
                    .split(",")
                    .map((n) => n.trim())
                    .filter(Boolean)
                    .map((name) => ({ name })),
                });
                onRefresh();
              } catch (e) {
                setError(errMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Create showcase draft
          </Button>
        </div>
      </div>
    </Card>
  );
}

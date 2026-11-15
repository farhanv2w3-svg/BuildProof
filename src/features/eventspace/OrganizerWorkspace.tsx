import { useState } from "react";
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
  Input,
  LoadingBlock,
  PageTitle,
  Select,
  SuccessBanner,
  Textarea,
} from "../../components/ui";import {
  addEventStaff,
  assignJudge,
  createAnnouncement,
  deleteAnnouncement,
  getEventAnalytics,
  getEventById,
  listAnnouncements,
  listEventEvaluations,
  listEventJudgeAssignments,
  listEventRegistrations,
  listEventSubmissions,
  listEventTeams,
  listEventStaff,
  notifyEventAudience,
  removeEventStaff,
  removeJudgeAssignment,
  resolveInvitee,
  setRegistrationStatus,
  setResultsPublished,
  submissionFileDownloadUrl,
  updateEvent,
  updateSubmission,
  listSubmissionFiles,
  listPublicShowcasesForEvent,
} from "../../lib/eventspace";
import { ES_SUBMISSION_STATUS_LABELS } from "../../lib/eventspaceRules";
import { errMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { formatDate } from "../../lib/utils";
import type { EsRegistrationRow, EsSubmissionRow } from "../../types/database";

const TABS = ["Overview", "Registrations", "Teams", "Submissions", "Judges", "Showcase", "Announcements", "Settings"] as const;

export default function OrganizerWorkspace() {
  const { eventId = "" } = useParams();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");

  const { data: event, isLoading, error } = useQuery({
    queryKey: ["es_event_by_id", eventId],
    queryFn: () => getEventById(eventId),
  });

  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorBanner message={errMessage(error)} />;
  if (!event) return <EmptyState title="Event not found" description="You may not have access to this event." />;

  return (
    <div className="space-y-5">
      <PageTitle
        title={event.title}
        sub={`Organiser workspace · ${event.status}${event.visibility !== "public" ? ` · ${event.visibility}` : ""}`}
        action={
          <>
            <Link to={`/eventspace/${event.slug}`} className="no-underline">
              <Button variant="secondary">Public page</Button>
            </Link>
            <Link to={`/app/eventspace/${event.id}/promote`} className="no-underline">
              <Button variant="secondary">Promotion kit</Button>
            </Link>
          </>
        }
      />

      <nav className="flex flex-wrap gap-1.5" aria-label="Workspace sections">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${tab === t ? "bg-brand-600 text-white" : "border border-line text-ink hover:border-brand-300"}`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "Overview" ? <Overview eventId={event.id} event={event} /> : null}
      {tab === "Registrations" ? <Registrations eventId={event.id} /> : null}
      {tab === "Teams" ? <Teams eventId={event.id} /> : null}
      {tab === "Submissions" ? <Submissions eventId={event.id} /> : null}
      {tab === "Judges" ? <Judges eventId={event.id} event={event} /> : null}
      {tab === "Showcase" ? <Showcase slug={event.slug} /> : null}
      {tab === "Announcements" ? <Announcements eventId={event.id} eventTitle={event.title} slug={event.slug} /> : null}
      {tab === "Settings" ? <Settings eventId={event.id} event={event} /> : null}
    </div>
  );
}

/* ------------------------------ overview --------------------------- */

function Overview({ eventId, event }: { eventId: string; event: NonNullable<Awaited<ReturnType<typeof getEventById>>> }) {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ["es_analytics", eventId],
    queryFn: () => getEventAnalytics(eventId),
  });
  return (
    <Card>
      <CardHeader title="Analytics" sub="Real aggregate counts from RLS-visible records only." />
      {isLoading ? <LoadingBlock /> : error ? <ErrorBanner message={errMessage(error)} /> : stats ? (
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-4">
          {[
            ["Active registrations", stats.registrations],
            ["Pending approval", stats.pendingRegistrations],
            ["Teams", stats.teams],
            ["Submissions", stats.submissions],
            ["In judging pool", stats.submittedComplete],
            ["Shortlisted", stats.shortlisted],
            ["Judge assignments", stats.judgeAssignments],
            ["Completed evaluations", stats.completedEvaluations],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-xl border border-line p-3">
              <p className="text-2xl font-black text-ink">{value as number}</p>
              <p className="text-xs font-semibold text-ink-soft">{label}</p>
            </div>
          ))}
        </div>
      ) : null}
      <div className="px-5 pb-5 text-xs text-ink-soft">
        Upcoming deadlines: registration closes{" "}
        {event.registration_closes_at ? formatDate(event.registration_closes_at) : "not set"} · submission
        deadline {event.submission_deadline ? formatDate(event.submission_deadline) : "not set"}
      </div>
    </Card>
  );
}

/* ---------------------------- registrations ------------------------ */

function Registrations({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const { data: regs, isLoading, error } = useQuery({
    queryKey: ["es_regs", eventId],
    queryFn: () => listEventRegistrations(eventId),
  });
  const [search, setSearch] = useState("");
  if (error) return <ErrorBanner message={errMessage(error)} />;

  const filtered = (regs ?? []).filter((r: EsRegistrationRow) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.user_id.toLowerCase().includes(q) || r.status.includes(q);
  });

  async function act(r: EsRegistrationRow, status: EsRegistrationRow["status"]) {
    try {
      await setRegistrationStatus(r.id, status);
      qc.invalidateQueries({ queryKey: ["es_regs", eventId] });
    } catch (e) {
      window.alert(errMessage(e));
    }
  }

  function exportCsv() {
    const rows = [
      ["registration_id", "user_id", "status", "participation", "team_id", "created_at"],
      ...(regs ?? []).map((r) => [r.id, r.user_id, r.status, r.participation_type, r.team_id ?? "", r.created_at]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "registrations.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <Card>
      <CardHeader
        title="Registrations"
        sub="IDs are shown instead of profile names — profiles are only readable by their owners per RLS."
        action={
          <Button size="sm" variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />
      <div className="px-5 pb-3">
        <Input placeholder="Search by participant ID or status…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {isLoading ? <LoadingBlock /> : filtered.length === 0 ? (
        <EmptyState title="No registrations yet" />
      ) : (
        <ul className="space-y-2 px-5 pb-5">
          {filtered.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-ink">{r.user_id.slice(0, 8)}… {r.participation_type === "team" ? "(team)" : ""}</p>
                <p className="text-xs text-ink-soft">{r.status} · {formatDate(r.created_at)}</p>
              </div>
              <div className="flex gap-2">
                {r.status === "pending" ? (
                  <>
                    <Button size="sm" onClick={() => act(r, "registered")}>Approve</Button>
                    <Button size="sm" variant="ghost" onClick={() => act(r, "rejected")}>Reject</Button>
                  </>
                ) : null}
                {r.status === "waitlisted" ? (
                  <Button size="sm" onClick={() => act(r, "registered")}>Move off waitlist</Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* -------------------------------- teams ---------------------------- */

function Teams({ eventId }: { eventId: string }) {
  const { data: teams, isLoading, error } = useQuery({
    queryKey: ["es_teams", eventId],
    queryFn: () => listEventTeams(eventId),
  });
  if (error) return <ErrorBanner message={errMessage(error)} />;
  return (
    <Card>
      <CardHeader title="Teams" />
      {isLoading ? <LoadingBlock /> : !teams || teams.length === 0 ? (
        <EmptyState title="No teams yet" />
      ) : (
        <ul className="space-y-2 px-5 pb-5">
          {teams.map((t) => (
            <li key={t.id} className="rounded-xl border border-line px-3 py-2">
              <p className="text-sm font-semibold text-ink">{t.name}</p>
              <p className="text-xs text-ink-soft">
                Leader {t.leader_user_id.slice(0, 8)}… · created {formatDate(t.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ----------------------------- submissions ------------------------- */

function Submissions({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const { data: subs, isLoading, error } = useQuery({
    queryKey: ["es_subs", eventId],
    queryFn: () => listEventSubmissions(eventId),
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  if (error) return <ErrorBanner message={errMessage(error)} />;

  const filtered = (subs ?? []).filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.data as Record<string, unknown>)?.["title"]?.toString().toLowerCase().includes(q) ||
      s.owner_user_id.toLowerCase().includes(q);
  });

  async function act(s: EsSubmissionRow, status: EsSubmissionRow["status"], note?: string) {
    setActionErr(null);
    try {
      await updateSubmission(s.id, {
        status,
        review_note: note ?? s.review_note,
        revision_reason: status === "revision_requested" ? note : s.revision_reason,
      });
      qc.invalidateQueries({ queryKey: ["es_subs", eventId] });
    } catch (e) {
      setActionErr(errMessage(e));
    }
  }

  return (
    <Card>
      <CardHeader title="Submissions" sub="Full review with secure private downloads." />
      <div className="flex flex-wrap gap-2 px-5 pb-3">
        <Input placeholder="Search title or participant ID…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-48">
          <option value="">All statuses</option>
          {Object.keys(ES_SUBMISSION_STATUS_LABELS).map((k) => (
            <option key={k} value={k}>{ES_SUBMISSION_STATUS_LABELS[k]}</option>
          ))}
        </Select>
      </div>
      {actionErr ? <ErrorBanner message={actionErr} /> : null}
      {isLoading ? <LoadingBlock /> : filtered.length === 0 ? (
        <EmptyState title="No submissions match" />
      ) : (
        <ul className="space-y-3 px-5 pb-5">
          {filtered.map((s) => (
            <li key={s.id} className="rounded-xl border border-line">
              <button
                type="button"
                className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left"
                onClick={() => setOpenId(openId === s.id ? null : s.id)}
              >
                <div>
                  <p className="text-sm font-bold text-ink">
                    {(s.data as Record<string, unknown>)?.["title"]?.toString() || "Untitled project"}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {s.owner_type === "team" ? `Team ${s.team_id?.slice(0, 8)}…` : s.owner_user_id.slice(0, 8) + "…"} ·{" "}
                    {ES_SUBMISSION_STATUS_LABELS[s.status]} · v{s.snapshot_version}
                    {s.submitted_at ? ` · ${formatDate(s.submitted_at)}` : ""}
                  </p>
                </div>
                <Badge tone={s.status === "shortlisted" || s.status === "accepted" ? "success" : s.status === "revision_requested" ? "warning" : "neutral"}>
                  {ES_SUBMISSION_STATUS_LABELS[s.status]}
                </Badge>
              </button>
              {openId === s.id ? (
                <SubmissionReview submission={s} onAct={act} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function SubmissionReview({
  submission,
  onAct,
}: {
  submission: EsSubmissionRow;
  onAct: (s: EsSubmissionRow, status: EsSubmissionRow["status"], note?: string) => void;
}) {
  const { data: files } = useQuery({
    queryKey: ["es_files_admin", submission.id],
    queryFn: () => listEventSubmissionFiles(submission.id),
  });
  const [note, setNote] = useState("");
  return (
    <div className="space-y-3 border-t border-line px-3 py-3">
      <dl className="space-y-1.5 text-sm">
        {Object.entries(submission.data as Record<string, unknown>)
          .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
          .map(([k, v]) => (
            <div key={k} className="rounded-lg bg-canvas px-3 py-2">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">{k.replace(/_/g, " ")}</dt>
              <dd className="whitespace-pre-wrap break-words text-ink">{String(v)}</dd>
            </div>
          ))}
      </dl>
      {files && files.length > 0 ? (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Files</p>
          <ul className="mt-1 space-y-1">
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
                      window.alert(errMessage(e));
                    }
                  }}
                >
                  {f.file_name} ({f.kind}, {(f.size_bytes / 1048576).toFixed(1)} MB)
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => onAct(submission, "under_review")}>Mark under review</Button>
        <Button size="sm" onClick={() => onAct(submission, "shortlisted")}>Shortlist</Button>
        <Button size="sm" variant="ghost" onClick={() => onAct(submission, "accepted")}>Accept</Button>
        <Button size="sm" variant="ghost" onClick={() => onAct(submission, "rejected")}>Reject</Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1">
          <Field label="Reason / feedback note" hint="Recorded with the status change; visible to the participant.">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <Button size="sm" onClick={() => onAct(submission, "revision_requested", note)}>Request revision</Button>
      </div>
    </div>
  );
}

// organiser listing of a submission's files uses the same read endpoint
function listEventSubmissionFiles(submissionId: string) {
  return listSubmissionFiles(submissionId);
}

/* -------------------------------- judges --------------------------- */

function Judges({ eventId, event }: { eventId: string; event: NonNullable<Awaited<ReturnType<typeof getEventById>>> }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: staff } = useQuery({
    queryKey: ["es_staff", eventId],
    queryFn: () => listEventStaff(eventId),
  });
  const { data: assignments } = useQuery({
    queryKey: ["es_assignments", eventId],
    queryFn: () => listEventJudgeAssignments(eventId),
  });
  const { data: subs } = useQuery({
    queryKey: ["es_subs", eventId],
    queryFn: () => listEventSubmissions(eventId),
  });
  const { data: evals } = useQuery({
    queryKey: ["es_evals", eventId],
    queryFn: () => listEventEvaluations(eventId),
  });

  const [staffEmail, setStaffEmail] = useState("");
  const [staffErr, setStaffErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function addStaff(role: "manager" | "judge") {
    setStaffErr(null);
    try {
      const invitee = await resolveInvitee(eventId, staffEmail);
      if (!invitee) throw new Error("No BuildProof account with that email.");
      if (!user) throw new Error("Sign in required.");
      await addEventStaff(eventId, invitee.user_id, role, user.id);
      setDone(`${invitee.full_name} added as ${role}.`);
      setStaffEmail("");
      qc.invalidateQueries({ queryKey: ["es_staff", eventId] });
    } catch (e) {
      setStaffErr(errMessage(e));
    }
  }

  const judgedSubmissions = new Set(
    (evals ?? []).map((e) => (assignments ?? []).find((a) => a.id === e.assignment_id)?.submission_id)
  );

  const shortlistedOrSubmitted = (subs ?? []).filter((s) =>
    ["submitted", "resubmitted", "under_review", "shortlisted"].includes(s.status)
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Event staff & judges" sub="Invite by BuildProof account email. Staff see what you grant — nothing more." />
        <div className="flex flex-wrap items-end gap-2 px-5 pb-3">
          <div className="min-w-[240px] flex-1">
            <Field label="Email of the person to invite">
              <Input type="email" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} />
            </Field>
          </div>
          <Button size="sm" variant="secondary" onClick={() => addStaff("manager")}>Add manager</Button>
          <Button size="sm" onClick={() => addStaff("judge")}>Add judge</Button>
        </div>
        {staffErr ? <ErrorBanner message={staffErr} /> : null}
        {done ? <SuccessBanner message={done} /> : null}
        <ul className="space-y-2 px-5 pb-5">
          {(staff ?? []).map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-xl border border-line px-3 py-2">
              <span className="text-sm text-ink">
                {s.user_id.slice(0, 8)}… <Badge>{s.role}</Badge>
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    await removeEventStaff(s.id);
                    qc.invalidateQueries({ queryKey: ["es_staff", eventId] });
                  } catch (e) {
                    window.alert(errMessage(e));
                  }
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader
          title="Judge assignments"
          sub={`Assign judges per submission. ${event.evaluation_enabled ? "Rubric is active." : "Evaluation is disabled for this event."}`}
        />
        {shortlistedOrSubmitted.length === 0 ? (
          <EmptyState title="No evaluable submissions yet" />
        ) : (
          <ul className="space-y-2 px-5 pb-5">
            {shortlistedOrSubmitted.map((s) => (
              <li key={s.id} className="rounded-xl border border-line px-3 py-2">
                <p className="text-sm font-semibold text-ink">
                  {(s.data as Record<string, unknown>)?.["title"]?.toString() || "Untitled"}
                </p>
                <div className="mt-2 space-y-1">
                  {(assignments ?? [])
                    .filter((a) => a.submission_id === s.id)
                    .map((a) => (
                      <div key={a.id} className="flex items-center justify-between text-xs">
                        <span className="text-ink-soft">
                          Judge {a.judge_user_id.slice(0, 8)}… · {a.status}
                          {judgedSubmissions.has(s.id) ? " ✓ evaluated" : ""}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            try {
                              await removeJudgeAssignment(a.id);
                              qc.invalidateQueries({ queryKey: ["es_assignments", eventId] });
                            } catch (e) {
                              window.alert(errMessage(e));
                            }
                          }}
                        >
                          Revoke
                        </Button>
                      </div>
                    ))}
                </div>
                <AssignJudgeRow
                  eventId={eventId}
                  submissionId={s.id}
                  judges={(staff ?? []).filter((st) => st.role === "judge").map((st) => st.user_id)}
                  onDone={() => qc.invalidateQueries({ queryKey: ["es_assignments", eventId] })}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function AssignJudgeRow({
  eventId,
  submissionId,
  judges,
  onDone,
}: {
  eventId: string;
  submissionId: string;
  judges: string[];
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [judgeId, setJudgeId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  if (judges.length === 0) {
    return <p className="mt-1 text-xs text-ink-soft">Add judges as event staff first.</p>;
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Select value={judgeId} onChange={(e) => setJudgeId(e.target.value)} className="max-w-56" aria-label="Judge">
        <option value="">Select judge…</option>
        {judges.map((j) => (
          <option key={j} value={j}>{j.slice(0, 8)}…</option>
        ))}
      </Select>
      <Button
        size="sm"
        variant="secondary"
        disabled={!judgeId || !user}
        onClick={async () => {
          setErr(null);
          try {
            await assignJudge(eventId, judgeId, submissionId, user!.id);
            onDone();
          } catch (e) {
            setErr(errMessage(e));
          }
        }}
      >
        Assign
      </Button>
      {err ? <span className="text-xs text-accent-700">{err}</span> : null}
    </div>
  );
}

/* ------------------------------- showcase -------------------------- */

function Showcase({ slug }: { slug: string }) {
  return slug ? <ShowcaseImpl slug={slug} /> : null;
}

function ShowcaseImpl({ slug }: { slug: string }) {
  const qc = useQueryClient();
  const { data: items, isLoading, error } = useQuery({
    queryKey: ["es_showcase_admin", slug],
    queryFn: () => listPublicShowcasesForEvent(slug),
  });
  if (error) return <ErrorBanner message={errMessage(error)} />;
  return (
    <Card>
      <CardHeader title="Showcase approvals" sub="Published public showcase entries. Publishing always required the owner's approval first." />
      {isLoading ? <LoadingBlock /> : !items || items.length === 0 ? (
        <EmptyState title="No published showcase entries yet" description="Entries appear here after the project team approves and the organiser publishes." />
      ) : (
        <ul className="space-y-3 px-5 pb-5">
          {items.map((it) => (
            <li key={it.id} className="rounded-xl border border-line px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-ink">{it.approved_title}</p>
                  <p className="text-xs text-ink-soft">{it.approved_summary.slice(0, 120)}…</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="success">published</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        const { unpublishShowcase } = await import("../../lib/eventspace");
                        await unpublishShowcase(it.id);
                        qc.invalidateQueries({ queryKey: ["es_showcase_admin", slug] });
                      } catch (e) {
                        window.alert(errMessage(e));
                      }
                    }}
                  >
                    Unpublish
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------------------------- announcements ------------------------ */

function Announcements({ eventId, eventTitle, slug }: { eventId: string; eventTitle: string; slug: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: items, isLoading, error } = useQuery({
    queryKey: ["es_announcements", eventId],
    queryFn: () => listAnnouncements(eventId),
  });
  const [form, setForm] = useState({ title: "", body: "", audience: "participants" });
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  if (error) return <ErrorBanner message={errMessage(error)} />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="New announcement" sub="Participants and judges are notified in-app by the server — delivery is verified and failures are reported, never silent." />
        <div className="space-y-3 px-5 pb-5">
          <Field label="Title" required>
            <Input value={form.title} maxLength={160} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Body" required>
            <Textarea rows={4} value={form.body} maxLength={5000} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </Field>
          <Field label="Audience">
            <Select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
              <option value="participants">Participants</option>
              <option value="judges">Judges</option>
              <option value="all">Everyone</option>
            </Select>
          </Field>
          <Button
            loading={!items && isLoading}
            disabled={form.title.trim().length < 3 || form.body.trim().length < 1}
            onClick={async () => {
              setErr(null);
              try {
                if (!user) throw new Error("Sign in required.");
                const created = await createAnnouncement({
                  event_id: eventId,
                  title: form.title.trim(),
                  body: form.body.trim(),
                  audience: form.audience as "participants",
                  created_by: user.id,
                });
                qc.invalidateQueries({ queryKey: ["es_announcements", eventId] });
                const notified = await notifyEventAudience({
                  event_id: eventId,
                  audience: form.audience as "participants" | "judges" | "all",
                  title: `${eventTitle}: ${created.title}`,
                  body: created.body.slice(0, 500),
                  link: `/eventspace/${slug}`,
                });
                setSent(`Announcement saved. In-app notification delivered to ${notified} recipient(s).`);
                setForm({ title: "", body: "", audience: "participants" });
              } catch (e) {
                setErr(errMessage(e));
              }
            }}
          >
            Publish announcement
          </Button>
          {sent ? <SuccessBanner message={sent} /> : null}
          {err ? <ErrorBanner message={err} /> : null}
        </div>
      </Card>

      <Card>
        <CardHeader title="Past announcements" />
        {isLoading ? <LoadingBlock /> : !items || items.length === 0 ? (
          <EmptyState title="No announcements yet" />
        ) : (
          <ul className="space-y-2 px-5 pb-5">
            {items.map((a) => (
              <li key={a.id} className="rounded-xl border border-line px-3 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-ink">{a.title}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await deleteAnnouncement(a.id);
                        qc.invalidateQueries({ queryKey: ["es_announcements", eventId] });
                      } catch (e) {
                        window.alert(errMessage(e));
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
                <p className="mt-1 text-sm text-ink-soft">{a.body}</p>
                <p className="mt-1 text-xs text-ink-soft">{a.audience} · {formatDate(a.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------ settings --------------------------- */

function Settings({ eventId, event }: { eventId: string; event: NonNullable<Awaited<ReturnType<typeof getEventById>>> }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    registration_open: event.registration_open,
    submission_open: event.submission_open,
    judging_open: event.judging_open,
    submission_deadline: event.submission_deadline?.slice(0, 16) ?? "",
    visibility: event.visibility,
    results_published: event.results_published,
  });
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <Card>
      <CardHeader title="Event settings" sub="Lifecycle switches and deadlines. All changes are enforced server-side." />
      <div className="space-y-3 px-5 pb-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={form.registration_open}
              onChange={(e) => setForm({ ...form, registration_open: e.target.checked })}
            />
            Registration open
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={form.submission_open}
              onChange={(e) => setForm({ ...form, submission_open: e.target.checked })}
            />
            Submissions open
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={form.judging_open}
              onChange={(e) => setForm({ ...form, judging_open: e.target.checked })}
            />
            Judging started (locks new submissions)
          </label>
          <Field label="Submission deadline override" hint="Extends the window; participants can edit while it stays in the future.">
            <Input
              type="datetime-local"
              value={form.submission_deadline}
              onChange={(e) => setForm({ ...form, submission_deadline: e.target.value })}
            />
          </Field>
          <Field label="Visibility">
            <Select
              value={form.visibility}
              onChange={(e) => setForm({ ...form, visibility: e.target.value as "public" })}
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </Select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={async () => {
              setErr(null);
              setSaved(false);
              try {
                await updateEvent(eventId, {
                  registration_open: form.registration_open,
                  submission_open: form.submission_open,
                  judging_open: form.judging_open,
                  submission_deadline: form.submission_deadline || null,
                  visibility: form.visibility,
                });
                setSaved(true);
                qc.invalidateQueries({ queryKey: ["es_event_by_id", eventId] });
              } catch (e) {
                setErr(errMessage(e));
              }
            }}
          >
            Save settings
          </Button>
          <Button
            variant={form.results_published ? "secondary" : "primary"}
            onClick={async () => {
              setErr(null);
              try {
                await setResultsPublished(eventId, !form.results_published);
                setForm({ ...form, results_published: !form.results_published });
                setSaved(true);
                qc.invalidateQueries({ queryKey: ["es_event_by_id", eventId] });
              } catch (e) {
                setErr(errMessage(e));
              }
            }}
          >
            {form.results_published ? "Unpublish results" : "Publish results"}
          </Button>
        </div>
        {saved ? <SuccessBanner message="Settings saved." /> : null}
        {err ? <ErrorBanner message={err} /> : null}
        <p className="text-xs text-ink-soft">
          Event status moves to completed/archived via lifecycle actions after results are published.
          Submissions remain private after the event ends; public pages keep only approved content.
        </p>
      </div>
    </Card>
  );
}

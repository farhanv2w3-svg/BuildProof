import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listAllOrganizations, listOpenReports, listAllReviewAssignments, updateReportStatus,
  setOrganizationVerification, setReviewRecordVerification, writeAuditLog, assignReviewer,
  findUserIdByEmail, errMessage,
} from "../../lib/api";
import type { ContentReport, Organization, ReviewAssignment, ReviewRecord } from "../../types/database";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorBanner, Field, Input, LoadingBlock, Select } from "../../components/ui";
import { StatusBadge, VerificationNote } from "../../components/DomainKit";
import { useAuth } from "../../lib/auth";

/* Platform-admin panels for the 0003 domains. Every action here is backed by
 * a database policy — these controls cannot grant the admin anything the
 * database does not allow. Verification and report-handling decisions are
 * recorded in the audit log (best-effort; a failed audit write is surfaced
 * as a console warning, never as a blocking error). */

export function OrganizationVerificationPanel() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["orgVerificationQueue"],
    queryFn: listAllOrganizations,
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <LoadingBlock label="Loading organisations…" />;

  const queue = ((data ?? []) as Organization[]).filter(
    (o) => o.verification_status === "unverified" || o.verification_status === "pending"
  );

  async function decide(o: Organization, status: "verified" | "rejected") {
    setBusyId(o.id); setError(null);
    try {
      await setOrganizationVerification(o.id, status);
      await writeAuditLog(user?.id ?? null, `organization.${status}`, "organizations", o.id, { name: o.name });
      await qc.invalidateQueries({ queryKey: ["orgVerificationQueue"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Organisation verification queue"
        sub="Verify organisations only when business identity is confirmed. Verification is a platform-admin decision; organisation staff can never verify themselves."
      />
      <div className="px-5 pb-5">
        {error && <div className="mb-3"><ErrorBanner message={error} /></div>}
        {queue.length === 0 ? (
          <EmptyState title="No organisations awaiting verification" />
        ) : (
          <ul className="space-y-3">
            {queue.map((o) => (
              <li key={o.id} className="rounded-lg border border-line bg-canvas p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[13.5px] font-semibold">{o.name}</span>
                    <span className="ml-2"><VerificationNote status={o.verification_status} /></span>
                    <p className="text-[12px] text-ink-soft">
                      {o.kind.replace(/_/g, " ")}{o.city ? ` · ${o.city}` : ""}{o.website_url ? ` · ${o.website_url}` : ""}
                    </p>
                  </div>
                  <span className="flex items-center gap-2">
                    <StatusBadge status={o.kind} />
                    <Button size="sm" loading={busyId === o.id} onClick={() => decide(o, "verified")}>
                      Verify
                    </Button>
                    <Button size="sm" variant="secondary" loading={busyId === o.id} onClick={() => decide(o, "rejected")}>
                      Reject
                    </Button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

export function ContentReportsPanel() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["contentReports"], queryFn: listOpenReports });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <LoadingBlock label="Loading reports…" />;
  const rows = (data ?? []) as (ContentReport & { profile: { full_name: string } | null })[];

  async function handle(r: ContentReport, status: ContentReport["status"]) {
    setBusyId(r.id); setError(null);
    try {
      await updateReportStatus(r.id, status, user!.id);
      if (status === "actioned") {
        await writeAuditLog(user?.id ?? null, "report.actioned", "content_reports", r.id, {
          subject_type: r.subject_type,
          subject_id: r.subject_id,
        });
      }
      await qc.invalidateQueries({ queryKey: ["contentReports"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Reported content"
        sub="Community reports on problems, solutions, hardware, company projects and opportunities. Handle with an honest, reviewable decision."
      />
      <div className="px-5 pb-5">
        {error && <div className="mb-3"><ErrorBanner message={error} /></div>}
        {rows.length === 0 ? (
          <EmptyState title="No open reports" />
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.id} className="rounded-lg border border-line bg-canvas p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={r.reason} />
                      <Badge tone="neutral">{r.subject_type.replace(/_/g, " ")}</Badge>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="mt-1 text-[12.5px] text-ink-soft">
                      Reported by {r.profile?.full_name ?? "user"} · subject {r.subject_id.slice(0, 8)}…
                    </p>
                    {r.detail && <p className="text-[12.5px]">“{r.detail}”</p>}
                  </div>
                  <span className="flex gap-2">
                    <Button size="sm" variant="secondary" loading={busyId === r.id} onClick={() => handle(r, "reviewed")}>
                      Mark reviewed
                    </Button>
                    <Button size="sm" loading={busyId === r.id} onClick={() => handle(r, "actioned")}>
                      Action taken
                    </Button>
                    <Button size="sm" variant="ghost" loading={busyId === r.id} onClick={() => handle(r, "dismissed")}>
                      Dismiss
                    </Button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

/** B11 — reviewer programme: admins structure outside critique by assigning
 * reviewers (by email) to specific subjects. Whether the person is suited can
 * only be judged by the admin; the database validates admin authority, not the
 * reviewer's role. */
export function ReviewerAssignmentPanel() {
  const { user } = useAuth();
  const [subjectType, setSubjectType] = useState("solution");
  const [subjectId, setSubjectId] = useState("");
  const [reviewerType, setReviewerType] = useState("technical");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const assign = async () => {
    setBusy(true); setError(null); setOk(null);
    try {
      const uid = await findUserIdByEmail(email.trim().toLowerCase());
      if (!uid) {
        setError("No BuildProof account for that email. The reviewer must sign up first.");
        return;
      }
      await assignReviewer({
        subject_type: subjectType as ReviewAssignment["subject_type"],
        subject_id: subjectId.trim(),
        reviewer_type: reviewerType as ReviewAssignment["reviewer_type"],
        reviewer_id: uid,
        assigned_by: user!.id,
      });
      await writeAuditLog(user!.id, "review.assigned", subjectType, subjectId.trim(), { reviewer_type: reviewerType });
      setOk("Reviewer assigned. They see the assignment in their review queue.");
      setSubjectId(""); setEmail("");
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Assign a reviewer"
        sub="Structured, signed reviews for public work. The reviewer submits a verdict that admins can later verify."
      />
      <div className="border-t border-line px-5 py-4">
        {ok && <p className="mb-2 text-[12.5px] font-semibold text-success" role="status">{ok}</p>}
        {error && <div className="mb-2"><ErrorBanner message={error} /></div>}
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Subject">
            <Select value={subjectType} onChange={(e) => setSubjectType(e.target.value)} className="max-w-[190px]">
              <option value="solution">Solution</option>
              <option value="hardware_project">Hardware project</option>
              <option value="company_project">Company project</option>
              <option value="problem">Problem</option>
            </Select>
          </Field>
          <Field label="Subject ID" hint="Only platform admins and the reviewer see this assignment.">
            <Input className="max-w-[320px]" placeholder="Paste the record's ID (uuid)" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} />
          </Field>
          <Field label="Reviewer kind">
            <Select value={reviewerType} onChange={(e) => setReviewerType(e.target.value)} className="max-w-[180px]">
              <option value="technical">Technical</option>
              <option value="domain_expert">Domain expert</option>
              <option value="business">Business</option>
              <option value="operations">Operations</option>
              <option value="hardware">Hardware</option>
              <option value="end_user">End user</option>
              <option value="problem_owner">Problem owner</option>
              <option value="sponsor">Sponsor</option>
            </Select>
          </Field>
          <Field label="Reviewer email">
            <Input className="max-w-[240px]" type="email" placeholder="reviewer@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button loading={busy} disabled={subjectId.trim().length < 8 || email.trim().length < 5} onClick={assign}>
            Assign
          </Button>
        </div>
        <p className="mt-2 text-[12px] text-ink-soft">
          Submitting a fake review as a verified claim is prevented server-side: reviews are only
          "verified" after platform-admin checks here in Review integrity.
        </p>
      </div>
    </Card>
  );
}

export function ReviewVerificationPanel() {  const qc = useQueryClient();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["allReviewAssignments"],
    queryFn: listAllReviewAssignments,
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <LoadingBlock label="Loading review records…" />;
  const rows = (data ?? []) as (ReviewAssignment & { record: ReviewRecord | null })[];

  return (
    <Card>
      <CardHeader
        title="Review integrity"
        sub="Only platform admins can mark a recorded review as verified — a logo or screenshot alone never counts as evidence."
      />
      <div className="px-5 pb-5">
        {error && <div className="mb-3"><ErrorBanner message={error} /></div>}
        {rows.length === 0 ? (
          <EmptyState title="No structured reviews recorded yet" />
        ) : (
          <ul className="space-y-3">
            {rows.map((a) => {
              const r = a.record;
              return (
                <li key={a.id} className="rounded-lg border border-line bg-canvas p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[13px] font-semibold">{a.subject_type.replace(/_/g, " ")} · </span>
                      <Badge tone="neutral">{a.reviewer_type.replace(/_/g, " ")}</Badge>
                      <span className="ml-1"><StatusBadge status={a.status} /></span>
                      {r ? (
                        <>
                          <p className="mt-1 text-[12.5px]">Verdict: <span className="font-semibold">{r.verdict.replace(/_/g, " ")}</span></p>
                          <p className="text-[12px] text-ink-soft">“{r.feedback}”</p>
                          <span className="mt-1 block"><VerificationNote status={r.verified ? "verified" : "unverified"} /></span>
                        </>
                      ) : (
                        <p className="text-[12px] text-ink-soft">Review not submitted yet.</p>
                      )}
                    </div>
                    {r && (
                      <Button
                        size="sm"
                        variant={r.verified ? "secondary" : "primary"}
                        loading={busyId === r.id}
                        onClick={async () => {
                          setBusyId(r.id); setError(null);
                          try {
                            await setReviewRecordVerification(r.id, !r.verified);
                            await writeAuditLog(
                              user?.id ?? null,
                              r.verified ? "review.unverified" : "review.verified",
                              "review_records",
                              r.id,
                              { assignment_id: a.id }
                            );
                            await qc.invalidateQueries({ queryKey: ["allReviewAssignments"] });
                          } catch (e) {
                            setError(e instanceof Error ? e.message : "Only platform admins can change review verification.");
                          } finally {
                            setBusyId(null);
                          }
                        }}
                      >
                        {r.verified ? "Un-verify" : "Verify review"}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

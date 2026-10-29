import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listAllOrganizations, listOpenReports, listAllReviewAssignments, updateReportStatus,
  setOrganizationVerification, setReviewRecordVerification, writeAuditLog,
} from "../../lib/api";
import type { ContentReport, Organization, ReviewAssignment, ReviewRecord } from "../../types/database";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorBanner, LoadingBlock } from "../../components/ui";
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

export function ReviewVerificationPanel() {
  const qc = useQueryClient();
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

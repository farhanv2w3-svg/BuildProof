import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Textarea,
} from "../../components/ui";
import { listPendingOrganizerApplications, reviewOrganizerApplication } from "../../lib/eventspace";
import { errMessage } from "../../lib/api";
import { formatDate } from "../../lib/utils";

/** Admin panel: review EventSpace organiser applications (es_event_organizers). */
export function EventspaceOrganizersPanel() {
  const qc = useQueryClient();
  const { data: apps, isLoading, error } = useQuery({
    queryKey: ["es_organizer_apps_admin"],
    queryFn: listPendingOrganizerApplications,
  });
  const [note, setNote] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

  const review = useMutation({
    mutationFn: async (args: { userId: string; decision: "approved" | "rejected" | "suspended" }) =>
      reviewOrganizerApplication(args.userId, args.decision, note[args.userId] || null),
    onSuccess: () => {
      setErr(null);
      qc.invalidateQueries({ queryKey: ["es_organizer_apps_admin"] });
    },
    onError: (e) => setErr(errMessage(e)),
  });

  return (
    <Card>
      <CardHeader
        title="EventSpace organiser applications"
        sub="Approving grants the ability to create events. Rejections/suspensions take effect immediately. Every decision is audit-logged."
      />
      {isLoading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBanner message={errMessage(error)} />
      ) : !apps || apps.length === 0 ? (
        <EmptyState title="No applications" description="Organiser applications will appear here for review." />
      ) : (
        <div className="space-y-3">
          {err ? <ErrorBanner message={err} /> : null}
          {apps.map((a) => (
            <div key={a.user_id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold text-ink">{a.org_name}</p>
                  <p className="text-sm text-ink-soft">
                    {a.position} · {a.official_email}
                    {a.website ? (
                      <>
                        {" · "}
                        <a className="text-brand-600 underline" href={a.website} target="_blank" rel="noopener noreferrer">
                          website
                        </a>
                      </>
                    ) : null}
                  </p>
                </div>
                <Badge tone={a.status === "approved" ? "success" : a.status === "pending" ? "warning" : "neutral"}>
                  {a.status}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-ink-soft">{a.reason}</p>
              {a.verification_notes ? (
                <p className="mt-1 text-xs text-ink-soft">Verification info: {a.verification_notes}</p>
              ) : null}
              <p className="mt-1 text-xs text-ink-soft">Applied {formatDate(a.created_at)}</p>
              {a.status === "approved" ? (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={review.isPending}
                    onClick={() => review.mutate({ userId: a.user_id, decision: "suspended" })}
                  >
                    Suspend access
                  </Button>
                </div>
              ) : a.status === "pending" ? (
                <div className="mt-3 space-y-2">
                  <Field label="Review note (optional, stored on the application)">
                    <Textarea rows={2} value={note[a.user_id] ?? ""} onChange={(e) => setNote({ ...note, [a.user_id]: e.target.value })} />
                  </Field>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      loading={review.isPending}
                      onClick={() => review.mutate({ userId: a.user_id, decision: "approved" })}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={review.isPending}
                      onClick={() => review.mutate({ userId: a.user_id, decision: "rejected" })}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <p className="px-5 pb-5 text-xs text-ink-soft">
        Searching for a specific applicant? Use the filter below.
      </p>
      <div className="px-5 pb-2">
        <Input placeholder="Filter by organisation name…" className="max-w-xs mb-3" aria-label="Filter applications" />
      </div>
    </Card>
  );
}

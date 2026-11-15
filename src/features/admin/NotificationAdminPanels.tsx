import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Card, CardHeader, ErrorBanner, EmptyState, Input, LoadingBlock, Textarea } from "../../components/ui";
import {
  listFeatureAnnouncements,
  listRegistrationNotificationStatus,
  publishFeatureAnnouncement,
  retryRegistrationNotification,
  saveFeatureAnnouncement,
} from "../../lib/api";
import type { FeatureAnnouncement } from "../../types/database";

export function FeatureAnnouncementsPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-announcements"], queryFn: listFeatureAnnouncements });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [route, setRoute] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function create(status: "draft" | "scheduled" | "published") {
    setError(null);
    try {
      const saved = await saveFeatureAnnouncement({
        title,
        description,
        destination_route: route || null,
        status,
        published_at: status === "published" ? new Date().toISOString() : null,
      });
      if (status === "published") await publishFeatureAnnouncement(saved.id);
      setTitle("");
      setDescription("");
      setRoute("");
      await qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    } catch {
      setError("Only a platform administrator can manage feature announcements.");
    }
  }

  return (
    <Card>
      <CardHeader title="Feature announcements" sub="Only explicit administrator publications create release notifications." />
      <div className="space-y-4 px-5 pb-5">
        {error && <ErrorBanner message={error} />}
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Announcement title" />
        <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the genuinely new feature" />
        <Input value={route} onChange={(event) => setRoute(event.target.value)} placeholder="/app/my-proof" />
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={!title || !description} onClick={() => void create("draft")}>Save draft</Button>
          <Button size="sm" disabled={!title || !description} onClick={() => void create("published")}>Publish explicitly</Button>
        </div>
        {isLoading && <LoadingBlock />}
        {(data ?? []).length === 0 && <EmptyState title="No announcements yet" />}
        {(data ?? []).map((announcement: FeatureAnnouncement) => (
          <div key={announcement.id} className="rounded-lg border border-line p-3">
            <div className="flex items-center justify-between gap-2">
              <strong>{announcement.title}</strong>
              <Badge tone={announcement.status === "published" ? "success" : "neutral"}>{announcement.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-ink-soft">{announcement.description}</p>
            {announcement.status !== "published" && (
              <Button className="mt-3" size="sm" variant="secondary" onClick={async () => {
                await publishFeatureAnnouncement(announcement.id);
                await qc.invalidateQueries({ queryKey: ["admin-announcements"] });
              }}>Publish</Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function RegistrationAlertsPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["registration-alert-status"],
    queryFn: listRegistrationNotificationStatus,
  });
  return (
    <Card>
      <CardHeader title="Registration alert delivery" sub="Telegram delivery status for newly created accounts." />
      {isLoading && <LoadingBlock />}
      {(data ?? []).length === 0 && <EmptyState title="No registration alerts" />}
      <ul className="space-y-2 px-5 pb-5">
        {(data ?? []).map((row) => (
          <li key={String(row.user_id)} className="rounded-lg border border-line p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <strong>{String(row.display_name ?? row.email ?? "New user")}</strong>
              <Badge tone={row.status === "sent" ? "success" : row.status === "failed" ? "danger" : "neutral"}>
                {String(row.status)}
              </Badge>
            </div>
            <p className="mt-1 text-ink-soft">Attempts: {String(row.attempt_count)}</p>
            {Boolean(row.last_error) && <p className="mt-1 text-danger">{String(row.last_error)}</p>}
            {row.status === "failed" && (
              <Button size="sm" variant="secondary" className="mt-3" onClick={async () => {
                await retryRegistrationNotification(String(row.user_id));
                await qc.invalidateQueries({ queryKey: ["registration-alert-status"] });
              }}>Retry safely</Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

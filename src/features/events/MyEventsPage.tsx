import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, PencilLine, Trash2 } from "lucide-react";
import {
  Badge, Button, ButtonLink, ConfirmDialog, EmptyState, ErrorBanner, LoadingBlock, PageTitle,
} from "../../components/ui";
import { deleteEvent, listMyEvents, setEventStatus, errMessage } from "../../lib/api";
import { formatEventDateRange, eventDurationLabel } from "../../lib/eventsRules";
import EventCard, { posterUrlFor } from "./EventCard";
import { useAuth } from "../../lib/auth";
import type { EventRow } from "../../types/database";

/* ------------------------------------------------------------------ */
/*  My Events — the organizer's own records (all statuses). Only rows  */
/*  this user created can appear (RLS additionally enforces it).       */
/* ------------------------------------------------------------------ */

export default function MyEventsPage() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["events", "mine", user?.id],
    queryFn: () => listMyEvents(user!.id),
    enabled: !!user,
  });

  if (isLoading) return <LoadingBlock label="Loading your events…" />;

  const rows = (data ?? []) as EventRow[];

  return (
    <div>
      <PageTitle
        title="My events"
        sub="Events published under your BuildProof account, including drafts and cancelled ones."
        action={<ButtonLink to="/app/events/create">Create an event</ButtonLink>}
      />

      {error && <ErrorBanner message="Your events could not be loaded. Check your connection and try again." />}

      {rows.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-8 w-8" />}
          title="You haven't created any events yet"
          description="Publish a fest, hackathon, workshop or conference under your own account. You can edit, unpublish and delete your events later."
          action={<ButtonLink to="/app/events/create">Create your first event</ButtonLink>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((ev) => <MyEventCard key={ev.id} ev={ev} />)}
        </div>
      )}
    </div>
  );
}

function MyEventCard({ ev }: { ev: EventRow }) {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const act = async (fn: () => Promise<void>) => {
    setErr(null);
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["events"] });
    } catch (e) {
      setErr(errMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <EventCard ev={ev} posterUrl={posterUrlFor(ev)} showStatusBadge>
      <div className="mt-3 border-t border-line pt-3" onClick={(e) => e.stopPropagation()}>
        <div className="text-[12px] text-ink-soft">
          {formatEventDateRange(ev.start_date, ev.end_date)} · {eventDurationLabel(ev.start_date, ev.end_date)}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {ev.status === "published" ? (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(() => setEventStatus(ev.id, "draft"))}>
              Unpublish (save as draft)
            </Button>
          ) : (
            <Button size="sm" disabled={busy} onClick={() => act(() => setEventStatus(ev.id, "published"))}>
              Publish
            </Button>
          )}
          <Link
            to={`/app/my-events/${ev.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[13px] font-semibold text-ink-soft transition-colors hover:border-brand-400 hover:text-brand-700"
          >
            <PencilLine className="h-3.5 w-3.5" aria-hidden /> Edit
          </Link>
          <Button
            size="sm"
            variant="danger"
            loading={busy}
            onClick={() => setConfirmDelete(true)}
            aria-label={`Delete ${ev.title}`}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
          </Button>
        </div>
        {ev.status !== "published" && (
          <Badge tone="warn" className="mt-2">
            {ev.status === "draft" ? "Draft — not publicly visible" : "Cancelled"}
          </Badge>
        )}
        {err && <div className="mt-2"><ErrorBanner message={err} /></div>}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete “${ev.title}”?`}
        description="This permanently removes the event and its poster. This action cannot be undone."
        confirmLabel="Delete event"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); void act(() => deleteEvent(ev.id, ev.poster_path)); }}
      />
    </EventCard>
  );
}

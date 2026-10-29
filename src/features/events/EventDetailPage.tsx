import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Building2, CalendarDays, Clock3, ExternalLink, ImageOff,
  MapPin, Phone, UserRound, Info,
} from "lucide-react";
import {
  Badge, ButtonLink, Card, ErrorBanner, LoadingBlock, InfoNote,
} from "../../components/ui";
import { DemoBadge } from "../../components/DomainKit";
import { fetchEvent, eventPosterPublicUrl } from "../../lib/api";
import {
  eventTypeLabels,
  formatEventDate,
  eventDurationLabel,
} from "../../lib/eventsRules";
import { demoEvent, demoEventPosterUrl, isDemoEvent } from "../../lib/eventsDemo";
import type { EventRow } from "../../types/database";

/* ------------------------------------------------------------------ */
/*  Event details. Shows exactly the supplied information — no blank   */
/*  sections, no invented details. Registration is ALWAYS an external  */
/*  link; BuildProof does not run event registrations or payments.     */
/* ------------------------------------------------------------------ */

export default function EventDetailPage() {
  const { eventId } = useParams();

  if (isDemoEvent(eventId)) {
    return <EventDetailBody ev={demoEvent} posterUrl={demoEventPosterUrl} isDemo />;
  }

  return <RealEventDetail eventId={eventId!} />;
}

function RealEventDetail({ eventId }: { eventId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["events", "detail", eventId],
    queryFn: () => fetchEvent(eventId),
  });

  if (isLoading) return <LoadingBlock label="Loading event…" />;

  if (error) {
    return (
      <div>
        <BackLink />
        <ErrorBanner message="This event could not be loaded. Check your connection and try again." />
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <BackLink />
        <ErrorBanner message="Event not found — it may not exist, or it is not published publicly." />
        <div className="mt-4">
          <ButtonLink to="/app/events" variant="secondary">Browse Events</ButtonLink>
        </div>
      </div>
    );
  }

  return <EventDetailBody ev={data} posterUrl={data.poster_path ? eventPosterPublicUrl(data.poster_path) : null} />;
}

function BackLink() {
  return (
    <Link to="/app/events" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 hover:underline">
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Back to Events
    </Link>
  );
}

function EventDetailBody({ ev, posterUrl, isDemo = false }: { ev: EventRow; posterUrl: string | null; isDemo?: boolean }) {
  const oneDay = ev.start_date === ev.end_date;

  return (
    <div>
      <BackLink />

      {isDemo && (
        <div className="mb-4">
          <DemoBadge />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Poster — contain, never cropped or distorted */}
        <Card className="overflow-hidden">
          <div className="flex max-h-[560px] min-h-64 items-center justify-center bg-canvas p-3">
            {posterUrl ? (
              <img
                src={posterUrl}
                alt={`Event poster for ${ev.title}`}
                className="max-h-full max-w-full rounded-md object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 py-16 text-ink-soft">
                <ImageOff className="h-9 w-9" aria-hidden />
                <span className="text-[13px]">Poster image not available</span>
              </div>
            )}
          </div>
        </Card>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{eventTypeLabels[ev.event_type] ?? ev.event_type}</Badge>
            {isDemo ? (
              <Badge tone="warn">Demo event — not a real announcement</Badge>
            ) : ev.status !== "published" ? (
              <Badge tone="warn">{ev.status === "draft" ? "Draft (not yet public)" : "Cancelled"}</Badge>
            ) : null}
          </div>

          <h1 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">{ev.title}</h1>

          <dl className="mt-4 space-y-2.5 text-[14px]">
            <DetailRow icon={<Building2 className="h-4 w-4" />} label="Organizing college">
              {ev.institution_name}
              <p className="mt-0.5 text-[11.5px] text-ink-soft">Organizer-provided name — not independently verified.</p>
            </DetailRow>
            <DetailRow icon={<MapPin className="h-4 w-4" />} label="Location">
              {ev.city}, {ev.state_name}
              {ev.venue && <span className="text-ink-soft"> · {ev.venue}</span>}
            </DetailRow>
            <DetailRow icon={<CalendarDays className="h-4 w-4" />} label={oneDay ? "Date" : "Dates"}>
              {oneDay
                ? formatEventDate(ev.start_date)
                : `${formatEventDate(ev.start_date)} – ${formatEventDate(ev.end_date)}`}
            </DetailRow>
            <DetailRow icon={<Clock3 className="h-4 w-4" />} label="Duration">
              {eventDurationLabel(ev.start_date, ev.end_date)}
            </DetailRow>
            {ev.contact_name && (
              <DetailRow icon={<UserRound className="h-4 w-4" />} label="Organizer contact">
                {ev.contact_name}
              </DetailRow>
            )}
            {ev.contact_number ? (
              <DetailRow icon={<Phone className="h-4 w-4" />} label="Contact number">
                <a className="text-brand-700 hover:underline" href={`tel:${ev.contact_number.replace(/[^\d+]/g, "")}`}>{ev.contact_number}</a>
              </DetailRow>
            ) : (
              <DetailRow icon={<Phone className="h-4 w-4" />} label="Contact number">
                <span className="text-ink-soft">Not provided</span>
              </DetailRow>
            )}
            {ev.registration_url && (
              <DetailRow icon={<ExternalLink className="h-4 w-4" />} label="Registration / info link">
                <a
                  href={ev.registration_url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-baseline gap-1 break-all text-brand-700 hover:underline"
                >
                  {ev.registration_url}
                  <ExternalLink className="h-3 w-3 self-center" aria-label="(opens in a new tab)" />
                </a>
              </DetailRow>
            )}
          </dl>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {ev.description && (
          <Card className="p-5">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-ink-soft">About the event</h2>
            <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{ev.description}</p>
          </Card>
        )}
        {ev.schedule_note && (
          <Card className="p-5">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-ink-soft">Schedule / additional information</h2>
            <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{ev.schedule_note}</p>
          </Card>
        )}
      </div>

      <div className="mt-6">
        <InfoNote>
          <span className="inline-flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
            BuildProof lists event information only. Registration, attendance and payments are handled by the organizer — the link above (when provided) goes to their official page.
          </span>
        </InfoNote>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-brand-600">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[11.5px] font-bold uppercase tracking-wide text-ink-soft">{label}</dt>
        <dd className="text-ink">{children}</dd>
      </div>
    </div>
  );
}

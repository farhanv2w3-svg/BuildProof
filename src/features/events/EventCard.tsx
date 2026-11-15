import { Link } from "react-router-dom";
import { CalendarDays, MapPin, Clock3, Building2, ImageOff } from "lucide-react";
import { Card } from "../../components/ui";
import { cn } from "../../lib/utils";
import type { EventRow } from "../../types/database";
import {
  eventTypeLabels,
  formatEventDateRange,
  eventDurationLabel,
} from "../../lib/eventsRules";
import { eventPosterPublicUrl } from "../../lib/api";
import { demoEventPosterUrl, DEMO_EVENT_ID } from "../../lib/eventsDemo";

/** Poster URL resolution lives in one place: the demo event uses the bundled
 * fictional asset; real events use their storage public URL. */
export function posterUrlFor(ev: EventRow): string | null {
  if (ev.poster_path === "demo-event-poster.svg") return demoEventPosterUrl;
  if (!ev.poster_path) return null;
  return eventPosterPublicUrl(ev.poster_path);
}

/**
 * One event in a discovery/management grid. The poster area is fixed-height
 * with object-fit: contain so no poster is ever cropped, distorted or
 * stretched — different aspect ratios stay aligned and readable.
 */
export default function EventCard({
  ev,
  posterUrl,
  isDemo = false,
  showStatusBadge = false,
  children, // extra actions (My Events)
}: {
  ev: EventRow;
  posterUrl: string | null;
  isDemo?: boolean;
  showStatusBadge?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "flex h-full flex-col overflow-hidden",
        isDemo && "border-amber-300/70"
      )}
    >
      {/* Poster — contain, never crop */}
      <div className="flex h-64 items-center justify-center overflow-hidden border-b border-line bg-canvas">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={`Event poster for ${ev.title}`}
            className="max-h-full max-w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-ink-soft" aria-label="Poster image not available">
            <ImageOff className="h-7 w-7" aria-hidden />
            <span className="text-[12px]">Poster unavailable</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
            {eventTypeLabels[ev.event_type] ?? ev.event_type}
          </span>
          {isDemo && (
            <span className="rounded-md border border-amber-300/70 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
              DEMO — not a real event
            </span>
          )}
          {showStatusBadge && (
            <span className="rounded-md bg-line/60 px-2 py-0.5 text-[11px] font-semibold capitalize text-ink-soft">
              {ev.status}
            </span>
          )}
        </div>

        <h3 className="mt-2 line-clamp-2 font-display text-[15px] font-bold leading-snug text-ink">
          {ev.title}
        </h3>

        <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px] text-ink-soft">
          <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="line-clamp-1">{ev.institution_name}</span>
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-soft">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {ev.city}, {ev.state_name}
        </p>

        <div className="mt-2 flex-1">
          <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden />
            {formatEventDateRange(ev.start_date, ev.end_date)}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-soft">
            <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {eventDurationLabel(ev.start_date, ev.end_date)}
          </p>
        </div>

        {children /* actions, e.g. edit controls */}
        <Link
          to={isDemo ? `/events/${DEMO_EVENT_ID}` : `/events/${ev.id}`}
          className="mt-3 inline-flex items-center justify-center rounded-lg border border-line px-3 py-2 text-[13px] font-semibold text-brand-700 transition-colors hover:border-brand-400 hover:bg-brand-50"
        >
          View details
        </Link>
      </div>
    </Card>
  );
}

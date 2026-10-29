import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Search, CalendarDays, Sparkles, AlertTriangle } from "lucide-react";
import {
  Button, ButtonLink, EmptyState, ErrorBanner, Input, LoadingBlock, PageTitle, Select,
} from "../../components/ui";
import { listEvents } from "../../lib/api";
import { EVENT_TYPES, eventTypeLabels } from "../../lib/eventsRules";
import { demoEvent, DEMO_EVENT_ID } from "../../lib/eventsDemo";
import EventCard, { posterUrlFor } from "./EventCard";
import type { EventRow } from "../../types/database";

/* ------------------------------------------------------------------ */
/*  Events discovery — clean card grid with search + filters.          */
/*  The labelled demo event is ALWAYS shown first so organizers and    */
/*  students can see what a complete event looks like; it is clearly   */
/*  fictional and never touches the database.                          */
/* ------------------------------------------------------------------ */

type WhenFilter = "all" | "upcoming" | "past";

export default function EventsPage() {
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [eventType, setEventType] = useState("");
  const [when, setWhen] = useState<WhenFilter>("all");
  const [sort, setSort] = useState<"soonest" | "newest">("soonest");

  const { data, isLoading, error } = useQuery({
    queryKey: ["events", "discover"],
    queryFn: () => listEvents({ limit: 200 }),
  });

  const rows: EventRow[] = useMemo(() => (data ?? []) as EventRow[], [data]);

  // Filter + sort client-side so filter options stay stable across searches.
  const cities = useMemo(() => distinct(rows.map((r) => r.city)), [rows]);
  const states = useMemo(
    () => distinct(rows.map((r) => r.state_name)),
    [rows]
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (term && !(`${r.title}`.toLowerCase().includes(term) || r.institution_name.toLowerCase().includes(term))) return false;
      if (city && r.city !== city) return false;
      if (stateName && r.state_name !== stateName) return false;
      if (eventType && r.event_type !== eventType) return false;
      if (when !== "all") {
        const isUpcoming = r.end_date >= todayIso();
        if (when === "upcoming" && !isUpcoming) return false;
        if (when === "past" && isUpcoming) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) =>
      sort === "soonest"
        ? a.start_date.localeCompare(b.start_date) || a.end_date.localeCompare(b.end_date)
        : b.created_at.localeCompare(a.created_at)
    );
    return list;
  }, [rows, q, city, stateName, eventType, when, sort]);

  const filters = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="block">
        <span className="mb-1 block text-[12px] font-semibold text-ink-soft">Search title or college</span>
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. hackathon, a college name…"
          aria-label="Search events by title or college"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[12px] font-semibold text-ink-soft">City</span>
        <Select value={city} onChange={(e) => setCity(e.target.value)} aria-label="Filter by city">
          <option value="">All cities</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[12px] font-semibold text-ink-soft">State / UT</span>
        <Select value={stateName} onChange={(e) => setStateName(e.target.value)} aria-label="Filter by state">
          <option value="">All states</option>
          {states.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[12px] font-semibold text-ink-soft">Event type</span>
        <Select value={eventType} onChange={(e) => setEventType(e.target.value)} aria-label="Filter by event type">
          <option value="">All types</option>
          {EVENT_TYPES.map((t) => <option key={t} value={t}>{eventTypeLabels[t]}</option>)}
        </Select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[12px] font-semibold text-ink-soft">When</span>
        <Select value={when} onChange={(e) => setWhen(e.target.value as WhenFilter)} aria-label="Filter upcoming or past">
          <option value="all">Upcoming &amp; past</option>
          <option value="upcoming">Upcoming only</option>
          <option value="past">Past only</option>
        </Select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[12px] font-semibold text-ink-soft">Sort</span>
        <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort events">
          <option value="soonest">Start date — soonest first</option>
          <option value="newest">Recently added first</option>
        </Select>
      </label>
    </div>
  );

  const hasAnyFilter = q.trim() !== "" || city !== "" || stateName !== "" || eventType !== "" || when !== "all";

  return (
    <div>
      <PageTitle
        title="Events"
        sub="Fests, hackathons, workshops and conferences hosted by colleges — discover where and when they happen. College names are supplied by event organizers and are not independently verified."
        action={
          <div className="flex gap-2">
            <ButtonLink to="/app/events/create">Create an event</ButtonLink>
            <ButtonLink to="/app/my-events" variant="secondary">My events</ButtonLink>
          </div>
        }
      />

      {error && <ErrorBanner message="Events could not be loaded. Check your connection and try again." />}

      {isLoading ? (
        <LoadingBlock label="Loading events…" />
      ) : (
        <div className="space-y-5">
          <div className="rounded-card border border-line bg-surface p-4">{filters}</div>

          {/* Demo example card — always first, unmistakably labelled */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-amber-700">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Example event (demo) — see how a published event appears
            </p>
            <EventCard ev={demoEvent} posterUrl={posterUrlFor(demoEvent)} isDemo />
          </div>

          <div>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.14em] text-ink-soft">
              Published events {filtered.length > 0 && `(${filtered.length})`}
            </p>
            {!hasAnyFilter && rows.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="h-8 w-8" />}
                title="No events published yet"
                description="When organizers publish college events, they will appear here. Anyone signed in can publish an event under their own account."
                action={<ButtonLink to="/app/events/create">Publish the first event</ButtonLink>}
              />
            ) : hasAnyFilter && filtered.length === 0 ? (
              <EmptyState
                icon={<Search className="h-8 w-8" />}
                title="No events match these filters"
                description="Try a different search term, or clear the filters to see everything."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => { setQ(""); setCity(""); setStateName(""); setEventType(""); setWhen("all"); }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              filtered.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((ev) => (
                    <EventCard key={ev.id} ev={ev} posterUrl={posterUrlFor(ev)} />
                  ))}
                </div>
              )
            )}
          </div>

          <p className="flex items-start gap-2 rounded-lg border border-line bg-canvas px-3 py-2 text-[12px] text-ink-soft">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            The demo example above is fictional and included for illustration — it is not a real announcement and never stored as real data. BuildProof does not handle event registration, ticketing or payments.
          </p>
          <p className="text-[12px] text-ink-soft">
            Looking for an event you saw earlier? Open its page directly, e.g. <Link className="text-brand-700 underline" to={`/app/events/${DEMO_EVENT_ID}`}>the demo event page</Link>.
          </p>
        </div>
      )}
    </div>
  );
}

function distinct(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

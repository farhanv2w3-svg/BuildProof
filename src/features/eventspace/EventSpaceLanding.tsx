import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, EmptyState, ErrorBanner, Input, LoadingBlock, Select } from "../../components/ui";
import { DomainHero, DomainGrid, filterCls } from "../../components/DomainKit";
import { discoverEvents, eventMediaUrl } from "../../lib/eventspace";
import { ES_EVENT_CATEGORIES, esEventCategoryLabels, ES_FORMAT_LABELS, registrationWindowOpen } from "../../lib/eventspaceRules";
import type { EsEventRow } from "../../types/database";
import { formatDate } from "../../lib/utils";

export function EventCard({ event }: { event: EsEventRow }) {
  const cover = eventMediaUrl(event.cover_path ?? event.poster_path);
  const regOpen = registrationWindowOpen(event);
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <Link to={`/eventspace/${event.slug}`} className="block">
        {cover ? (
          <img src={cover} alt="" className="h-40 w-full rounded-t-2xl object-cover" loading="lazy" />
        ) : (
          <div className="flex h-40 w-full items-center justify-center rounded-t-2xl bg-brand-50 text-brand-700">
            <span className="text-4xl font-black tracking-tight">BP</span>
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-ink-soft">
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-700">
            {esEventCategoryLabels[event.category]}
          </span>
          <span>{ES_FORMAT_LABELS[event.format]}</span>
          {event.city ? <span>· {event.city}</span> : null}
        </div>
        <Link to={`/eventspace/${event.slug}`} className="font-semibold leading-snug text-ink hover:text-brand-600">
          {event.title}
        </Link>
        <p className="line-clamp-2 text-sm text-ink-soft">{event.short_description}</p>
        <p className="text-xs text-ink-soft">{event.institution_name}</p>
        <div className="mt-auto flex items-center justify-between pt-2 text-xs text-ink-soft">
          <span>{formatDate(event.starts_at)}</span>
          <span className={regOpen ? "font-semibold text-brand-600" : "text-ink-soft"}>
            {regOpen ? "Registration open" : "Registration closed"}
          </span>
        </div>
      </div>
    </Card>
  );
}

export default function EventSpaceLanding() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [format, setFormat] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["es_discovery", { search, category, format, page }],
    queryFn: () =>
      discoverEvents({
        search: search || undefined,
        category: category || undefined,
        format: format || undefined,
        page,
      }),
  });

  const totalPages = useMemo(
    () => (data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1),
    [data]
  );

  const featured = (data?.events ?? []).slice(0, 3);

  return (
    <div className="space-y-8">
      <DomainHero
        kicker="EventSpace"
        title="Competitions where ideas become proof"
        intro="Discover hackathons, ideathons and exhibitions hosted on BuildProof — register with your real work, submit privately, get judged fairly, and showcase what you shipped."
        actions={
          <>
            <Link to="/eventspace/organizer" className="no-underline">
              <Button variant="secondary">Become an organiser</Button>
            </Link>
            <a href="#events" className="no-underline">
              <Button>Browse events</Button>
            </a>
          </>
        }
      />

      <section id="events" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[220px] flex-1">
            <Input
              aria-label="Search events"
              placeholder="Search events, institutions…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <button
            type="button"
            className={filterCls(category === "")}
            onClick={() => {
              setCategory("");
              setPage(1);
            }}
          >
            All categories
          </button>
          {ES_EVENT_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={filterCls(category === c)}
              onClick={() => {
                setCategory(c);
                setPage(1);
              }}
            >
              {esEventCategoryLabels[c]}
            </button>
          ))}
          <div className="w-40">
            <Select
              aria-label="Format filter"
              value={format}
              onChange={(e) => {
                setFormat(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Any format</option>
              <option value="online">Online</option>
              <option value="offline">In person</option>
              <option value="hybrid">Hybrid</option>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <LoadingBlock label="Finding events…" />
        ) : error ? (
          <ErrorBanner message={error instanceof Error ? error.message : "Could not load events."} />
        ) : !data || data.events.length === 0 ? (
          <EmptyState
            title="No events match yet"
            description="Try different filters, or check back soon — organisers publish new events regularly."
          />
        ) : (
          <>
            {page === 1 && !search && !category && !format ? (
              <section className="space-y-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Featured &amp; upcoming</h2>
                <DomainGrid>
                  {featured.map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </DomainGrid>
              </section>
            ) : null}
            <DomainGrid>
              {data.events
                .slice(page === 1 && !search && !category && !format ? 3 : 0)
                .map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
            </DomainGrid>
            {totalPages > 1 ? (
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <span className="text-sm text-ink-soft">
                  Page {page} of {totalPages}
                </span>
                <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

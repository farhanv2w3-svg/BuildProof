import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, EmptyState, ErrorBanner, LoadingBlock, PrivacyNote } from "../../components/ui";
import { DomainHero } from "../../components/DomainKit";
import { listPublicResults, listPublicShowcasesForEvent, eventMediaUrl } from "../../lib/eventspace";
import { shareLinks } from "../../lib/eventspaceRules";
import { errMessage } from "../../lib/api";
import { formatDate } from "../../lib/utils";
import type { EsPublicShowcaseRow } from "../../types/database";

const AWARD_ORDER = [
  "winner",
  "runner_up",
  "second_runner_up",
  "best_innovation",
  "best_prototype",
  "best_research",
  "special_recognition",
  "custom",
];

const AWARD_LABELS: Record<string, string> = {
  winner: "Winner",
  runner_up: "Runner-up",
  second_runner_up: "Second runner-up",
  best_innovation: "Best innovation",
  best_prototype: "Best prototype",
  best_research: "Best research",
  special_recognition: "Special recognition",
  custom: "Special award",
};

function ShowcaseCard({ item }: { item: EsPublicShowcaseRow }) {
  const image = eventMediaUrl(item.image_path);
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/eventspace/${item.event_slug}/showcase#p-${item.id}`;
  const links = shareLinks(url, `${item.approved_title} — featured project`);
  return (
    <div id={`p-${item.id}`} className="h-full">
    <Card className="flex h-full flex-col gap-3">
      {image ? <img src={image} alt="" className="h-40 w-full rounded-xl object-cover" loading="lazy" /> : null}
      <div className="flex flex-1 flex-col gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-brand-600">
          {item.event_title}
        </p>
        <h3 className="font-bold text-ink">{item.approved_title}</h3>
        <p className="text-sm leading-relaxed text-ink-soft">{item.approved_summary}</p>
        {item.team_attribution?.length ? (
          <p className="text-xs font-semibold text-ink">
            By {item.team_attribution.map((t) => t.name).join(", ")}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          {item.approved_demo_url ? (
            <a className="no-underline" href={item.approved_demo_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="secondary">Live demo</Button>
            </a>
          ) : null}
          {item.approved_github_url ? (
            <a className="no-underline" href={item.approved_github_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="secondary">Code</Button>
            </a>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${links.whatsapp}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch { /* clipboard unavailable */ }
            }}
          >
            {copied ? "Share link copied ✓" : "Share"}
          </Button>
        </div>
      </div>
    </Card>
    </div>
  );
}

export default function EventShowcasePage() {
  const { slug = "" } = useParams();

  const { data: showcases, isLoading, error } = useQuery({
    queryKey: ["es_public_showcases", slug],
    queryFn: () => listPublicShowcasesForEvent(slug),
  });
  const { data: results } = useQuery({
    queryKey: ["es_public_results", slug],
    queryFn: () => listPublicResults(slug),
  });

  if (isLoading) return <LoadingBlock label="Loading showcase…" />;
  if (error) return <ErrorBanner message={errMessage(error)} />;

  const orderedResults = [...(results ?? [])].sort(
    (a, b) =>
      AWARD_ORDER.indexOf(a.award_category) - AWARD_ORDER.indexOf(b.award_category) ||
      (a.position ?? 99) - (b.position ?? 99)
  );

  return (
    <div className="space-y-10">
      <DomainHero
        kicker="EventSpace showcase"
        title="Projects shipped & recognised"
        intro="Every project below was approved by its own team before publication — private files, judge notes and personal contacts are never shown here."
        actions={
          <Link to={`/eventspace/${slug}`} className="no-underline">
            <Button variant="secondary">Event page</Button>
          </Link>
        }
      />

      {orderedResults.length > 0 ? (
        <section className="mx-auto w-full space-y-3 px-4 sm:px-6" style={{ maxWidth: "78rem" }}>
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Results</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {orderedResults.map((r) => (
              <Card key={r.id} className="p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-brand-600">
                  {AWARD_LABELS[r.award_category] ?? r.award_name}
                  {r.position ? ` · #${r.position}` : ""}
                </p>
                <p className="mt-1 font-bold text-ink">
                  {r.approved_title ?? "Winning project"}
                </p>
                {r.approved_summary ? <p className="mt-1 text-sm text-ink-soft">{r.approved_summary}</p> : null}
                {r.team_attribution?.length ? (
                  <p className="mt-1 text-xs font-semibold text-ink">{r.team_attribution.map((t) => t.name).join(", ")}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.approved_demo_url ? (
                    <a className="text-xs font-semibold text-brand-600 underline" href={r.approved_demo_url} target="_blank" rel="noopener noreferrer">
                      Demo
                    </a>
                  ) : null}
                  {r.approved_github_url ? (
                    <a className="text-xs font-semibold text-brand-600 underline" href={r.approved_github_url} target="_blank" rel="noopener noreferrer">
                      GitHub
                    </a>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto w-full space-y-3 px-4 pb-12 sm:px-6" style={{ maxWidth: "78rem" }}>
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Featured projects</h2>
        {!showcases || showcases.length === 0 ? (
          <EmptyState
            title="No published projects yet"
            description="Showcase entries appear here once both the project team and the organiser approve publication."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {showcases.map((s) => (
              <ShowcaseCard key={s.id} item={s} />
            ))}
          </div>
        )}
      </section>

      <PrivacyNote>
        Published: {results?.length ?? 0} award entries · last updated{" "}
        {showcases?.[0]?.published_at ? formatDate(showcases[0].published_at) : "—"}
      </PrivacyNote>
    </div>
  );
}

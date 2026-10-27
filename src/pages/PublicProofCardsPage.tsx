import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, SearchX } from "lucide-react";
import { listPublicCards } from "../lib/api";
import { Badge, Card, EmptyState, LoadingBlock, PageTitle, ButtonLink } from "../components/ui";
import { useState } from "react";

export default function PublicProofCardsPage() {
  const { data: cards, isLoading } = useQuery({
    queryKey: ["publicCards"],
    queryFn: listPublicCards,
  });
  const [q, setQ] = useState("");

  if (isLoading) return <LoadingBlock />;

  const visible = (cards ?? []).filter((c) => c.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="container-xl py-14 sm:px-6">
      <PageTitle
        title="Proof Cards"
        sub="Only cards that completed review and explicit publication appear here. Interview notes, attachments and contact details are never published."
        action={<ButtonLink to="/how-it-works" variant="secondary" size="sm">How tiers work</ButtonLink>}
      />

      <div className="mb-6 max-w-sm">
        <input
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          placeholder="Search published cards…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search Proof Cards"
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-6 w-6" />}
          title="No published Proof Cards yet"
          description="Approved cards appear here once an institution or platform admin publishes them. Nothing is published automatically."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c) => (
            <Card key={c.id} className="flex flex-col p-5">
              <div className="flex items-center justify-between gap-2">
                <Badge tone={c.tier >= 2 ? "success" : "neutral"}>
                  <BadgeCheck className="h-3.5 w-3.5" /> Tier {c.tier}
                </Badge>
                <span className="text-[11px] text-ink-soft">
                  {c.published_at ? new Date(c.published_at).toLocaleDateString() : ""}
                </span>
              </div>
              <h3 className="display-title mt-3 text-[15px] leading-snug">{c.title}</h3>
              <p className="mt-1.5 line-clamp-3 text-[13px] text-ink-soft">{c.problem_summary}</p>
              <dl className="mt-3 space-y-2 text-[12.5px]">
                <div>
                  <dt className="font-bold text-ink">Validation</dt>
                  <dd className="line-clamp-2 text-ink-soft">{c.validation_summary}</dd>
                </div>
                <div>
                  <dt className="font-bold text-ink">Results & limits</dt>
                  <dd className="line-clamp-2 text-ink-soft">{c.results_limitations || "—"}</dd>
                </div>
              </dl>
              <p className="mt-3 border-t border-line pt-3 text-[11px] text-ink-soft">
                Published summary only — private notes, attachments and personal details are kept out.
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

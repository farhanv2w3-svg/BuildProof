import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listMyCards } from "../../lib/api";
import type { ProofCard } from "../../types/database";
import { Badge, Button, ButtonLink, Card, LoadingBlock, EmptyState } from "../../components/ui";
import { DemoCard, StatusBadge } from "../../components/DomainKit";
import { demoFailedProject } from "../../lib/demoData";
import { useAuth } from "../../lib/auth";
import { ProofCardContributions } from "./ProofContributions";

const STATUS_EXPLANATIONS: Record<string, string> = {
  draft: "Visible to the team only.",
  submitted: "Sent for review; awaiting an authorised reviewer.",
  changes_requested: "A reviewer asked for revisions — address the feedback and resubmit.",
  approved: "Accepted against the review's agreed criteria.",
  published: "Approved and publicly viewable on /proof-cards.",
  rejected: "Did not meet the review criteria this time.",
};

export default function MyProofPage() {
  const { user } = useAuth();

  const [showArchived, setShowArchived] = useState(false);
  const { data: cards, isLoading } = useQuery({
    queryKey: ["myCards", user?.id, showArchived],
    queryFn: () => listMyCards(user!.id, showArchived),
    enabled: !!user,
  });

  if (isLoading) return <LoadingBlock label="Loading your proof…" />;

  const list = (cards ?? []) as ProofCard[];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display-title text-2xl">My Proof</h1>
          <p className="mt-1 max-w-2xl text-[14px] text-ink-soft">
            Your contribution and outcome records. A Proof Card separates the <strong>project outcome</strong> from
            <strong> your individual performance</strong> — team success doesn't mean every member contributed equally,
            and a project failing commercially never erases excellent work.
          </p>
        </div>
        <ButtonLink to="/app" variant="secondary" size="sm">Back to dashboard</ButtonLink>
      </div>

      <div className="mb-4 flex gap-2">
        <Button size="sm" variant={!showArchived ? "primary" : "secondary"} onClick={() => setShowArchived(false)}>Active cards</Button>
        <Button size="sm" variant={showArchived ? "primary" : "secondary"} onClick={() => setShowArchived(true)}>Archived cards</Button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          title={showArchived ? "No archived Proof Cards" : "No active Proof Cards yet"}
          description={showArchived ? "Archived cards preserve their evidence and can be restored at any time." : "CollectiveEvidence is created from your team's validated, built and reviewed work. Cards start in workspaces like Validation and Prototype & testing, then get reviewed."}
        />
      ) : (
        <div className="space-y-4">
          {list.map((c) => (
            <Card key={c.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-[15px] font-bold text-ink">
                    <Link to={`/app/proof-cards/${c.id}`} className="hover:text-brand-700">{c.title}</Link>
                  </h2>
                  <p className="mt-0.5 text-[12.5px] text-ink-soft">Problem: {c.problem_title}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="brand">Tier {c.tier}</Badge>
                  <StatusBadge status={c.review_status} />
                </div>
              </div>
              <p className="mt-2 text-[12.5px] text-ink-soft">{STATUS_EXPLANATIONS[c.review_status]}</p>
              <dl className="mt-3 grid gap-2 text-[12.5px] sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-ink">Validation</dt>
                  <dd className="text-ink-soft">{c.validation_summary}</dd>
                </div>
                {c.built_summary && (
                  <div>
                    <dt className="font-semibold text-ink">What was built</dt>
                    <dd className="text-ink-soft">{c.built_summary}</dd>
                  </div>
                )}
                {c.results_limitations && (
                  <div className="sm:col-span-2">
                    <dt className="font-semibold text-ink">Results & limitations</dt>
                    <dd className="text-ink-soft">{c.results_limitations}</dd>
                  </div>
                )}
              </dl>
              <ProofCardContributions cardId={c.id} />
            </Card>
          ))}
        </div>
      )}

      <div className="mt-10">
        <h2 className="text-[15px] font-bold text-ink">How outcomes and performance stay separate</h2>
        <p className="mt-1 max-w-2xl text-[13.5px] text-ink-soft">
          Percentages only count when the denominator is defined — like “8 of 10 agreed functional tests passed”.
        </p>
        <div className="mt-3 max-w-2xl">
          <DemoCard demo={demoFailedProject} />
        </div>
      </div>
    </div>
  );
}

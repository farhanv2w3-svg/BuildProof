import { useEffect, useState } from "react";
import { ButtonLink } from "../components/ui";
import {
  DemoCard, DomainHero, ListingCard, StatusBadge, VerificationNote,
} from "../components/DomainKit";
import { errMessage, listSolutions } from "../lib/api";
import type { Solution } from "../types/database";
import { solutionDemos } from "../lib/demoData";

const CATEGORY_LABELS: Record<string, string> = {
  software: "Software prototype",
  ai_data: "AI & data",
  business_automation: "Business automation",
  education: "Educational tool",
  social_impact: "Social impact",
  agriculture: "Agriculture & sustainability",
  electronics: "Electronics & embedded",
  robotics: "Robotics & automation",
  hardware: "Hardware device",
  other: "Other",
};

export default function PublicSolutionsPage() {
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    listSolutions()
      .then((rows) => { if (live) setSolutions(rows); })
      .catch((e) => { if (live) setError(errMessage(e)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  return (
    <div className="pb-20">
      <DomainHero
        kicker="Solutions Marketplace"
        title="Work that already exists — with evidence"
        intro="Unlike Problems, these are prototypes teams have already built, tested or piloted. Each listing shows its stage, evidence, known limitations and licensing stance. A prototype existing never means it is commercially validated — every listing says exactly what is proven and what is not."
        actions={<ButtonLink to="/signup" size="md">Publish your solution</ButtonLink>}
      />

      <div className="mx-auto mt-8 grid w-full max-w-6xl gap-4 px-4 sm:px-6 lg:grid-cols-3">
        {[
          ["Stage, honestly labelled", "Prototype → Tested → Pilot → Commercially in use. Status changes require evidence, not optimism."],
          ["Permitted exposure", "Listed solutions show only what the team chose to publish. Confidential source and documents stay private."],
          ["Structured interest", "Adopters, founders and funders express interest through a recordable, trackable workflow."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-card border border-line bg-surface p-4">
            <h3 className="text-[13px] font-bold text-ink">{t}</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{d}</p>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-8 w-full max-w-6xl px-4 sm:px-6">
        <h2 className="text-[17px] font-bold text-ink">Listed solutions</h2>
        {error && <p className="mt-2 text-[13px] text-danger" role="alert">{error}</p>}
        {loading ? (
          <p className="mt-3 text-[13.5px] text-ink-soft">Loading solutions…</p>
        ) : solutions.length === 0 ? (
          <div className="mt-3 rounded-card border border-dashed border-line bg-surface p-6 text-center">
            <p className="text-[14px] font-semibold text-ink">No solutions are publicly listed yet.</p>
            <p className="mt-1 text-[13px] text-ink-soft">Teams publish here once they have a tested prototype and choose listing.</p>
            <div className="mt-3"><ButtonLink to="/signup">Start a project</ButtonLink></div>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {solutions.map((s) => (
              <ListingCard
                key={s.id}
                title={s.name}
                badges={<StatusBadge status={s.stage} />}
                skills={[]}
              >
                <span className="text-ink">{CATEGORY_LABELS[s.category] ?? s.category}</span>
                <p className="mt-1">{s.summary}</p>
                {s.known_limitations && (
                  <p className="mt-2 text-[12.5px]"><span className="font-semibold text-ink">Limitations:</span> {s.known_limitations}</p>
                )}
                {s.next_steps && (
                  <p className="mt-1 text-[12.5px]"><span className="font-semibold text-ink">Next steps:</span> {s.next_steps}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[12px] text-ink-soft">Licensing:</span> <StatusBadge status={s.license_status} />
                </div>
              </ListingCard>
            ))}
          </div>
        )}
      </div>

      <div className="mx-auto mt-12 w-full max-w-6xl px-4 sm:px-6">
        <h2 className="display-title text-2xl">What a listing teaches</h2>
        <p className="mt-2 max-w-2xl text-[14px] text-ink-soft">
          This fictional example shows how evidence, limitations and creator rights are presented.
          It is labelled fiction and never represents real activity.
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {solutionDemos.map((d) => <DemoCard key={d.id} demo={d} />)}
        </div>
      </div>

      <div className="mx-auto mt-10 w-full max-w-6xl px-4 sm:px-6">
        <VerificationNote status="unverified" />
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">
          Solutions move between private → restricted (approved parties only) → listed. Teams keep
          attribution; any transfer of ownership follows a written agreement step in the app before
          restricted access changes — and students' rights are never automatically removed.
        </p>
      </div>
    </div>
  );
}

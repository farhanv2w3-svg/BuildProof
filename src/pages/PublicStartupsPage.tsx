import { useEffect, useState } from "react";
import { ButtonLink } from "../components/ui";
import {
  DemoCard, DomainHero, ListingCard, StatusBadge, moneyRange, VerificationNote,
} from "../components/DomainKit";
import { errMessage, listFundingOpportunities } from "../lib/api";
import type { FundingOpportunity } from "../types/database";
import { startupDemos } from "../lib/demoData";

type FundingRow = FundingOpportunity & { organization: { name: string; verification_status: string } | null };

export default function PublicStartupsPage() {
  const [funding, setFunding] = useState<FundingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    listFundingOpportunities()
      .then((rows) => { if (live) setFunding(rows as FundingRow[]); })
      .catch((e) => { if (live) setError(errMessage(e)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  return (
    <div className="pb-20">
      <DomainHero
        kicker="Startups & Funding"
        title="Two separate pathways: founders and funders"
        intro="A validated idea, a prototype, a business opportunity, an operating startup and a funded company are different things. BuildProof keeps them distinct. Founders discover evidence-backed solutions and structured conversations; funders list real programmes with criteria, ranges and expectations. Nothing here promises investment or guarantees a startup's success."
        actions={
          <>
            <ButtonLink to="/solutions" variant="secondary" size="md">Browse eligible solutions</ButtonLink>
            <ButtonLink to="/signup" size="md">Start as a founder</ButtonLink>
          </>
        }
      />

      {/* Founder pathways */}
      <div className="mx-auto mt-8 grid w-full max-w-6xl gap-3 px-4 sm:grid-cols-3 sm:px-6">
        {[
          ["Idea, no team", "Specify the roles you need, review candidates' Proof Cards, and draft ownership and compensation terms before any restricted work begins."],
          ["Resources, no idea", "Explore validation reports and evidence-backed problem areas. Access to a team or solution never grants automatic ownership."],
          ["Solution, want a business", "Take a validated prototype through structured due diligence with a prospective collaborator or funder — with creator rights agreed explicitly."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-card border border-line bg-surface p-4">
            <h3 className="text-[13px] font-bold text-ink">{t}</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{d}</p>
          </div>
        ))}
      </div>

      {/* Startup stages */}
      <div className="mx-auto mt-8 w-full max-w-6xl px-4 sm:px-6">
        <div className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-[14px] font-bold text-ink">Startup progress is tracked stage by stage</h2>
          <p className="mt-1 text-[12.5px] text-ink-soft">Each transition requires suitable evidence — a prototype or a funding interest never automatically becomes “a successful startup”.</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
            {["Problem identified", "Feasibility assessed", "Prototype developed", "Potential users evaluated", "Business model explored", "Rights agreed", "Further development funded", "Pilot or launch"].map((s, i) => (
              <span key={s} className="flex items-center gap-1">
                <span className="rounded-md bg-brand-50 px-2 py-1 font-semibold text-brand-700">{i + 1}. {s}</span>
                {i < 7 && <span className="text-ink-soft/60">→</span>}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Funding listings */}
      <div className="mx-auto mt-8 w-full max-w-6xl px-4 sm:px-6">
        <h2 className="text-[17px] font-bold text-ink">Funding opportunities</h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          Listings below come from the database. Verified programmes carry a verified badge; unverified ones are labelled honestly.
        </p>
        {error && <p className="mt-2 text-[13px] text-danger" role="alert">{error}</p>}
        {loading ? (
          <p className="mt-3 text-[13.5px] text-ink-soft">Loading funding listings…</p>
        ) : funding.length === 0 ? (
          <div className="mt-3 rounded-card border border-dashed border-line bg-surface p-6 text-center">
            <p className="text-[14px] font-semibold text-ink">No funding programmes listed yet.</p>
            <p className="mt-1 text-[13px] text-ink-soft">
              BuildProof never invents funding availability. Funder organisations publish real programmes here.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {funding.map((f) => (
              <ListingCard key={f.id} title={f.title} badges={<StatusBadge status={f.status} />}>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={f.category} />
                  {f.organization ? (
                    <>
                      <span className="text-[13px] font-semibold text-ink">{f.organization.name}</span>
                      <VerificationNote status={f.organization.verification_status} />
                    </>
                  ) : (
                    <VerificationNote status={f.verification_status} />
                  )}
                </div>
                <p className="mt-2">{f.description}</p>
                {f.criteria && <p className="mt-1 text-[12.5px]"><span className="font-semibold text-ink">Criteria:</span> {f.criteria}</p>}
                {(f.min_amount != null || f.max_amount != null) && (
                  <p className="mt-1 text-[12.5px]">
                    <span className="font-semibold text-ink">Range:</span> {moneyRange(f.min_amount, f.max_amount, f.currency)}
                  </p>
                )}
                {f.application_requirements && (
                  <p className="mt-1 text-[12.5px]"><span className="font-semibold text-ink">To apply:</span> {f.application_requirements}</p>
                )}
              </ListingCard>
            ))}
          </div>
        )}
      </div>

      {/* Solution transfer */}
      <div className="mx-auto mt-10 w-full max-w-6xl px-4 sm:px-6">
        <div className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-[14px] font-bold text-ink">Bringing student work into a business: agreed, never automatic</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
            Before any solution changes hands, an agreement records who owns existing work, the transaction type
            (licence, assignment, acquisition or further-development), compensation, royalties, what is transferred,
            confidentiality, and access revocation after handover. Students' attribution and rights are preserved
            unless explicitly agreed otherwise — and consequential transactions always warrant qualified legal advice.
          </p>
          <ul className="mt-3 grid gap-1.5 text-[12.5px] text-ink-soft sm:grid-cols-2">
            {[
              "Ownership of pre-existing and newly created work",
              "Licence vs assignment vs acquisition",
              "Compensation, royalties and revenue sharing",
              "Source, designs, documentation and physical transfer",
              "Confidentiality and restricted-access handling",
              "Attribution and whether creators can continue related work",
            ].map((i) => (
              <li key={i} className="flex gap-2"><span className="text-brand-600">•</span>{i}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Demo founders */}
      <div className="mx-auto mt-12 w-full max-w-6xl px-4 sm:px-6">
        <h2 className="display-title text-2xl">Two founder journeys</h2>
        <p className="mt-2 max-w-2xl text-[14px] text-ink-soft">
          Fictional walkthroughs of the founder-with-resources and founder-with-idea pathways.
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {startupDemos.map((d) => <DemoCard key={d.id} demo={d} />)}
        </div>
      </div>
    </div>
  );
}

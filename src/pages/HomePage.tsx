import { Link } from "react-router-dom";
import {
  ArrowRight,
  Compass,
  ClipboardCheck,
  FlaskConical,
  BadgeCheck,
  GraduationCap,
  Building2,
  HandHeart,
  ShieldCheck,
  FileCheck,
} from "lucide-react";
import { ButtonLink } from "../components/ui";
import { LogoMark } from "../components/Logo";
import { CheckList, NotYetList } from "../components/CheckLists";

export default function HomePage() {
  return (
    <div>
      {/* ------------------------------- Hero ---------------------------- */}
      <section className="relative overflow-hidden border-b border-line bg-surface">
        <div className="container-xl grid gap-10 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[12px] font-semibold text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              An early-stage platform — currently in development
            </span>
            <h1 className="display-title mt-5 text-[34px] leading-[1.1] sm:text-5xl">
              Real Problems. Proven Skills.{" "}
              <span className="text-brand-600">Real Opportunities.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[15.5px] leading-relaxed text-ink-soft">
              BuildProof connects problem discovery, evidence-based validation and practical
              project work — so what you build is backed by verifiable evidence, not
              self-reported claims.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink to="/signup" size="lg">
                Get started <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink to="/how-it-works" variant="secondary" size="lg">
                See how it works
              </ButtonLink>
            </div>
            <p className="mt-4 text-[12px] text-ink-soft">
              Free to use during the first cohort phase. No guaranteed placements, income or
              employment — opportunities grow out of evidence you produce.
            </p>
          </div>

          {/* Journey visual */}
          <div className="relative">
            <img
              src="/journey.svg"
              alt="The BuildProof journey: real problem, validation, practical test, evidence, opportunity"
              className="w-full"
              loading="eager"
            />
          </div>
        </div>
      </section>

      {/* --------------------------- How it flows ------------------------ */}
      <section className="border-b border-line bg-canvas py-16">
        <div className="container-xl">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brand-600">The process</p>
          <h2 className="display-title mt-2 max-w-2xl text-3xl">
            Evidence is the product — every stage leaves a trace.
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {[
              {
                icon: <Compass className="h-5 w-5" />,
                title: "1 · Real problem",
                body: "Problems are submitted and screened — never auto-approved.",
              },
              {
                icon: <ClipboardCheck className="h-5 w-5" />,
                title: "2 · Validate",
                body: "Genuine, consented interviews. Suggested gate: 8 per team. Stopping a weak idea is legitimate.",
              },
              {
                icon: <FlaskConical className="h-5 w-5" />,
                title: "3 · Feasibility",
                body: "Cost, time, access, risks — an honest structured review, not a promise.",
              },
              {
                icon: <BadgeCheck className="h-5 w-5" />,
                title: "4 · Evidence",
                body: "Interviews, tests and files reviewed by authorised people. Verification tiers, not vibes.",
              },
              {
                icon: <GraduationCap className="h-5 w-5" />,
                title: "5 · Opportunity",
                body: "Approved Proof Cards show what was actually demonstrated.",
              },
            ].map((s) => (
              <div key={s.title} className="rounded-card border border-line bg-surface p-5 shadow-card">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                  {s.icon}
                </div>
                <h3 className="display-title mt-3 text-[15px]">{s.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------- Sample Proof Card -------------------- */}
      <section className="border-b border-line bg-surface py-16">
        <div className="container-xl grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brand-600">Proof Cards</p>
            <h2 className="display-title mt-2 text-3xl">Show what you actually did — with the evidence attached.</h2>
            <p className="mt-4 max-w-lg text-[14.5px] leading-relaxed text-ink-soft">
              A Proof Card summarises a project for problem discovery, validation and testing.
              Cards carry a verification tier, review notes and explicit limitations — so readers
              can tell the difference between self-reported claims and independently reviewed work.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink to="/proof-cards" variant="secondary">Browse published Proof Cards</ButtonLink>
            </div>
          </div>

          {/* Sample card — clearly labelled illustrative */}
          <figure className="relative">
            <figcaption className="mb-2 flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-wide text-accent-700">
              <ShieldCheck className="h-4 w-4" />
              Illustrative example — not a real or verified achievement
            </figcaption>
            <div className="rounded-card border border-line bg-canvas p-5 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <LogoMark className="h-9 w-9" />
                  <div>
                    <p className="text-[14px] font-bold leading-tight">Canteen waste prediction — validation study</p>
                    <p className="text-[11.5px] text-ink-soft">TEAM ALPHA-B · CHENNAI (SAMPLE)</p>
                  </div>
                </div>
                <span className="rounded-full bg-brand-100 px-2.5 py-1 text-[11px] font-bold text-brand-700">TIER 2</span>
              </div>
              <dl className="mt-4 space-y-2.5 text-[12.5px]">
                <Row k="Problem" v="College canteens cannot predict demand; surplus food is wasted nightly." />
                <Row k="Validation" v="9/8 suggested interviews completed with consented adult food-service staff and students; 78% report over-preparation on low-attendance days." />
                <Row k="What was tested" v="A paper demand-planning sheet trialled over one week with one canteen (sample data)." />
                <Row k="Results & limits" v="Sheet reduced prep by ~30% on 3 of 5 days (sample data). Not statistically conclusive; small sample." />
                <Row k="Skills shown" v="Consent-based interviewing · pattern analysis · structured decision-making" />
              </dl>
              <p className="mt-3 border-t border-line pt-3 text-[11px] text-ink-soft">
                Example content only. Sample Proof Cards are produced for demonstration and are
                never published as genuine verified achievements.
              </p>
            </div>
          </figure>
        </div>
      </section>

      {/* --------------------------- Audience sections -------------------- */}
      <section className="border-b border-line bg-canvas py-16">
        <div className="container-xl">
          <h2 className="display-title text-3xl">Who it's for</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Audience
              icon={<GraduationCap className="h-5 w-5" />}
              to="/for-students"
              title="Students & early builders"
              body="Turn real problems into evidence-backed skill records you can present to employers."
            />
            <Audience
              icon={<Building2 className="h-5 w-5" />}
              to="/for-problem-owners"
              title="Problem owners"
              body="Businesses, NGOs and startups submit real problems and see evidence-backed progress — not pitches."
            />
            <Audience
              icon={<HandHeart className="h-5 w-5" />}
              to="/for-colleges"
              title="Colleges"
              body="Run cohorts where student work is validated through a structured, reviewable process."
            />
            <Audience
              icon={<FileCheck className="h-5 w-5" />}
              to="/for-mentors"
              title="Mentors"
              body="Review assigned work, give feedback grounded in evidence, and see the project's full history."
            />
          </div>
        </div>
      </section>

      {/* --------------------------- Honest state ------------------------- */}
      <section className="border-b border-line bg-surface py-14">
        <div className="container-xl grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brand-600">What this is — and isn't</p>
            <h2 className="display-title mt-2 text-2xl">Honest about today, built for what's next.</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <CheckList />
            <NotYetList />
          </div>
        </div>
      </section>

      {/* --------------------------- CTA ---------------------------------- */}
      <section className="bg-canvas py-16">
        <div className="container-xl flex flex-col items-center gap-5 text-center">
          <h2 className="display-title max-w-xl text-3xl">
            Start with a problem you can actually see.
          </h2>
          <p className="max-w-lg text-[14.5px] text-ink-soft">
            Sign up, browse screened problems, or submit one you've observed. Evidence does the rest.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <ButtonLink to="/signup" size="lg">Create your account</ButtonLink>
            <ButtonLink to="/submit-problem" variant="secondary" size="lg">Submit a problem</ButtonLink>
          </div>
          <p className="text-[12px] text-ink-soft">
            Questions? <Link className="font-semibold text-brand-700 hover:underline" to="/terms#contact">Contact & reporting</Link>
          </p>
        </div>
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[92px_1fr] gap-2">
      <dt className="font-bold text-ink">{k}</dt>
      <dd className="text-ink-soft">{v}</dd>
    </div>
  );
}

function Audience({ icon, title, body, to }: { icon: React.ReactNode; title: string; body: string; to: string }) {
  return (
    <Link
      to={to}
      className="group rounded-card border border-line bg-surface p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-brand-700">{icon}</div>
      <h3 className="display-title mt-3 text-[15px]">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{body}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-700">
        Learn more <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

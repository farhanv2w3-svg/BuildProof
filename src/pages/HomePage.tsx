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
  LayoutDashboard,
  CalendarDays,
  Award,
  Briefcase,
  Bell,
} from "lucide-react";
import { ButtonLink } from "../components/ui";
import { LogoMark } from "../components/Logo";
import { CheckList, NotYetList } from "../components/CheckLists";

export default function HomePage() {
  return (
    <div>
      {/* ------------------------------- Hero ---------------------------- */}
      <section className="relative overflow-hidden border-b border-line bg-surface">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] lg:block"
          style={{
            background:
              "radial-gradient(56rem 30rem ellipse at 100% 0%, #DDF2E8 0%, rgba(221,242,232,0) 62%)",
          }}
        />
        <div className="container-xl relative grid gap-10 pb-16 pt-14 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[12px] font-semibold text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              An early-stage platform — currently in development
            </span>
            <h1 className="display-title mt-5 text-[38px] leading-[1.06] sm:text-5xl lg:text-[60px]">
              Real Problems. Proven Skills.{" "}
              <span className="text-brand-600">Real Opportunities.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[15.5px] leading-relaxed text-ink-soft sm:text-[16.5px]">
              BuildProof connects problem discovery, evidence-based validation and practical
              project work — so what you build is backed by verifiable evidence, not
              self-reported claims.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink to="/problems" size="lg">
                Explore problems <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink to="/submit-problem" variant="secondary" size="lg">
                Submit a problem
              </ButtonLink>
              <ButtonLink to="/opportunities" variant="secondary" size="lg">
                Explore opportunities
              </ButtonLink>
            </div>
            <p className="mt-4 text-[12px] text-ink-soft">
              Free to use during the first cohort phase. No guaranteed placements, income or
              employment — opportunities grow out of evidence you produce.
            </p>
          </div>

          {/* Hero visual — proof-trail illustration + actual product UI preview */}
          <div className="lg:pb-4 lg:pl-2">
            <img
              src="/hero-illustration.svg"
              alt="The BuildProof journey: real problem, validation, practical test, evidence, opportunity"
              className="w-full rounded-[24px] border border-line shadow-hero"
              loading="eager"
            />
            <div className="relative z-10 mx-auto -mt-16 w-[94%] rounded-2xl border border-line bg-surface p-4 shadow-hero sm:-mt-24 sm:w-[88%] lg:-ml-6 lg:-mt-28">
              <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-2.5 py-1 text-[11.5px] font-semibold text-brand-700">
                  BuildProof workspace
                </span>
                <span className="relative rounded-lg border border-line p-1.5 text-ink-soft">
                  <Bell className="h-4 w-4" />
                  <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-lime-400 ring-2 ring-surface" />
                </span>
              </div>
              <nav aria-label="Product preview" className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-3">
                <PreviewLink active icon={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" />
                <PreviewLink icon={<Compass className="h-4 w-4" />} label="Problems" />
                <PreviewLink icon={<CalendarDays className="h-4 w-4" />} label="Events" />
                <PreviewLink icon={<Award className="h-4 w-4" />} label="My Proof" />
                <PreviewLink icon={<Briefcase className="h-4 w-4" />} label="Opportunities" />
              </nav>
              <p className="mt-3 border-t border-line pt-2.5 text-center text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-soft">
                Actual workspace navigation — view only
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------- How it flows ------------------------ */}
      <section className="border-b border-line bg-canvas py-16 sm:py-20">
        <div className="container-xl">
          <p className="kicker">The process</p>
          <h2 className="display-title mt-2 max-w-2xl text-3xl sm:text-[32px]">
            Evidence is the product — every stage leaves a trace.
          </h2>
          <div className="relative mt-12">
            {/* Proof-trail connector (desktop) */}
            <div
              aria-hidden
              className="absolute left-[10%] right-[10%] top-5 hidden border-t-2 border-dashed border-brand-300 lg:block"
            />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
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
                <div
                  key={s.title}
                  className="group relative rounded-card border border-line bg-surface p-5 shadow-card transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift"
                >
                  <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-brand-200 bg-brand-100 text-brand-700 transition-colors duration-200 group-hover:border-brand-400 group-hover:bg-brand-500 group-hover:text-white">
                    {s.icon}
                  </div>
                  <h3 className="display-title mt-3 text-[15px]">{s.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 grid gap-3 text-[13px] text-ink-soft sm:grid-cols-3">
            {[
              { t: "Discover", to: "/problems", d: "Real problems from companies, individuals, small businesses and NGOs." },
              { t: "Build with teams", to: "/how-it-works", d: "Form a team around the problem, validate, then build and test." },
              { t: "Continue", to: "/opportunities", d: "Paid work, startup pathways, hardware funding and career opportunities." },
            ].map((c) => (
              <Link key={c.to} to={c.to} className="rounded-card border border-line bg-surface p-4 transition-[border-color,background-color] duration-200 hover:border-brand-400 hover:bg-brand-50/60">
                <span className="font-semibold text-ink">{c.t}</span>
                <span className="mt-1 block text-[12.5px]">{c.d}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------- Platform domains -------------------- */}
      <section className="border-b border-line bg-surface py-16 sm:py-20">
        <div className="container-xl">
          <p className="kicker">One platform, separate domains</p>
          <h2 className="display-title mt-2 max-w-2xl text-3xl sm:text-[32px]">Different projects follow different pathways.</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { to: "/company-projects", title: "Company Projects", body: "Paid, real-world work with agreed deliverables, acceptance criteria and payment milestones recorded in the app." },
              { to: "/solutions", title: "Solutions Marketplace", body: "Work that already exists — prototypes with evidence, honest limitations and creator-held ownership." },
              { to: "/startups-funding", title: "Startups & Funding", body: "Founder pathways, structured solution transfers and real funding programmes — never invented ones." },
              { to: "/hardware", title: "Hardware Innovation", body: "A 12-stage engineering pathway from concept to manufacturing, with safety evidence at every step." },
              { to: "/opportunities", title: "Opportunities", body: "Internships, entry-level roles and founding-team opportunities matched by evidence, not scores." },
              { to: "/proof-cards", title: "Proof Cards", body: "Individual contribution and outcome records reviewed by the right people — project results and your performance stay separate." },
            ].map((d) => (
              <Link key={d.to} to={d.to} className="group relative overflow-hidden rounded-card border border-line bg-canvas p-5 shadow-card transition-[border-color,box-shadow] duration-200 hover:border-brand-400 hover:shadow-lift">
                <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-600 via-brand-500 to-lime-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                <h3 className="display-title text-[16px] group-hover:text-brand-700">{d.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{d.body}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-700">Open <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------- Sample Proof Card -------------------- */}
      <section className="border-b border-line bg-canvas py-16 sm:py-20">
        <div className="container-xl grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <p className="kicker">Proof Cards</p>
            <h2 className="display-title mt-2 text-3xl sm:text-[32px]">Show what you actually did — with the evidence attached.</h2>
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
            <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
              <div className="flex items-center justify-between gap-3 border-b border-line bg-brand-50 px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <LogoMark className="h-9 w-9" />
                  <div>
                    <p className="text-[14px] font-bold leading-tight">Canteen waste prediction — validation study</p>
                    <p className="text-[11.5px] text-ink-soft">TEAM ALPHA-B · CHENNAI (SAMPLE)</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap bg-brand-100 px-2.5 py-1.5 text-[11px] font-bold text-brand-700" style={{ borderRadius: "10px" }}>TIER 2</span>
              </div>
              <dl className="space-y-2.5 px-5 py-4 text-[12.5px]">
                <Row k="Problem" v="College canteens cannot predict demand; surplus food is wasted nightly." />
                <Row k="Validation" v="9/8 suggested interviews completed with consented adult food-service staff and students; 78% report over-preparation on low-attendance days." />
                <Row k="What was tested" v="A paper demand-planning sheet trialled over one week with one canteen (sample data)." />
                <Row k="Results & limits" v="Sheet reduced prep by ~30% on 3 of 5 days (sample data). Not statistically conclusive; small sample." />
                <Row k="Skills shown" v="Consent-based interviewing · pattern analysis · structured decision-making" />
              </dl>
              <p className="border-t border-line bg-canvas px-5 py-3 text-[11px] text-ink-soft">
                Example content only. Sample Proof Cards are produced for demonstration and are
                never published as genuine verified achievements.
              </p>
            </div>
          </figure>
        </div>
      </section>

      {/* --------------------------- Audience sections -------------------- */}
      <section className="border-b border-line bg-surface py-16 sm:py-20">
        <div className="container-xl">
          <h2 className="display-title text-3xl sm:text-[32px]">Who it's for</h2>
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
      <section className="border-b border-line bg-canvas py-14">
        <div className="container-xl grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="kicker">What this is — and isn't</p>
            <h2 className="display-title mt-2 text-2xl sm:text-[28px]">Honest about today, built for what's next.</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <CheckList />
            <NotYetList />
          </div>
        </div>
      </section>

      {/* --------------------------- CTA ---------------------------------- */}
      <section className="relative overflow-hidden bg-surface py-16 sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, #159875, transparent)" }}
        />
        <div className="container-xl flex flex-col items-center gap-5 text-center">
          <h2 className="display-title max-w-xl text-3xl sm:text-[32px]">
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

/* Hero preview helper — visual only, not navigable (marked "view only"). */
function PreviewLink({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <span
      aria-hidden
      className={
        active
          ? "flex items-center gap-2 rounded-lg bg-brand-700 px-3 py-2 text-[13px] font-semibold text-white"
          : "flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-ink-soft"
      }
    >
      {icon} {label}
    </span>
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

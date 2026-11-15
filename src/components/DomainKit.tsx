import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "../lib/utils";
import { Badge, Card } from "./ui";
import type { DemoRecord } from "../lib/demoData";

/* ------------------------------------------------------------------ */
/*  Shared vocabulary for the 0003 platform-domain pages.              */
/* ------------------------------------------------------------------ */

/**
 * Marks content that is NOT a live database record. Every fictional entity,
 * person, company, payment, review or outcome on the platform must render
 * inside (or beside) this badge so demos can never be mistaken for real
 * activity (product principle 8 + §18).
 */
export function DemoBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-300/70 bg-amber-50 font-semibold text-amber-800",
        compact ? "px-1.5 py-0.5 text-[10.5px]" : "px-2 py-0.5 text-[11px]"
      )}
      title="Demo — fictional example. Not real platform activity."
    >
      <AlertTriangle className="h-3 w-3" aria-hidden />
      Demo — fictional example
    </span>
  );
}

/** Wrap any fictional content so the label is visually inseparable from it. */
export function DemoBlock({
  compact = false,
  children,
  className,
}: {
  compact?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-card border border-amber-200 bg-surface p-4 pr-3 shadow-card",
        compact && "p-3",
        className
      )}
    >
      <div className="mb-2 flex">
        <DemoBadge compact={compact} />
      </div>
      {children}
    </div>
  );
}

const statusTones: Record<string, "neutral" | "brand" | "success" | "warn" | "danger" | "info"> = {
  /* problems */
  submitted: "neutral", screening: "info", approved: "success", rejected: "danger", needs_info: "warn",
  /* teams / applicants */
  pending: "warn",
  proposed: "warn", active: "success", left: "neutral", removed: "danger",
  forming: "info", paused: "warn", stopped: "danger", completed: "success",
  /* planning */
  todo: "neutral", in_progress: "info", review: "warn", done: "success", late: "danger",
  /* company projects & payments */
  draft: "neutral", listed: "brand", in_review: "info", closed: "neutral",
  agreed: "neutral", due: "warn", paid: "success", disputed: "danger", cancelled: "neutral",
  /* solutions & agreements */
  private: "neutral", restricted: "info", prototype: "info", tested: "success", pilot: "brand",
  commercially_in_use: "success", new: "info", in_contact: "warn",
  under_discussion: "warn", executed: "success",
  /* funding / jobs */
  open: "success", verified: "success", unverified: "neutral", declined: "danger",
  interviewing: "info", under_review: "warn",
  /* reviews */
  assigned: "info", inconclusive: "neutral",
  needs_revision: "warn", actioned: "success", dismissed: "neutral", reviewed: "info",
};

const statusLabels: Record<string, string> = {
  in_progress: "In progress", in_review: "In review", todo: "To do",
  commission: "Commission", granted: "Approved", commercially_in_use: "Commercially in use",
  seek_adopters: "Seeking adopters", license_available: "Licensing available",
  acquisition_discussions: "Acquisition discussions", entry_level: "Entry level",
  founding_team: "Founding team", project_contract: "Project contract", hardware_role: "Hardware role",
  near_complete: "Near complete", production_candidate: "Production candidate", student_owned: "Student-owned",
  startup_potential: "Startup potential", small_business: "Small business",
  under_discussion: "Under discussion", grant_competition: "Grant / competition",
  prototype_funding: "Prototype funding", hardware_funding: "Hardware funding", startup_capital: "Startup capital",
  manufacturing_support: "Manufacturing support", sponsored_research: "Sponsored research",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = (statusTones[status] as (typeof statusTones)[string]) ?? "neutral";
  return (
    <Badge tone={tone} className={className}>
      {statusLabels[status] ?? startCase(status)}
    </Badge>
  );
}

function startCase(s: string) {
  return s
    .split("_")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** 9.9 — unit contract: payment milestone AMOUNTS are stored in PAISE (the
 * database column and API keep paise — see payment_milestones.amount). This
 * formatter takes paise and renders rupees. Anything rupee-denominated
 * (budget notes, funding ranges via moneyRange) must NOT pass through here —
 * mixing the two units is how the audit's potential 100x display error starts. */
export function money(paise: number | null | undefined, currency = "INR") {
  if (paise == null) return "—";
  const rupees = paise / 100;
  const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : `${currency} `;
  return `${symbol}${new Intl.NumberFormat("en-IN").format(rupees)}`;
}

/** Human-readable rupee label for min–max ranges (amounts in rupees). */
export function moneyRange(min: number | null, max: number | null, currency = "INR") {
  const fmt = (v: number) => `${currency === "INR" ? "₹" : currency + " "}${new Intl.NumberFormat("en-IN").format(v)}`;
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`;
  if (min != null) return `from ${fmt(min)}`;
  if (max != null) return `up to ${fmt(max)}`;
  return "—";
}

export function SkillChips({ skills, className }: { skills: string[]; className?: string }) {
  if (!skills?.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {skills.map((s) => (
        <span key={s} className="rounded-md bg-brand-50 px-2 py-0.5 text-[11.5px] font-medium text-brand-700">
          {s}
        </span>
      ))}
    </div>
  );
}

/** Standard hero for public domain listing pages. */
export function DomainHero({
  kicker,
  title,
  intro,
  actions,
}: {
  kicker: string;
  title: string;
  intro: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full px-4 pt-14 sm:px-6" style={{ maxWidth: "78rem" }}>
      <p className="kicker">{kicker}</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="display-title text-3xl sm:text-4xl">{title}</h1>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-ink-soft">{intro}</p>
    </div>
  );
}

export function DomainGrid({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid w-full gap-4 px-4 py-10 sm:px-6 lg:grid-cols-3" style={{ maxWidth: "78rem" }}>
      {children}
    </div>
  );
}

export function filterCls(active: boolean) {
  return cn(
    "rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition-[background-color,border-color,color] duration-200",
    active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line bg-surface text-ink-soft hover:border-brand-300 hover:text-ink"
  );
}

/** What a record itself must always confirm honestly: verified ≠ trustworthy. */
export function VerificationNote({ status }: { status: string }) {
  if (status === "verified")
    return <Badge tone="success">Verified</Badge>;
  return (
    <Badge tone="neutral">
      Unverified — not independently checked yet
    </Badge>
  );
}

/* --------------------------- demo rendering ------------------------ */

/** Renders a fictional DemoRecord with its badge, facts and skills. */
export function DemoCard({ demo, compact = false, children }: { demo: DemoRecord; compact?: boolean; children?: ReactNode }) {
  return (
    <DemoBlock compact={compact}>
      <div className="flex items-start justify-between gap-3">
        <h3 className={cn("font-bold text-ink", compact ? "text-[14px]" : "text-[15px]")}>{demo.title}</h3>
        <span className="shrink-0 text-[11px] font-semibold text-amber-800" title="Demo number from the product walkthrough">
          #{demo.demoNo}
        </span>
      </div>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{demo.summary}</p>
      {demo.skills && <SkillChips skills={demo.skills} className="mt-2" />}
      {!compact && demo.details && (
        <dl className="mt-3 space-y-1.5">
          {demo.details.map((d) => (
            <div key={d.label} className="grid grid-cols-[130px_1fr] gap-2 text-[12.5px]">
              <dt className="font-semibold text-ink">{d.label}</dt>
              <dd className="text-ink-soft">{d.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {demo.status && <StatusBadge status={demo.status} className="mt-3" />}
      {children}
    </DemoBlock>
  );
}

/** Composite card for real database records on public pages. */
export function ListingCard({
  title,
  badges,
  skills,
  children,
  footer,
}: {
  title: ReactNode;
  badges?: ReactNode;
  skills?: string[];
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-bold leading-snug text-ink">{title}</h3>
        {badges}
      </div>
      {skills && <SkillChips skills={skills} className="mt-2" />}
      <div className="mt-2 flex-1 text-[13.5px] leading-relaxed text-ink-soft">{children}</div>
      {footer && <div className="mt-4 border-t border-line pt-3">{footer}</div>}
    </Card>
  );
}

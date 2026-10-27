import { CheckCircle2, MinusCircle } from "lucide-react";

const alive = [
  "Real Supabase authentication with email confirmation",
  "Role-based access enforced in the database (RLS)",
  "Problem submissions with human screening — nothing auto-approves",
  "Cohort & team workspaces with private evidence storage",
  "Interview logs, feasibility reviews and test records",
  "Proof Cards with verification tiers set only by authorised reviewers",
];

const notYet = [
  "No payments, escrow or paid-project marketplace (planned later, honestly scoped)",
  "No automatic job placement or guaranteed internships — ever",
  "No verified institutions, mentors or clients yet — everything new starts un-reviewed",
  "No AI features or automated evaluation — people review evidence",
  "Email notifications require a configured email provider — in-app notifications only for now",
  "Dark theme is not offered yet; light theme is the single supported design",
];

function List({ items, icon, tone }: { items: string[]; icon: React.ReactNode; tone: string }) {
  return (
    <ul className="rounded-card border border-line bg-canvas p-5">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-2 py-1.5 text-[13px] text-ink-soft">
          <span className={tone}>{icon}</span>
          {t}
        </li>
      ))}
    </ul>
  );
}

export function CheckList() {
  return <List items={alive} icon={<CheckCircle2 className="mt-0.5 h-4 w-4" />} tone="text-brand-600" />;
}

export function NotYetList() {
  return <List items={notYet} icon={<MinusCircle className="mt-0.5 h-4 w-4" />} tone="text-ink-soft/70" />;
}

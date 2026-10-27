import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Compass, ShieldQuestion } from "lucide-react";
import { listProblems, addScreening, updateProblemStatus, sendNotification, writeAuditLog, fetchScreenings } from "../../lib/api";
import { Badge, Button, Card, Field, Input, PageTitle, Select, Textarea, ButtonLink, EmptyState, LoadingBlock } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { isPlatformAdmin } from "../../lib/rbac";
import { titleize } from "../../lib/utils";
import type { Problem } from "../../types/database";

export const CATEGORY_LABELS: Record<string, string> = {
  education: "Education",
  local_business: "Local business",
  accessibility: "Accessibility",
  sustainability: "Sustainability",
  public_services: "Public services",
  operations: "Operations",
  technology: "Technology",
  other: "Other",
};

export default function ProblemsPage() {
  const { user, roles } = useAuth();
  const { data: problems, isLoading } = useQuery({
    queryKey: ["problems", user?.id],
    queryFn: listProblems,
    enabled: !!user,
  });
  const [filter, setFilter] = useState<"approved" | "all">("approved");
  const isAdmin = isPlatformAdmin(roles);

  const visible = useMemo(() => {
    const list = problems ?? [];
    return filter === "approved" ? list.filter((p) => p.status === "approved") : list;
  }, [problems, filter]);

  if (isLoading) return <LoadingBlock />;

  return (
    <div>
      <PageTitle
        title="Problem discovery"
        sub="Real-world problems, screened by reviewers. Teams pick one of these to validate — or submit their own."
        action={<ButtonLink to="/submit-problem" size="sm">Submit a problem</ButtonLink>}
      />

      <div className="mb-4 flex gap-2">
        {(["approved", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              filter === f
                ? "rounded-lg border border-brand-600 bg-brand-50 px-3 py-1.5 text-[13px] font-semibold text-brand-700"
                : "rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-ink-soft hover:text-ink"
            }
          >
            {f === "approved" ? "Approved problems" : isAdmin ? "All (admin)" : "My submissions"}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Compass className="h-6 w-6" />}
          title={filter === "approved" ? "No approved problems yet" : "Nothing here yet"}
          description={
            filter === "approved"
              ? "Approved problems will appear here once reviewers screen submissions."
              : "Submit a real-world problem you've noticed. It will be screened before it's approved for teams."
          }
          action={<ButtonLink to="/submit-problem" variant="secondary" size="sm">Submit a problem</ButtonLink>}
        />
      ) : (
        <div className="grid gap-3">
          {visible.map((p) => (
            <ProblemRow key={p.id} problem={p} userId={user!.id} showAdmin={isAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProblemRow({
  problem: p,
  userId,
  showAdmin,
}: {
  problem: Problem;
  userId: string;
  showAdmin: boolean;
}) {
  const mine = p.submitted_by === userId;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{CATEGORY_LABELS[p.category] ?? titleize(p.category)}</Badge>
            <StatusBadge status={p.status} />
            {p.is_public && <Badge tone="accent">Public listing</Badge>}
          </div>
          <h3 className="display-title mt-2 text-[16px] font-bold">{titleize(p.title)}</h3>
          <p className="mt-1 line-clamp-2 text-[13.5px] text-ink-soft">{p.description}</p>
          <p className="mt-2 text-[12px] text-ink-soft">
            Affected: {p.affected_users}
            {p.location ? ` · Location: ${p.location}` : ""}
            {mine ? " · Submitted by you" : ""}
          </p>
        </div>
      </div>
      {showAdmin && (
        <details className="mt-3 rounded-lg border border-line bg-canvas px-3 py-2">
          <summary className="cursor-pointer text-[12.5px] font-semibold text-ink-soft">
            Admin screening
          </summary>
          <div className="pt-2">
            <ScreenPanel problem={p} />
          </div>
        </details>
      )}
    </Card>
  );
}

export function StatusBadge({ status }: { status: Problem["status"] }) {
  const tone =
    status === "approved" ? "success" : status === "rejected" ? "danger" : status === "needs_info" ? "warn" : "neutral";
  return <Badge tone={tone}>{titleize(status === "needs_info" ? "needs info" : status)}</Badge>;
}

function ScreenPanel({ problem }: { problem: Problem }) {
  const [decision, setDecision] = useState<"approved" | "needs_info" | "rejected" | "">("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { user } = useAuth();

  const { data: screenings } = useQuery({
    queryKey: ["screenings", problem.id],
    queryFn: () => fetchScreenings(problem.id),
  });

  const submit = async () => {
    if (!decision || !user) return;
    setBusy(true);
    setError(null);
    try {
      await addScreening(problem.id, user.id, { decision, notes: notes.trim() || null });
      await updateProblemStatus(problem.id, decision);
      if (problem.submitted_by) {
        await sendNotification({
          user_id: problem.submitted_by,
          type: "problem_reviewed",
          title: `Your problem "${problem.title}" was screened`,
          body: `Decision: ${decision.replace("_", " ")}. ${notes.trim() || ""}`.trim(),
          link: "/app/problems",
        });
      }
      await writeAuditLog(user.id, "problem.screened", "problem", problem.id, { decision });
      setDone("Screening recorded. RLS keeps reviewer notes visible to admins only.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record screening");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {done && <p className="text-[12.5px] font-semibold text-success">{done}</p>}
      {error && <p className="text-[12.5px] text-danger">{error}</p>}
      {(screenings ?? []).length > 0 && (
        <div>
          <p className="text-[12px] font-semibold text-ink-soft">Previous screenings</p>
          <ul className="mt-1 space-y-1 text-[12px] text-ink-soft">
            {screenings!.map((s) => (
              <li key={s.id}>
                {s.notes ? `"${s.notes}" — ` : "— "}
                {titleize(s.decision)}, {new Date(s.created_at).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Decision" required>
          <Select value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)}>
            <option value="">Choose…</option>
            <option value="approved">Approve for teams</option>
            <option value="needs_info">Request more info</option>
            <option value="rejected">Reject</option>
          </Select>
        </Field>
        <Field label="Notes (shared with submitter)">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional reviewer note" />
        </Field>
      </div>
      <div>
        <Field label="Internal reminder">
          <Textarea disabled rows={2} className="opacity-60" placeholder="Detailed internal notes live here in a later iteration — reviewer notes tied to your account today." />
        </Field>
      </div>
      <Button onClick={submit} loading={busy} disabled={!decision}>
        Record screening
      </Button>
      {decision === "rejected" && notes.trim() === "" && (
        <p className="flex items-center gap-1.5 text-[12px] text-warn">
          <ShieldQuestion className="h-3.5 w-3.5" /> Add a short note so the submitter understands the rejection.
        </p>
      )}
    </div>
  );
}

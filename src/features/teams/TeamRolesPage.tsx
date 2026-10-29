import { useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listRoleRequirements, listTeamApplications, setRoleRequirements, decideTeamApplication } from "../../lib/api";
import type { TeamApplication, TeamRoleRequirement } from "../../types/database";
import { Button, Card, ErrorBanner, Field, Input, LoadingBlock } from "../../components/ui";
import { StatusBadge } from "../../components/DomainKit";
import { demoMultidisciplinaryTeam } from "../../lib/demoData";
import { DemoCard } from "../../components/DomainKit";
import { useAuth } from "../../lib/auth";

type Ctx = { team: { id: string; status: string } };

export default function TeamRolesPage() {
  const { teamId } = useParams();
  const { team } = useOutletContext<Ctx>();
  const { user } = useAuth();

  const { data: requirements, isLoading, refetch } = useQuery({
    queryKey: ["roleRequirements", teamId],
    queryFn: () => listRoleRequirements(teamId!),
    enabled: !!teamId,
  });
  const { data: applications, refetch: refetchApps } = useQuery({
    queryKey: ["teamApplications", teamId],
    queryFn: () => listTeamApplications(teamId!),
    enabled: !!teamId,
  });

  const [draft, setDraft] = useState<{ skill: string; seats: string; note: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  if (isLoading) return <LoadingBlock />;

  const reqs = (requirements ?? []) as TeamRoleRequirement[];

  const startEditing = () =>    setDraft(reqs.map((r) => ({ skill: r.skill, seats: String(r.filled_seats + r.seats), note: r.note ?? "" })));

  const totalOpen = reqs.reduce((n, r) => n + Math.max(0, r.seats), 0);
  const totalFilled = reqs.reduce((n, r) => n + r.filled_seats, 0);
  void user;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5">
        <h2 className="text-[15px] font-bold text-ink">Role requirements</h2>
        <p className="mt-0.5 text-[12.5px] text-ink-soft">
          Teams do not need every skill. Publish exactly what this problem needs, with seats and expectations.
        </p>
        <p className="mt-2 text-[12.5px] text-ink-soft">
          Current: <span className="font-semibold text-ink">{totalFilled} filled</span> of {totalFilled + totalOpen} planned seats across {reqs.length} role{reqs.length === 1 ? "" : "s"}.
        </p>

        {reqs.length > 0 && draft.length === 0 && (
          <ul className="mt-3 space-y-2">
            {reqs.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-2 rounded-lg border border-line p-3">
                <div>
                  <p className="text-[13.5px] font-semibold text-ink">{r.skill}</p>
                  {r.note && <p className="text-[12px] text-ink-soft">{r.note}</p>}
                </div>
                <span className="shrink-0 text-[12px] font-semibold text-ink-soft" title={`${r.filled_seats} accepted, ${r.seats} still open`}>
                  {r.filled_seats} accepted · {r.seats} open seat{r.seats === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}

        {draft.length > 0 && (
          <div className="mt-3 space-y-3">
            {draft.map((d, i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-[1fr_100px]">
                <Field label={`Role ${i + 1} — skill`}>
                  <Input value={d.skill} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, skill: e.target.value } : x)))} minLength={2} maxLength={80} />
                </Field>
                <Field label="Planned seats">
                  <Input type="number" min={1} max={20} value={d.seats} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, seats: e.target.value } : x)))} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="What this role owns (optional)">
                    <Input value={d.note} maxLength={300} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} placeholder="e.g. Owns the dashboard UI and its tests" />
                  </Field>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                loading={busy}
                onClick={async () => {
                  setBusy(true); setError(null); setSavedMsg(null);
                  try {
                    const rows = draft
                      .filter((d) => d.skill.trim().length >= 2)
                      .map((d) => ({
                        skill: d.skill.trim(),
                        seats: Math.max(1, Math.min(20, Number(d.seats) || 1)),
                        note: d.note.trim() || undefined,
                      }));
                    await setRoleRequirements(team!.id, rows);
                    setDraft([]); setSavedMsg("Role requirements saved.");
                    await refetch();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Could not save requirements.");
                  } finally { setBusy(false); }
                }}
              >
                Save requirements
              </Button>
              <Button variant="secondary" onClick={() => setDraft([])}>Cancel</Button>
              <Button variant="ghost" onClick={() => setDraft([...draft, { skill: "", seats: "1", note: "" }])}>
                Add another role
              </Button>
            </div>
          </div>
        )}

        {draft.length === 0 && (
          <div className="mt-4"><Button size="sm" onClick={startEditing}>Edit role requirements</Button></div>
        )}

        {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
        {savedMsg && <p className="mt-3 text-[13px] text-success" role="status">{savedMsg}</p>}
      </Card>

      <Card className="p-5">
        <h2 className="text-[15px] font-bold text-ink">Applications</h2>
        <p className="mt-0.5 text-[12.5px] text-ink-soft">
          People applying to join this team. Review their proof before accepting — evidence over claims.        </p>
        {((applications ?? []) as (TeamApplication & { profile: { full_name: string } | null })[]).length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-soft">No applications yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {((applications ?? []) as (TeamApplication & { profile: { full_name: string } | null })[]).map((a) => (
              <li key={a.id} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[13.5px] font-semibold text-ink">{a.profile?.full_name ?? "Applicant"}</p>
                    <p className="text-[12px] text-ink-soft">{a.role_needed ? `Wants role: ${a.role_needed}` : "No specific role"} · {new Date(a.created_at).toLocaleDateString()}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                {a.message && <p className="mt-1 text-[12.5px] text-ink-soft">“{a.message}”</p>}
                {a.status === "pending" && (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={async () => { try { await decideTeamApplication(a.id, "accepted", user!.id); await refetchApps(); } catch (e) { setError(e instanceof Error ? e.message : "Failed."); } }}>
                      Accept
                    </Button>
                    <Button size="sm" variant="secondary" onClick={async () => { try { await decideTeamApplication(a.id, "rejected", user!.id); await refetchApps(); } catch (e) { setError(e instanceof Error ? e.message : "Failed."); } }}>
                      Decline
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 border-t border-line pt-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brand-600">How teams look in practice</p>
          <div className="mt-2">
            <DemoCard demo={demoMultidisciplinaryTeam} compact />
            <p className="mt-2 text-[11.5px] text-ink-soft">Illustrative only — real applications come from the list above.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

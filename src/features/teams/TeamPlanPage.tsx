import { useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import {
  listMilestones, listTasks, createMilestone, updateMilestone, deleteMilestone,
  createTask, updateTask, deleteTask, fetchTeamMembers,
} from "../../lib/api";
import type { ProjectMilestone, ProjectTask } from "../../types/database";
import { Badge, Button, Card, ErrorBanner, Field, Input, LoadingBlock, Select } from "../../components/ui";
import { StatusBadge } from "../../components/DomainKit";
import { useAuth } from "../../lib/auth";
import { titleize } from "../../lib/utils";

type Ctx = { team: { id: string; status: string } };

export default function TeamPlanPage() {
  const { teamId } = useParams();
  const { team } = useOutletContext<Ctx>();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: milestones, isLoading: mLoading } = useQuery({
    queryKey: ["milestones", teamId],
    queryFn: () => listMilestones(teamId!),
    enabled: !!teamId,
  });
  const { data: tasks, isLoading: tLoading } = useQuery({
    queryKey: ["tasks", teamId],
    queryFn: () => listTasks(teamId!),
    enabled: !!teamId,
  });
  const { data: members } = useQuery({
    queryKey: ["teamMembers", teamId],
    queryFn: () => fetchTeamMembers(teamId!),
    enabled: !!teamId,
  });

  const [mErr, setMErr] = useState<string | null>(null);
  const [tErr, setTErr] = useState<string | null>(null);

  if (mLoading || tLoading) return <LoadingBlock />;

  const acceptedMembers = (members ?? []).filter((m) => m.status === "accepted");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5">
        <MilestonePanel
          teamId={team.id}
          rows={(milestones ?? []) as ProjectMilestone[]}
          onError={setMErr}
        />
        {mErr && <div className="mt-3"><ErrorBanner message={mErr} /></div>}
      </Card>

      <Card className="p-5">
        <TaskPanel
          teamId={team.id}
          rows={(tasks ?? []) as (ProjectTask & { assignee_profile: ProfileRef | null })[]}
          members={acceptedMembers.map((m) => ({ id: m.user_id, label: m.profile?.full_name ?? m.user_id }))}
          myId={user?.id ?? null}
          onError={setTErr}
          onDone={() => qc.invalidateQueries({ queryKey: ["tasks", teamId] })}
        />
        {tErr && <div className="mt-3"><ErrorBanner message={tErr} /></div>}
      </Card>
    </div>
  );
}

type ProfileRef = { id: string; full_name: string; email: string | null };

function MilestonePanel({
  teamId, rows, onError,
}: { teamId: string; rows: ProjectMilestone[]; onError: (s: string) => void }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div>
      <h2 className="text-[15px] font-bold text-ink">Milestones</h2>
      <p className="mt-0.5 text-[12.5px] text-ink-soft">Agreed checkpoints with dates and deliverable notes.</p>

      {rows.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-soft">No milestones yet. Add the first checkpoint below.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((m) => (
            <li key={m.id} className="rounded-lg border border-line p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13.5px] font-semibold text-ink">{m.title}</p>
                  <p className="text-[12px] text-ink-soft">{m.due_date ? `Due ${m.due_date}` : "No due date"}{m.deliverable_note ? ` · ${m.deliverable_note}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={m.status} />
                  <select
                    aria-label={`Change milestone status for ${m.title}`}
                    className="rounded border border-line bg-surface px-1.5 py-1 text-[11.5px]"
                    value={m.status}
                    onChange={async (e) => {
                      try { await updateMilestone(m.id, { status: e.target.value as ProjectMilestone["status"] }); onError(""); }
                      catch (err) { onError(errMessage0(err)); }
                    }}
                  >
                    {["pending", "in_progress", "done", "late"].map((s) => <option key={s} value={s}>{titleize(s)}</option>)}
                  </select>
                  <ButtonGhostTrash label="Delete milestone" onClick={async () => {
                    try { await deleteMilestone(m.id); onError(""); } catch (err) { onError(errMessage0(err)); }
                  }} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-4 space-y-2 border-t border-line pt-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (title.trim().length < 3) { onError("Milestone title needs at least 3 characters."); return; }
          setBusy(true);
          try {
            await createMilestone({ team_id: teamId, title: title.trim(), due_date: due || null });
            setTitle(""); setDue("");
          } catch (err) { onError(errMessage0(err)); } finally { setBusy(false); }
        }}
      >
        <Field label="New milestone">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Working dashboard demo" required minLength={3} maxLength={160} />
        </Field>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Due date" className="w-40">
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <Button type="submit" size="sm" loading={busy}>Add milestone</Button>
        </div>
      </form>
    </div>
  );
}

/** Task board: editors manage anything; assignees progress their own tasks. */function TaskPanel({
  teamId, rows, members, myId, onError, onDone,
}: {
  teamId: string;
  rows: (ProjectTask & { assignee_profile: ProfileRef | null })[];
  members: { id: string; label: string }[];
  myId: string | null;
  onError: (s: string) => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [busy, setBusy] = useState(false);

  const fmtAssignee = (t: ProjectTask & { assignee_profile: ProfileRef | null }) =>
    t.assignee_profile?.full_name ?? (t.assignee ? t.assignee.slice(0, 8) : null);

  return (
    <div>
      <h2 className="text-[15px] font-bold text-ink">Task board</h2>
      <p className="mt-0.5 text-[12.5px] text-ink-soft">Assigned work with statuses. Assignees can move their own tasks; editors manage the board.</p>

      {rows.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-soft">No tasks yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((t) => (
            <li key={t.id} className="rounded-lg border border-line p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13.5px] font-semibold text-ink">{t.title}</p>
                  <p className="text-[12px] text-ink-soft">{fmtAssignee(t) ? `Assigned: ${fmtAssignee(t)}` : "Unassigned"}{t.notes ? ` · ${t.notes}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={t.status} />
                  <select
                    aria-label={`Change task status for ${t.title}`}
                    className="rounded border border-line bg-surface px-1.5 py-1 text-[11.5px]"
                    value={t.status}
                    onChange={async (e) => {
                      try { await updateTask(t.id, { status: e.target.value as ProjectTask["status"] }); onError(""); onDone(); }
                      catch (err) { onError(errMessage0(err)); }
                    }}
                  >
                    {["todo", "in_progress", "review", "done"].map((s) => <option key={s} value={s}>{titleize(s)}</option>)}
                  </select>
                  <ButtonGhostTrash label="Delete task" onClick={async () => {
                    try { await deleteTask(t.id); onError(""); onDone(); } catch (err) { onError(errMessage0(err)); }
                  }} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-4 space-y-2 border-t border-line pt-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (title.trim().length < 3) { onError("Task title needs at least 3 characters."); return; }
          setBusy(true);
          try {
            await createTask({ team_id: teamId, title: title.trim(), assignee: assignee || null });
            setTitle(""); setAssignee("");
            onDone();
          } catch (err) { onError(errMessage0(err)); } finally { setBusy(false); }
        }}
      >
        <Field label="New task">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Build schema for maintenance records" required minLength={3} maxLength={160} />
        </Field>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Assign to" className="w-52">
            <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </Select>
          </Field>
          <Button type="submit" size="sm" loading={busy}>Add task</Button>
        </div>
      </form>
      {myId == null && <Badge tone="neutral">Sign in required for task actions</Badge>}
    </div>
  );
}

function ButtonGhostTrash({ label, onClick }: { label: string; onClick: () => Promise<void> }) {
  return (
    <button
      aria-label={label}
      title={label}
      className="rounded p-1 text-ink-soft hover:text-danger"
      onClick={onClick}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

export function errMessage0(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Check } from "lucide-react";
import {
  fetchCohort,
  fetchCohortMembers,
  fetchCohortTeams,
  addCohortMember,
  acceptCohortMembership,
  findUserIdByEmail,
  removeCohortMember,
  updateCohortStatus,
  createTeam,
  addUserToTeam,
  listProblems,
  fetchMentorAssignments,
  assignMentor,
  setMentorAssignmentActive,
} from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Badge, Button, Card, CardHeader, EmptyState, LoadingBlock, PageTitle, Input, Select, ErrorBanner } from "../../components/ui";
import { useParams, Link, useNavigate } from "react-router-dom";
import { titleize } from "../../lib/utils";

export default function CohortPage() {
  const { cohortId } = useParams();
  const { user, roles } = useAuth();

  const { data: cohort, isLoading } = useQuery({
    queryKey: ["cohort", cohortId],
    queryFn: () => fetchCohort(cohortId!),
    enabled: !!cohortId,
  });
  const { data: members } = useQuery({
    queryKey: ["cohortMembers", cohortId],
    queryFn: () => fetchCohortMembers(cohortId!),
    enabled: !!cohortId,
  });
  const { data: teams } = useQuery({
    queryKey: ["cohortTeams", cohortId],
    queryFn: () => fetchCohortTeams(cohortId!),
    enabled: !!cohortId,
  });

  if (isLoading) return <LoadingBlock />;
  if (!cohort) {
    return (
      <EmptyState
        title="Cohort not found or not accessible"
        description="Your roles do not grant access to this cohort, or it doesn't exist."
      />
    );
  }

  const myMembership = (members ?? []).find((m) => m.user_id === user?.id);
  const isProposed = myMembership?.status === "proposed";
  const isStaff = (["institution_admin", "faculty_coordinator", "platform_admin"] as const).some((r) =>
    roles.includes(r)
  );

  return (
    <div>
      <PageTitle
        title={cohort.name}
        sub={cohort.description ?? undefined}
        action={
          <Badge tone={cohort.status === "active" ? "success" : "neutral"}>
            {titleize(cohort.status)}
          </Badge>
        }
      />

      {isProposed && <AcceptMembership membershipId={myMembership!.id} />}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Validation gate" sub={`Suggested target: ${cohort.interview_gate} consented adult interviews per team`} />
          <div className="px-5 pb-5 text-[13px] text-ink-soft">
            Each team records genuine interviews with consent confirmed for every participant.
            Teams can record fewer and still stop — stopping a weak idea is a legitimate outcome.
          </div>
        </Card>
        <CohortStatusEditor cohortId={cohort.id} status={cohort.status} />
      </div>

      <section className="mt-8">
        <CardHeader title={<span className="flex items-center gap-2"><Users className="h-4 w-4" /> Members</span>} sub="Proposed members must accept their own membership." />
        <Card>
          <MemberTable members={members ?? []} />
        </Card>
        <AddMemberForm cohortId={cohort.id} />
      </section>

      <section className="mt-8">
        <CardHeader title="Teams" sub={`${(teams ?? []).length} team(s) in this cohort`} />
        {myMembership?.status === "active" && <CreateTeamForm cohortId={cohort.id} />}        {(teams ?? []).length === 0 ? (
          <EmptyState title="No teams yet" description="Teams are created by cohort staff or students once a cohort is active." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(teams ?? []).map((t) => (
              <Card key={t.id} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display font-bold">{t.name}</p>
                  <Badge tone={t.status === "active" ? "success" : t.status === "stopped" ? "danger" : "neutral"}>
                    {teamStatusLabel(t.status)}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Link to={`/app/teams/${t.id}`} className="text-[13px] font-semibold text-brand-700 hover:underline">
                    Open workspace →
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* B3 — mentor assignment: staff assign mentors to this cohort's teams by
          email. The database insert policy ("cohort staff assign mentors") is
          the real gate; this panel is the interface that was missing. */}
      {isStaff && <MentorsPanel cohortId={cohort.id} teams={teams ?? []} />}
    </div>
  );
}

/** B1 — Team creation UI. The database (migration 0001) enforces the real
 * eligibility rules: the creator must be an active member of this cohort and
 * can only name themselves as creator. The form mirrors those rules honestly —
 * it shows for active members only, validates the name bounds (2–120 chars),
 * and offers the currently approved problems as optional starting points. */
function CreateTeamForm({ cohortId }: { cohortId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [problemId, setProblemId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: problems } = useQuery({
    queryKey: ["approvedProblems"],
    queryFn: listProblems,
    enabled: open,
    select: (rows) => rows.filter((p) => p.status === "approved"),
  });

  const create = async () => {
    setError(null);
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 120) {
      setError("Team name must be 2–120 characters.");
      return;
    }
    setBusy(true);
    try {
      const team = await createTeam({
        cohort_id: cohortId,
        name: trimmed,
        problem_id: problemId || null,
        created_by: user!.id,
      });
      // The creator joins their own team immediately (self-add is allowed by
      // the team_members insert policy when the cohort matches).
      await addUserToTeam(team.id, user!.id, "student", "accepted");
      await qc.invalidateQueries({ queryKey: ["cohortTeams", cohortId] });
      setOpen(false);
      setName("");
      setProblemId("");
      navigate(`/app/teams/${team.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Team creation failed. Ask cohort staff if this persists.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="mb-3">
        <Button size="sm" onClick={() => { setOpen(true); setError(null); }}>
          Create a team
        </Button>
      </div>
    );
  }

  return (
    <Card className="mb-4 p-4">
      <p className="text-[13px] font-semibold">Create a team in this cohort</p>
      <p className="mt-1 text-[12px] text-ink-soft">
        You are an active member of this cohort, so you can start a team — you'll be added as its
        first member automatically. Picking a problem is optional; a team can choose later.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-ink">Team name</span>
          <Input
            className="max-w-xs"
            placeholder="e.g. Wastemap Sprints"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-ink">Start from a problem (optional)</span>
          <Select className="max-w-xs" value={problemId} onChange={(e) => setProblemId(e.target.value)}>
            <option value="">— Choose later —</option>
            {(problems ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </Select>
        </label>
        <Button onClick={create} loading={busy}>Create team</Button>
        <Button variant="secondary" onClick={() => { setOpen(false); setError(null); }}>Cancel</Button>
      </div>
      {error && <div className="mt-3 max-w-xl"><ErrorBanner message={error} /></div>}
    </Card>
  );
}

/** B3 — mentor assignment panel for cohort staff. Mentors are looked up by
 * email (find_user_id_by_email is staff-restricted). The database validates
 * staff authority over the team; whether the person actually holds the mentor
 * ROLE cannot be checked from the client (role rows are private), so the note
 * below says so honestly. */
function MentorsPanel({ cohortId, teams }: { cohortId: string; teams: Awaited<ReturnType<typeof fetchCohortTeams>> }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [teamId, setTeamId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const cohortTeamIds = new Set(teams.map((t) => t.id));
  const { data: assignments } = useQuery({
    queryKey: ["mentorAssignments", cohortId],
    queryFn: () => fetchMentorAssignments(null),
  });
  const visible = (assignments ?? []).filter((a) => cohortTeamIds.has(a.team_id));

  if (teams.length === 0) return null;

  const assign = async () => {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const uid = await findUserIdByEmail(email.trim().toLowerCase());
      if (!uid) {
        setError("No BuildProof account found for that email. The mentor must sign up first.");
        return;
      }
      await assignMentor(teamId, uid, user!.id);
      setOk("Mentor assigned. They will see this team in their mentor workspace.");
      setEmail("");
      await qc.invalidateQueries({ queryKey: ["mentorAssignments", cohortId] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assignment failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8">
      <CardHeader title="Mentors" sub="Cohort staff connect mentors to specific teams. The database only allows staff of this cohort to assign." />
      {error && <div className="mb-2 max-w-xl"><ErrorBanner message={error} /></div>}
      {ok && <p className="mb-2 text-[12.5px] font-semibold text-success">{ok}</p>}
      <Card className="p-4">
        {visible.length === 0 ? (
          <p className="text-[13px] text-ink-soft">No mentor assignments for this cohort's teams yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {visible.map((a) => {
              const team = teams.find((t) => t.id === a.team_id);
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-canvas px-3 py-2 text-[13px]">
                  <span>
                    <strong>{team?.name ?? "Team"}</strong>
                    <span className="ml-2 text-[12px] text-ink-soft">mentor {a.mentor_id.slice(0, 8)}…</span>
                  </span>
                  <button
                    className="text-[12px] font-semibold text-danger hover:underline"
                    onClick={async () => {
                      try {
                        await setMentorAssignmentActive(a.id, false);
                        await qc.invalidateQueries({ queryKey: ["mentorAssignments", cohortId] });
                      } catch {
                        // Revocation needs the mentor_assignment update policy from
                        // the drafted repair migration; until it is applied the DB
                        // rejects this — say so plainly instead of pretending.
                        setError("Revoking needs the assignment-update policy (drafted migration) to be applied first.");
                      }
                    }}
                  >
                    revoke
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card className="mt-3 p-4">
        <p className="mb-2 text-[13px] font-semibold">Assign a mentor to a team</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-ink">Mentor email</span>
            <Input className="max-w-xs" type="email" placeholder="mentor@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-ink">Team</span>
            <Select className="max-w-xs" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">— Select team —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </label>
          <Button onClick={assign} loading={busy} disabled={!teamId || email.trim().length < 5}>Assign mentor</Button>
        </div>
        <p className="mt-2 text-[12px] text-ink-soft">
          Note: BuildProof cannot verify from here that this account holds the "mentor" role (role records
          are visible only to platform admins). Coordination of who your mentors are happens outside the app.
        </p>
      </Card>
    </section>
  );
}

function teamStatusLabel(s: string) {  const labels: Record<string, string> = {    forming: "Forming",
    active: "In progress",
    paused: "Paused",
    stopped: "Stopped",
    completed: "Completed",
  };
  return labels[s] ?? s;
}

function staffCheck(roles: string[]) {
  return ["institution_admin", "faculty_coordinator", "platform_admin"].some((r) => roles.includes(r));
}
void staffCheck;

function AcceptMembership({ membershipId }: { membershipId: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent-600/30 bg-warn-soft px-4 py-3">
      <p className="text-[13.5px] text-warn">
        You were added to this cohort as a <strong>proposed</strong> member. Accept if you intend to participate.
      </p>
      <Button
        size="sm"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await acceptCohortMembership(membershipId);
            await qc.invalidateQueries();
          } finally {
            setBusy(false);
          }
        }}
      >
        <Check className="h-4 w-4" /> Accept membership
      </Button>
    </div>
  );
}

function CohortStatusEditor({ cohortId, status }: { cohortId: string; status: string }) {
  const { roles } = useAuth();
  const canManage = ["institution_admin", "faculty_coordinator", "platform_admin"].some((r) => (roles as string[]).includes(r));
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  if (!canManage) return null;
  return (
    <Card>
      <CardHeader title="Cohort status" sub="Staff only" />
      <div className="flex items-center gap-3 px-5 pb-5">
        <Select
          value={status}
          onChange={async (e) => {
            setBusy(true);
            try {
              await updateCohortStatus(cohortId, e.target.value as "planning" | "active" | "completed");
              await qc.invalidateQueries({ queryKey: ["cohort", cohortId] });
            } finally {
              setBusy(false);
            }
          }}
        >
          <option value="planning">Planning</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </Select>
        {busy && <span className="text-[12px] text-ink-soft">Saving…</span>}
      </div>
    </Card>
  );
}

function MemberTable({ members }: { members: Awaited<ReturnType<typeof fetchCohortMembers>> }) {
  const qc = useQueryClient();
  const { roles, user } = useAuth();
  const canManage = ["institution_admin", "faculty_coordinator", "platform_admin"].some((r) => (roles as string[]).includes(r));

  if (members.length === 0) {
    return <p className="px-5 py-4 text-[13px] text-ink-soft">No members yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-line text-left text-[12px] uppercase tracking-wide text-ink-soft">
            <th className="px-5 py-2.5 font-semibold">Name</th>
            <th className="px-5 py-2.5 font-semibold">Role</th>
            <th className="px-5 py-2.5 font-semibold">Status</th>
            {canManage && <th className="px-5 py-2.5 font-semibold">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id} className="border-b border-line/60 last:border-0">
              <td className="px-5 py-2.5">{m.profile?.full_name ?? "(no profile yet)"}</td>
              <td className="px-5 py-2.5">{titleize(m.cohort_role)}</td>
              <td className="px-5 py-2.5">
                <Badge tone={m.status === "active" ? "success" : m.status === "proposed" ? "warn" : "neutral"}>
                  {titleize(m.status)}
                </Badge>
              </td>
              {canManage && (
                <td className="px-5 py-2.5">
                  {m.status !== "removed" && m.user_id !== user?.id && (
                    <button
                      className="text-[12px] font-semibold text-danger hover:underline"
                      onClick={async () => {
                        await removeCohortMember(m.id);
                        await qc.invalidateQueries();
                      }}
                    >
                      Remove
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddMemberForm({ cohortId }: { cohortId: string }) {
  const { roles } = useAuth();
  const canManage = ["institution_admin", "faculty_coordinator", "platform_admin"].some((r) => (roles as string[]).includes(r));
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("student");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const qc = useQueryClient();

  if (!canManage) return null;

  const add = async () => {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const uid = await findUserIdByEmail(email.trim().toLowerCase());
      if (!uid) {
        setError("No BuildProof account found for that email. The user must sign up first.");
        return;
      }
      await addCohortMember(cohortId, uid, role as "student" | "facilitator" | "mentor" | "faculty_coordinator");
      setOk(`${role} added as provisional (proposed) member.`);
      await qc.invalidateQueries();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add member");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mt-3 p-4">
      <p className="mb-2 text-[13px] font-semibold">Add member by email</p>
      {error && <div className="mb-2"><ErrorBanner message={error} /></div>}
      {ok && <p className="mb-2 text-[12.5px] font-semibold text-success">{ok}</p>}
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="user@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Select className="max-w-[180px]" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="student">Student</option>
          <option value="facilitator">Facilitator</option>
          <option value="mentor">Mentor</option>
          <option value="faculty_coordinator">Faculty coordinator</option>
        </Select>
        <Button onClick={add} loading={busy}>Add</Button>
      </div>
      <p className="mt-2 text-[12px] text-ink-soft">
        Adding is "proposed" — the member accepts it themselves. Role records in user_roles cannot be edited here.
      </p>
    </Card>
  );
}

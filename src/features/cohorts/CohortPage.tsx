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
} from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Badge, Button, Card, CardHeader, EmptyState, LoadingBlock, PageTitle, Input, Select, ErrorBanner } from "../../components/ui";
import { useParams, Link } from "react-router-dom";
import { titleize } from "../../lib/utils";

export default function CohortPage() {
  const { cohortId } = useParams();
  const { user } = useAuth();

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
        {(teams ?? []).length === 0 ? (
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
    </div>
  );
}

function teamStatusLabel(s: string) {  const labels: Record<string, string> = {
    forming: "Forming",
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

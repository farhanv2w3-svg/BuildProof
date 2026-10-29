import { useState } from "react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchTeam,
  fetchTeamMembers,
  fetchTeamInvites,
  createTeamInvite,
  revokeTeamInvite,
  updateTeamMemberStatus,
  acceptTeamInvite,
} from "../../lib/api";
import { Badge, Button, Card, ErrorBanner, Field, Input, LoadingBlock, EmptyState } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { cn, titleize } from "../../lib/utils";
import { Check, X } from "lucide-react";

const tabs = [
  { to: "", label: "Overview", end: true },
  { to: "evidence", label: "Validation & evidence" },
  { to: "feasibility", label: "Feasibility" },
  { to: "tests", label: "Prototype & testing" },
  { to: "plan", label: "Plan & tasks" },
  { to: "roles", label: "Team roles" },
];

export default function TeamLayout() {
  const { teamId } = useParams();
  const { user } = useAuth();

  const { data: team, isLoading } = useQuery({
    queryKey: ["team", teamId],
    queryFn: () => fetchTeam(teamId!),
    enabled: !!teamId,
  });
  const { data: members } = useQuery({
    queryKey: ["teamMembers", teamId],
    queryFn: () => fetchTeamMembers(teamId!),
    enabled: !!teamId,
  });

  if (isLoading) return <LoadingBlock />;
  if (!team) {
    return (
      <EmptyState
        title="Team not found or not accessible"
        description="Team workspaces are private: only members, assigned mentors, cohort staff and authorised problem owners can open them."
      />
    );
  }

  const myMember = (members ?? []).find((m) => m.user_id === user?.id);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="display-title text-2xl">{team.name}</h1>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            Team workspace · {titleize(team.status)}
          </p>
        </div>
        <Badge tone={team.status === "active" ? "success" : team.status === "stopped" ? "danger" : "neutral"}>
          {titleize(team.status)}
        </Badge>
      </div>

      {myMember?.status === "proposed" && <AcceptTeamMembership memberId={myMember.id} />}

      <nav aria-label="Team sections" className="mb-6 flex flex-wrap gap-1 border-b border-line">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={`/app/teams/${teamId}${t.to ? `/${t.to}` : ""}`}
            end={t.end as boolean}
            className={({ isActive }) =>
              cn(
                "-mb-px border-b-2 px-3 py-2 text-[13.5px] font-semibold transition-colors",
                isActive
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-ink-soft hover:text-ink"
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      <Outlet context={{ team, members }} />
      <MembersPanel teamId={team.id} />
      <InvitesPanel teamId={team.id} />
    </div>
  );
}

function AcceptTeamMembership({ memberId }: { memberId: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent-600/30 bg-warn-soft px-4 py-3">
      <p className="text-[13.5px] text-warn">You were added to this team as a proposed member.</p>
      <div className="flex gap-2">
        <Button
          size="sm"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await updateTeamMemberStatus(memberId, "accepted");
              await qc.invalidateQueries();
            } finally {
              setBusy(false);
            }
          }}
        >
          <Check className="h-4 w-4" /> Accept
        </Button>
        <Button size="sm" variant="secondary" onClick={() => nav("/app")}>
          <X className="h-4 w-4" /> Not now
        </Button>
      </div>
    </div>
  );
}

function MembersPanel({ teamId }: { teamId: string }) {
  const { data: members } = useQuery({
    queryKey: ["teamMembers", teamId],
    queryFn: () => fetchTeamMembers(teamId),
  });
  return (
    <section className="mt-10">
      <h2 className="mb-3 display-title text-lg">Contributors</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(members ?? [])
          .filter((m) => m.status === "accepted")
          .map((m) => (
            <Card key={m.id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-[13.5px] font-semibold">{m.profile?.full_name ?? "(no profile)"}</p>
                <p className="text-[11.5px] text-ink-soft">{titleize(m.member_role)}</p>
              </div>
              <Badge tone="success">Active</Badge>
            </Card>
          ))}
      </div>
      <p className="mt-2 text-[12px] text-ink-soft">
        <em>Proposed</em> members are not shown until they accept. Contributions are recorded
        through evidence and Proof Card contributor roles — not implied by membership.
      </p>
    </section>
  );
}

function InvitesPanel({ teamId }: { teamId: string }) {
  const { user } = useAuth();
  const { data: members } = useQuery({
    queryKey: ["teamMembers", teamId],
    queryFn: () => fetchTeamMembers(teamId),
  });
  const { data: invites } = useQuery({
    queryKey: ["teamInvites", teamId],
    queryFn: () => fetchTeamInvites(teamId),
  });
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const me = (members ?? []).find((m) => m.user_id === user?.id);
  const isAcceptedMember = me?.status === "accepted";
  if (!isAcceptedMember) return null;

  const pending = (invites ?? []).filter((i) => i.status === "pending");

  const invite = async () => {
    setBusy(true);
    setErr(null);
    try {
      await createTeamInvite(teamId, email.trim().toLowerCase(), user!.id);
      setEmail("");
      await qc.invalidateQueries({ queryKey: ["teamInvites", teamId] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create invite");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-6">
      <h3 className="mb-2 text-[14px] font-bold">Invite a teammate</h3>
      {err && <div className="mb-2"><ErrorBanner message={err} /></div>}
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" type="email" placeholder="teammate@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button onClick={invite} loading={busy} disabled={email.trim().length < 5}>Create invite</Button>
      </div>
      <p className="mt-2 max-w-xl text-[12px] text-ink-soft">
        BuildProof does not send email from the app (no email provider is configured). Share the
        invite link with your teammate directly — each invite has a unique secret token.
        {pending.length > 0 && (
          <>
            <br />
            <strong className="text-ink">Pending invites:</strong>{" "}
            {pending.map((i) => (
              <span key={i.id} className="mr-2 inline-flex items-center gap-1">
                <code className="rounded bg-canvas px-1 py-0.5 text-[11px]">{`/app/invites/${i.token.slice(0, 8)}…`}</code>
                <button
                  className="text-[11px] font-semibold text-danger hover:underline"
                  onClick={async () => {
                    await revokeTeamInvite(i.id);
                    await qc.invalidateQueries({ queryKey: ["teamInvites", teamId] });
                  }}
                >
                  revoke
                </button>
              </span>
            ))}
          </>
        )}
      </p>
    </section>
  );
}

/** Standalone invite-accept page (/app/invites/:token), rendered inside app shell. */
export function InviteAcceptPage() {
  const { token } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!user) return <EmptyState title="Sign in first" description="Sign in with the account that was invited, then reopen this link." />;

  return (
    <div className="max-w-lg">
      {done ? (
        <>
          <p className="rounded-lg border border-success/25 bg-success-soft px-4 py-3 text-[13.5px] text-success">
            Invite accepted. You're now an accepted member of the team.
          </p>
          <Button className="mt-4" onClick={() => nav("/app")}>Go to dashboard</Button>
        </>
      ) : (
        <Card className="p-5">
          {err && <div className="mb-3"><ErrorBanner message={err} /></div>}
          <p className="text-[13.5px] text-ink-soft">
            Accepting adds you to the team as an accepted member. The invite must still be pending.
          </p>
          <Button
            className="mt-4"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                const teamId = await acceptTeamInvite(token!);
                setDone(true);
                setTimeout(() => nav(`/app/teams/${teamId}`), 900);
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Invite could not be accepted");
              } finally {
                setBusy(false);
              }
            }}
          >
            Accept invite
          </Button>
        </Card>
      )}
    </div>
  );
}

/** Mini field component reused in workspace forms. */
export function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Field label={label} hint={hint}>
      {children}
    </Field>
  );
}

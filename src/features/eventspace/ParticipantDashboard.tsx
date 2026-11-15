import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageTitle,
} from "../../components/ui";
import {
  getEventById,
  getMyRegistration,
  getMySubmission,
  listMyJudgeAssignments,
  listMyManagedEvents,
  listMyRegistrations,
  listMyTeamInvites,
  listTeamMembers,
  respondTeamInvite,
} from "../../lib/eventspace";
import { ES_SUBMISSION_STATUS_LABELS, registrationWindowOpen, submissionWindowOpen } from "../../lib/eventspaceRules";
import { errMessage } from "../../lib/api";
import { formatDate } from "../../lib/utils";
import { useAuth } from "../../lib/auth";

/* ------------------------------------------------------------------ */
/*  Participant dashboard — /app/eventspace                            */
/* ------------------------------------------------------------------ */

export default function ParticipantDashboard() {
  const { user } = useAuth();
  const { data: regs, isLoading, error } = useQuery({
    queryKey: ["es_my_regs"],
    queryFn: listMyRegistrations,
  });
  const { data: judgeAssignments } = useQuery({
    queryKey: ["es_my_judge_assignments"],
    queryFn: listMyJudgeAssignments,
  });
  const { data: managed } = useQuery({
    queryKey: ["es_my_managed_events"],
    queryFn: listMyManagedEvents,
  });

  if (error) return <ErrorBanner message={errMessage(error)} />;

  return (
    <div className="space-y-6">
      <PageTitle
        title="EventSpace"
        sub="Your registrations, teams, submissions and judging — all in one place."
        action={
          <Link to="/eventspace" className="no-underline">
            <Button variant="secondary">Discover events</Button>
          </Link>
        }
      />

      {managed && managed.length > 0 ? (
        <Card>
          <CardHeader title="You organise events" action={<Link to="/eventspace/organizer" className="text-xs font-semibold text-brand-600 underline">Organiser workspace</Link>} />
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">My registrations</h2>
        {isLoading ? (
          <LoadingBlock />
        ) : !regs || regs.length === 0 ? (
          <EmptyState
            title="No registrations yet"
            description="Find an event that matches your skills and register — individual or with a team."
            action={
              <Link to="/eventspace" className="no-underline">
                <Button>Browse events</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {regs.map((r) => (
              <RegistrationCard key={r.id} eventId={r.event_id} regStatus={r.status} userId={user?.id ?? ""} />
            ))}
          </div>
        )}
      </section>

      {judgeAssignments && judgeAssignments.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Judging</h2>
          <Card className="p-4">
            <p className="text-sm text-ink-soft">
              You have {judgeAssignments.length} judge assignment(s) across your events.
            </p>
            <Link to="/app/eventspace/judging" className="no-underline">
              <Button size="sm" className="mt-2">Open judge workspace</Button>
            </Link>
          </Card>
        </section>
      ) : null}

      <TeamInvitesSection userId={user?.id ?? ""} />
    </div>
  );
}

function TeamInvitesSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: invites, isLoading, error } = useQuery({
    queryKey: ["es_team_invites", userId],
    queryFn: () => listMyTeamInvites(userId),
    enabled: !!userId,
  });
  const [err, setErr] = useState<string | null>(null);
  if (!userId || isLoading || error || !invites || invites.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Team invitations</h2>
      {err ? <ErrorBanner message={err} /> : null}
      <div className="space-y-2">
        {invites.map((inv) => (
          <Card key={inv.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
            <div>
              <p className="font-semibold text-ink">{inv.team_name ?? "A team"} invited you</p>
              <p className="text-xs text-ink-soft">Respond to join this event team.</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  setErr(null);
                  try {
                    await respondTeamInvite(inv.id, true);
                    qc.invalidateQueries({ queryKey: ["es_team_invites", userId] });
                    qc.invalidateQueries({ queryKey: ["es_my_regs"] });
                  } catch (e) {
                    setErr(errMessage(e));
                  }
                }}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  setErr(null);
                  try {
                    await respondTeamInvite(inv.id, false);
                    qc.invalidateQueries({ queryKey: ["es_team_invites", userId] });
                  } catch (e) {
                    setErr(errMessage(e));
                  }
                }}
              >
                Decline
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function RegistrationCard({
  eventId,
  regStatus,
  userId,
}: {
  eventId: string;
  regStatus: string;
  userId: string;
}) {
  const { data: event, error } = useQuery({
    queryKey: ["es_event_by_id", eventId],
    queryFn: () => getEventById(eventId),
  });
  const { data: registration } = useQuery({
    queryKey: ["es_reg_detail", eventId],
    queryFn: () => getMyRegistration(eventId),
  });
  const { data: submission } = useQuery({
    queryKey: ["es_my_submission", eventId],
    queryFn: () => getMySubmission(eventId, userId),
  });
  const { data: teamMembers } = useQuery({
    queryKey: ["es_team_members", registration?.team_id],
    queryFn: () => listTeamMembers(registration!.team_id!),
    enabled: !!registration?.team_id,
  });

  if (error || !event) {
    return (
      <Card className="p-4">
        <p className="text-sm text-ink-soft">This event is no longer available to you.</p>
      </Card>
    );
  }

  const subOpen = submissionWindowOpen(event);
  const regOpen = registrationWindowOpen(event);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-ink">{event.title}</p>
            <Badge tone={regStatus === "registered" ? "success" : regStatus === "pending" ? "warning" : "neutral"}>
              {regStatus === "registered" ? "Registered" : regStatus}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            {formatDate(event.starts_at)} · {event.institution_name}
            {registration?.team_id && teamMembers
              ? ` · Team of ${teamMembers.filter((m) => m.status === "active").length}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/eventspace/${event.slug}`} className="no-underline">
            <Button size="sm" variant="ghost">Event page</Button>
          </Link>
          {regStatus !== "withdrawn" && regStatus !== "cancelled" && regStatus !== "rejected" ? (
            <Link to={`/app/eventspace/${event.id}/submit`} className="no-underline">
              <Button size="sm" variant={submission ? "secondary" : "primary"}>
                {submission
                  ? `Submission: ${ES_SUBMISSION_STATUS_LABELS[submission.status] ?? submission.status}`
                  : subOpen
                    ? "Submit project"
                    : "Submissions closed"}
              </Button>
            </Link>
          ) : null}
        </div>
      </div>
      {!regOpen && subOpen ? (
        <p className="mt-2 text-xs text-ink-soft">Registration closed · submissions still open.</p>
      ) : null}
    </Card>
  );
}

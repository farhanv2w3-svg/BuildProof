import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchMyMentorTeams, fetchTeam, fetchInterviews, fetchFeasibility, fetchPrototype, listEvidence } from "../../lib/api";
import {
  Card,
  CardHeader,
  EmptyState,
  LoadingBlock,
  PageTitle,
} from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { formatDate, titleize } from "../../lib/utils";

export default function MentorPage() {
  const { user } = useAuth();
  const { data: teams, isLoading } = useQuery({
    queryKey: ["mentorTeams", user?.id],
    queryFn: () => fetchMyMentorTeams(user!.id),
    enabled: !!user,
  });

  if (isLoading) return <LoadingBlock />;
  if (!user) return null;

  return (
    <div>
      <PageTitle
        title="Mentoring"
        sub="Teams assigned to you. Assignment is created by cohort staff — mentors only see explicitly assigned work."
      />
      {(teams ?? []).length === 0 ? (
        <EmptyState
          title="No teams assigned"
          description="When a facilitator assigns you a team, it appears here with its current state."
        />
      ) : (
        <div className="grid gap-4">
          {(teams ?? []).map((t) => (
            <MentorTeamCard key={t.id} teamId={t.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function MentorTeamCard({ teamId }: { teamId: string }) {
  const { data: team } = useQuery({ queryKey: ["team", teamId], queryFn: () => fetchTeam(teamId) });
  const { data: interviews } = useQuery({ queryKey: ["interviews", teamId], queryFn: () => fetchInterviews(teamId) });
  const { data: feas } = useQuery({ queryKey: ["feasibility", teamId], queryFn: () => fetchFeasibility(teamId) });
  const { data: proto } = useQuery({ queryKey: ["prototype", teamId], queryFn: () => fetchPrototype(teamId) });
  const { data: attachments } = useQuery({ queryKey: ["evidence", teamId], queryFn: () => listEvidence(teamId) });

  if (!team) return null;
  return (
    <Card>
      <CardHeader
        title={team.name}
        sub={`Status: ${titleize(team.status)} · ${interviews?.length ?? 0} interviews · feasibility: ${feas ? titleize(feas.status) : "none"} · prototype: ${proto ? titleize(proto.status) : "none"} · attachments: ${attachments?.length ?? 0}`}
        action={
          <Link to={`/app/teams/${team.id}`} className="text-[13px] font-semibold text-brand-700 hover:underline">
            Open workspace →
          </Link>
        }
      />
      <ul className="px-5 pb-4 text-[12.5px] text-ink-soft">
        <li>Latest interview: {interviews?.[0] ? `${formatDate(interviews[0].interview_date)} — ${interviews[0].participant_label}` : "none"}</li>
        <li>Feasibility decision: {feas?.decision ? titleize(feas.decision) : "not recorded"}</li>
        <li>Prototype decision: {proto?.decision ? titleize(proto.decision) : "not recorded"}</li>
      </ul>
    </Card>
  );
}

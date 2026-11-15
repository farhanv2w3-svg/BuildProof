import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  LoadingBlock,
  PageTitle,
  Select,
  SuccessBanner,
  Textarea,
  PrivacyNote,
} from "../../components/ui";
import {
  createEventTeam,
  getEventBySlug,
  listEventTeams,
  registerForEvent,
  resolveInvitee,
  inviteTeamMember,
} from "../../lib/eventspace";
import {
  checkEligibility,
  registrationWindowOpen,
  validateRegistrationAnswers,
} from "../../lib/eventspaceRules";
import { errMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { formatDate } from "../../lib/utils";
import type { EsRegQuestion } from "../../types/database";

export default function RegistrationPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const { data: event, isLoading, error } = useQuery({
    queryKey: ["es_event", slug],
    queryFn: () => getEventBySlug(slug),
  });

  const { data: existingTeams } = useQuery({
    queryKey: ["es_event_teams_public", event?.id],
    queryFn: () => listEventTeams(event!.id),
    enabled: !!event && !!user,
  });

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"individual" | "team">("individual");
  const [teamName, setTeamName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invites, setInvites] = useState<string[]>([]);
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const questions: EsRegQuestion[] = event?.reg_questions ?? [];
  const answerPairs = useMemo(
    () => Object.entries(answers).map(([label, answer]) => ({ label, answer })),
    [answers]
  );

  const validation = validateRegistrationAnswers(questions, answerPairs);
  const regOpen = event ? registrationWindowOpen(event) : false;
  const canSubmit =
    regOpen && validation.ok && (mode === "individual" || teamName.trim().length >= 2);

  const register = useMutation({
    mutationFn: async () => {
      if (!event || !user) throw new Error("Session expired — sign in and try again.");
      let teamId: string | null = null;
      if (mode === "team") {
        const existing = (existingTeams ?? []).find(
          (t) => t.leader_user_id === user.id || t.name.toLowerCase() === teamName.trim().toLowerCase()
        );
        if (existing && existing.leader_user_id === user.id) {
          teamId = existing.id;
        } else if (existing) {
          throw new Error("That team name is already taken for this event.");
        } else {
          const team = await createEventTeam(event.id, teamName.trim(), user.id);
          teamId = team.id;
          for (const email of invites) {
            try {
              const invitee = await resolveInvitee(event.id, email);
              if (invitee) await inviteTeamMember(team.id, invitee.user_id, user.id);
            } catch {
              // non-fatal: the leader can invite again from the dashboard
            }
          }
        }
      }
      return registerForEvent(event.id, mode, teamId, answerPairs);
    },
    onSuccess: () => {
      setDone(true);
      navigate(`/app/eventspace`);
    },
    onError: (e) => setFormError(errMessage(e)),
  });

  if (isLoading) return <LoadingBlock label="Loading registration…" />;
  if (error) return <ErrorBanner message={errMessage(error)} />;
  if (!event) {
    return <EmptyState title="Event not found" description="It may be private or no longer published." />;
  }

  if (!user) {
    return (
      <EmptyState
        title="Sign in to register"
        description="Registration requires a BuildProof account so organisers can verify participants."
        action={
          <Link to="/login" className="no-underline">
            <Button>Sign in</Button>
          </Link>
        }
      />
    );
  }

  const eligibility = checkEligibility(event, {
    eligibility_level: null,
    institution_name: profile?.college ?? null,
    academic_year: null,
    department: null,
  });

  if (done) {
    return (
      <div className="space-y-4">
        <SuccessBanner
          message={
            event.confirmation_message
              ? event.confirmation_message
              : "You're registered! Find this event on your dashboard."
          }
        />
        <Link to="/app/eventspace" className="no-underline">
          <Button>Go to your dashboard</Button>
        </Link>
      </div>
    );
  }

  async function addInvite() {
    setInviteErr(null);
    const email = inviteEmail.trim();
    if (!email) return;
    try {
      const invitee = await resolveInvitee(event!.id, email);
      if (!invitee) {
        setInviteErr("No BuildProof account found with that email. They must sign up first.");
        return;
      }
      if (invites.includes(email)) {
        setInviteErr("Already added.");
        return;
      }
      setInvites((v) => [...v, email]);
      setInviteEmail("");
    } catch (e) {
      setInviteErr(errMessage(e));
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle title={`Register: ${event.title}`} sub={event.institution_name} />

      {!regOpen ? (
        <ErrorBanner message="Registration is closed for this event." />
      ) : !eligibility.ok ? (
        <ErrorBanner message={eligibility.message ?? "You may not be eligible for this event."} />
      ) : null}

      <Card>
        <CardHeader
          title="Participation"
          sub={
            event.participation === "individual"
              ? "Individual participation only."
              : event.participation === "team"
                ? `Team participation (${event.min_team_size}–${event.max_team_size} members).`
                : "Choose individual or team participation."
          }
        />
        <div className="flex flex-wrap gap-2 px-5 pb-2">
          {event.participation !== "team" ? (
            <button
              type="button"
              onClick={() => setMode("individual")}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === "individual" ? "bg-brand-600 text-white" : "border border-line text-ink"}`}
            >
              Individual
            </button>
          ) : null}
          {event.participation !== "individual" ? (
            <button
              type="button"
              onClick={() => setMode("team")}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === "team" ? "bg-brand-600 text-white" : "border border-line text-ink"}`}
            >
              Team
            </button>
          ) : null}
        </div>

        {mode === "team" ? (
          <div className="space-y-4 px-5 pb-5">
            <Field label="Team name" required hint={`${event.min_team_size}–${event.max_team_size} members including you.`}>
              <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} maxLength={120} />
            </Field>
            <Field label="Invite teammates by email" hint="They must have a BuildProof account and register for this event before accepting.">
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@college.edu"
                />
                <Button variant="secondary" type="button" onClick={addInvite}>
                  Add
                </Button>
              </div>
            </Field>
            {inviteErr ? <ErrorBanner message={inviteErr} /> : null}
            {invites.length > 0 ? (
              <ul className="space-y-1 text-sm text-ink-soft">
                {invites.map((email) => (
                  <li key={email}>• {email} (invite ready)</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </Card>

      {questions.length > 0 ? (
        <Card>
          <CardHeader title="Registration questions" />
          <div className="space-y-4 px-5 pb-5">
            {questions.map((q) => (
              <Field key={q.label} label={q.label} required={q.required}>
                {q.type === "textarea" ? (
                  <Textarea
                    rows={3}
                    value={answers[q.label] ?? ""}
                    onChange={(e) => setAnswers({ ...answers, [q.label]: e.target.value })}
                  />
                ) : q.type === "select" ? (
                  <Select
                    value={answers[q.label] ?? ""}
                    onChange={(e) => setAnswers({ ...answers, [q.label]: e.target.value })}
                  >
                    <option value="">Choose…</option>
                    {(q.options ?? []).map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    value={answers[q.label] ?? ""}
                    onChange={(e) => setAnswers({ ...answers, [q.label]: e.target.value })}
                  />
                )}
              </Field>
            ))}
          </div>
        </Card>
      ) : null}

      {formError ? <ErrorBanner message={formError} /> : null}
      {!validation.ok ? <ErrorBanner message={validation.message ?? "Please complete the registration form."} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          loading={register.isPending}
          disabled={!canSubmit}
          onClick={() => register.mutate()}
        >
          {event.registration_approval
            ? "Submit for approval"
            : mode === "team"
              ? "Create team & register"
              : "Confirm registration"}
        </Button>
        <Link to={`/eventspace/${event.slug}`} className="text-sm font-semibold text-brand-600 underline">
          Back to event page
        </Link>
      </div>

      <p className="text-xs text-ink-soft">
        Registration window: {event.registration_opens_at ? formatDate(event.registration_opens_at) : "now"} –{" "}
        {event.registration_closes_at ? formatDate(event.registration_closes_at) : "event start"}
        {event.registration_capacity ? ` · capacity ${event.registration_capacity}` : ""}
      </p>

      <PrivacyNote>
        Your registration answers are visible only to this event's organisers. Submissions and files
        stay private unless you later approve a public showcase.
      </PrivacyNote>
    </div>
  );
}

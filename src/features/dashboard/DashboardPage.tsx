import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Compass, GraduationCap, ClipboardList, Building2, UserCog, ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "../../lib/auth";
import { Badge, ButtonLink, Card, EmptyState, LoadingBlock, PageTitle } from "../../components/ui";
import { isPlatformAdmin, primaryRoleLabel, teamStatusLabel } from "../../lib/rbac";
import { listMyCohorts, listMyCards, fetchCohortTeams } from "../../lib/api";
import { formatDate } from "../../lib/utils";
import type { Team } from "../../types/database";

export default function DashboardPage() {
  const { user, profile, roles, loading } = useAuth();

  const { data: cohorts, isLoading: loadingCohorts } = useQuery({
    queryKey: ["cohorts", user?.id],
    queryFn: () => listMyCohorts(user!.id),
    enabled: !!user,
  });
  const { data: cards } = useQuery({
    queryKey: ["myCards", user?.id],
    queryFn: () => listMyCards(user!.id),
    enabled: !!user,
  });

  if (loading || loadingCohorts) return <LoadingBlock />;
  if (!user) return null;

  const staff =
    isPlatformAdmin(roles) ||
    roles.includes("institution_admin") ||
    roles.includes("faculty_coordinator") ||
    roles.includes("facilitator");
  const mentor = roles.includes("mentor");
  const student = !staff && !mentor;

  return (
    <div>
      <PageTitle
        title={staff ? "Programme dashboard" : mentor ? "Mentor dashboard" : `Welcome, ${profile?.full_name?.split(" ")[0] ?? "there"}`}
        sub={
          staff
            ? "Manage cohorts, teams and reviews from here."
            : mentor
              ? "Teams assigned to you appear below."
              : "Your BuildProof journey: pick a real problem, validate it with genuine evidence, and build Proof Cards."
        }
        action={<Badge tone="brand">{primaryRoleLabel(roles)}</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-card border border-brand-200 bg-brand-50 p-5">
          <p className="font-display text-[15px] font-bold text-brand-800">The BuildProof process</p>
          <p className="mt-1 text-[13px] text-brand-800/80">
            Real problem → validated → feasibility → prototype → Proof Card.
          </p>
          <ButtonLink to="/how-it-works" variant="secondary" size="sm" className="mt-4">
            See the stages <ArrowRight className="h-3.5 w-3.5" />
          </ButtonLink>
        </div>
        <StatCard
          icon={<GraduationCap className="h-5 w-5" />}
          label="Cohorts you're in"
          value={(cohorts ?? []).length}
        />
        <StatCard
          icon={<ClipboardList className="h-5 w-5" />}
          label="Proof Cards on your teams"
          value={(cards ?? []).length}
          to="/app/my-proof"
        />
      </div>

      {student && <StudentJourney />}

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="display-title text-lg">Cohorts you're in</h2>
          {(roles.includes("institution_admin") || isPlatformAdmin(roles) || roles.includes("faculty_coordinator")) && (
            <ButtonLink to="/app/institution" size="sm" variant="secondary">Create cohort</ButtonLink>
          )}
        </div>
        {(cohorts ?? []).length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-6 w-6" />}
            title={staff ? "No cohorts yet" : "You haven't joined a cohort yet"}
            description={
              staff
                ? "Create a cohort from the Institution page by adding an institution first."
                : "Cohort membership is set up by your college or facilitator. Meanwhile, you can browse problems and submit your own."
            }
            action={<ButtonLink to="/app/problems" variant="secondary" size="sm">Browse problems</ButtonLink>}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(cohorts ?? []).map((c) => (
              <Card key={c.id} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display font-bold">{c.name}</p>
                    <p className="mt-0.5 text-[12.5px] text-ink-soft">{c.description}</p>
                  </div>
                  <Badge tone={c.status === "active" ? "success" : "neutral"}>{c.status}</Badge>
                </div>
                <ButtonLink to={`/app/cohorts/${c.id}`} size="sm" variant="secondary" className="mt-4">
                  Open cohort
                </ButtonLink>
              </Card>
            ))}
          </div>
        )}
      </section>

      {mentor && (
        <section className="mt-8 rounded-card border border-line bg-surface p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="display-title text-lg">Mentoring</h2>
              <p className="mt-1 text-[13px] text-ink-soft">
                Teams assigned to you and their current state appear on the Mentoring page.
              </p>
            </div>
            <ButtonLink to="/app/mentor" size="sm">Open mentoring</ButtonLink>
          </div>
        </section>
      )}

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display font-bold">Submit a real problem</h3>
              <p className="mt-1 text-[13px] text-ink-soft">
                Spot something broken or wasteful around you? Document it. Submissions are
                screened by reviewers — not everything gets approved.
              </p>
            </div>
            <Compass className="h-5 w-5 shrink-0 text-brand-500" />
          </div>
          <ButtonLink to="/submit-problem" size="sm" variant="secondary" className="mt-4">
            Submit a problem
          </ButtonLink>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display font-bold">Profile & settings</h3>
              <p className="mt-1 text-[13px] text-ink-soft">
                Keep your name up to date — teams show who contributed what.
              </p>
            </div>
            <UserCog className="h-5 w-5 shrink-0 text-brand-500" />
          </div>
          <ButtonLink to="/app/profile" size="sm" variant="secondary" className="mt-4">
            Edit profile
          </ButtonLink>
        </Card>
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, to }: { icon: ReactNode; label: string; value: number; to?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div className="rounded-lg bg-brand-100 p-2 text-brand-700">{icon}</div>
        <span className="font-display text-2xl font-extrabold">{value}</span>
      </div>
      <p className="mt-3 text-[13px] text-ink-soft">{label}</p>
      {/*
        "to" is optional: only render a link when a real destination exists
        (the list of cohorts lives on this page itself — a self-link there
        would be circular). */}
      {to && (
        <Link to={to} className="mt-1 inline-block text-[12px] font-semibold text-brand-700 hover:underline">
          Details →
        </Link>
      )}
    </div>
  );
}

function StudentJourney() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: teams, isLoading } = useQuery({
    queryKey: ["myTeams", user?.id],
    queryFn: async () => {
      const cs = await listMyCohorts(user!.id);
      const all: Team[] = [];
      for (const c of cs) {
        all.push(...(await fetchCohortTeams(c.id)));
      }
      return all;
    },
    enabled: !!user,
  });

  if (isLoading) return <LoadingBlock label="Loading your teams…" />;

  const hasTeams = (teams ?? []).length > 0;

  return (
    <section className="mt-8">
      <h2 className="display-title text-lg">My journey</h2>
      <div className="mt-2 rounded-card border border-line bg-surface p-5 shadow-card">
        {hasTeams ? (
          <div>
            {(teams as Team[]).map((t) => (
              <button
                key={t.id}
                className="flex w-full flex-wrap items-baseline justify-between gap-3 border-b border-line py-3 text-left last:border-0"
                onClick={() => navigate(`/app/teams/${t.id}`)}
              >
                <div>
                  <p className="font-display font-bold text-[15px]">{t.name}</p>
                  <p className="text-[12.5px] text-ink-soft">
                    {teamStatusLabel({ status: t.status })} · updated {formatDate(t.updated_at)}
                  </p>
                </div>
                <Badge tone="brand">Open workspace</Badge>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-1 text-[13px] text-ink-soft">
              <p><span className="font-semibold text-ink">1. Choose a real problem</span> — from approved problems or your own submission</p>
              <p><span className="font-semibold text-ink">2. Validate</span> — collect consented interviews (target set by your cohort)</p>
              <p><span className="font-semibold text-ink">3. Feasibility review</span> — structured, honest assessment</p>
              <p><span className="font-semibold text-ink">4. Prototype & test</span> — optional but valuable</p>
              <p><span className="font-semibold text-ink">5. Proof Card</span> — your evidence-backed record</p>
            </div>
            <ButtonLink to="/app/problems" size="sm" className="mt-4">Browse approved problems</ButtonLink>
          </>
        )}
      </div>
    </section>
  );
}

import { requireSupabase } from "./supabase";
import type {
  AuditLog,
  Cohort,
  CohortMember,
  Comment,
  CompanyProject,
  ContentReport,
  EvidenceAttachment,
  FeasibilityReview,
  FundingApplication,
  FundingOpportunity,
  HardwareProject,
  Institution,
  Interview,
  JobOpportunity,
  MentorAssignment,
  Notification,
  Organization,
  OrganizationMember,
  OpportunityApplication,
  PaymentMilestone,
  Problem,
  ProblemScreening,
  Profile,
  ProofCard,
  ProofCardSkill,
  ProofContribution,
  ProjectMilestone,
  ProjectTask,
  PrototypeTest,
  ReviewAssignment,
  ReviewRecord,
  Solution,
  SolutionInterest,
  SolutionTransferAgreement,
  Team,
  TeamApplication,
  TeamDecision,
  TeamInvite,
  TeamMember,
  TeamRoleRequirement,
  UserRole,
  UserTest,
  OrgRole,
  EventRow,
  EventStatus,
} from "../types/database";

/* Every function relies on Supabase RLS for authorisation — the client never
 * tries to be the permission system. Errors surface as Supabase PostgrestError. */

type Err = { error: { message: string } | null };

async function fail(e: { message: string } | null) {
  if (e) throw new Error(e.message);
}

/* --------------------------- auth-dependent ------------------------ */

export async function fetchInstitutions(): Promise<Institution[]> {
  const s = requireSupabase();
  const { data, error } = await s.from("institutions").select("*").order("name");
  await fail(error);
  return (data ?? []) as Institution[];
}

export async function createInstitution(
  name: string,
  city: string | null
): Promise<Institution> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("institutions")
    .insert({ name, city })
    .select()
    .single();
  await fail(error);
  return data as Institution;
}

/* ----------------------------- problems ---------------------------- */

export async function listProblems(): Promise<Problem[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("problems")
    .select("*")
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as Problem[];
}

export async function submitProblem(
  values: {
    title: string;
    description: string;
    category: string;
    affected_users: string;
    location?: string;
    workaround?: string;
    evidence_basis?: string;
    owner_name?: string;
    owner_contact?: string;
  },
  userId: string
): Promise<Problem> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("problems")
    .insert({ ...values, submitted_by: userId, is_public: false })
    .select()
    .single();
  await fail(error);
  return data as Problem;
}

export async function updateProblemStatus(
  id: string,
  status: Problem["status"]
): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("problems").update({ status }).eq("id", id);
  await fail(error);
}

export async function addScreening(
  problem_id: string,
  reviewer_id: string,
  values: { decision: ProblemScreening["decision"]; notes: string | null }
): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("problem_screenings").insert({
    problem_id,
    reviewer_id,
    ...values,
  });
  await fail(error);
}

/* ----------------------------- teams etc --------------------------- */

export async function listMyCohorts(userId: string): Promise<Cohort[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("cohort_members")
    .select("cohort_id, cohorts(*)")
    .eq("user_id", userId);
  await fail(error);
  const rows = (data ?? []) as unknown as { cohort_id: string; cohorts: Cohort | null }[];
  return rows
    .map((r) => r.cohorts)
    .filter((c): c is Cohort => c !== null);
}

export async function fetchCohort(id: string): Promise<Cohort | null> {
  const s = requireSupabase();
  const { data, error } = await s.from("cohorts").select("*").eq("id", id).maybeSingle();
  await fail(error);
  return (data as Cohort) ?? null;
}

export async function fetchCohortMembers(cohortId: string): Promise<(CohortMember & { profile: Profile | null })[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("cohort_members")
    .select("*, profile:profiles!cohort_members_user_id_fkey(*)")
    .eq("cohort_id", cohortId)
    .order("created_at");
  await fail(error);
  return (data ?? []) as (CohortMember & { profile: Profile | null })[];
}

export async function fetchCohortTeams(cohortId: string): Promise<Team[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("teams")
    .select("*")
    .eq("cohort_id", cohortId)
    .order("created_at");
  await fail(error);
  return (data ?? []) as Team[];
}

export async function createCohort(values: {
  institution_id: string;
  name: string;
  description?: string;
  interview_gate: number;
  created_by: string;
}): Promise<Cohort> {
  const s = requireSupabase();
  const { data, error } = await s.from("cohorts").insert(values).select().single();
  await fail(error);
  const created = data as Cohort;
  const { error: gateErr } = await s.from("gates").insert({
    cohort_id: created.id,
    name: "Validation gate",
    description:
      "Team should complete at least the configured number of genuine, consented adult interviews before recording a validation decision.",
    min_interviews: values.interview_gate,
  });
  if (gateErr) console.warn("Gate row not created:", gateErr.message);
  return created;
}

export async function updateCohortStatus(
  id: string,
  status: Cohort["status"]
): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("cohorts").update({ status }).eq("id", id);
  await fail(error);
}

export async function addCohortMember(
  cohort_id: string,
  user_id: string,
  cohort_role: CohortMember["cohort_role"]
): Promise<void> {
  const s = requireSupabase();
  const { error } = await s
    .from("cohort_members")
    .insert({ cohort_id, user_id, cohort_role, status: "proposed" });
  await fail(error);
}

export async function acceptCohortMembership(id: string): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("cohort_members").update({ status: "active" }).eq("id", id);
  await fail(error);
}

export async function removeCohortMember(id: string): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("cohort_members").update({ status: "removed" }).eq("id", id);
  await fail(error);
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const s = requireSupabase();
  const { data, error } = await s.rpc("find_user_id_by_email", { lookup_email: email });
  await fail(error);
  return (data as string | null) ?? null;
}

export async function createTeam(values: {
  cohort_id: string;
  name: string;
  problem_id?: string | null;
  created_by: string;
}): Promise<Team> {
  const s = requireSupabase();
  const { data, error } = await s.from("teams").insert(values).select().single();
  await fail(error);
  return data as Team;
}

export async function addUserToTeam(
  team_id: string,
  user_id: string,
  member_role: TeamMember["member_role"] = "student",
  status: TeamMember["status"] = "proposed"
): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("team_members").insert({ team_id, user_id, member_role, status });
  await fail(error);
}

export async function updateTeamMemberStatus(id: string, status: TeamMember["status"]): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("team_members").update({ status }).eq("id", id);
  await fail(error);
}

export async function fetchTeam(id: string): Promise<Team | null> {
  const s = requireSupabase();
  const { data, error } = await s.from("teams").select("*").eq("id", id).maybeSingle();
  await fail(error);
  return (data as Team) ?? null;
}

export async function fetchTeamMembers(teamId: string): Promise<(TeamMember & { profile: Profile | null })[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("team_members")
    .select("*, profile:profiles!team_members_user_id_fkey(*)")
    .eq("team_id", teamId)
    .order("created_at");
  await fail(error);
  return (data ?? []) as (TeamMember & { profile: Profile | null })[];
}

export async function fetchTeamInvites(teamId: string): Promise<TeamInvite[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("team_invites")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as TeamInvite[];
}

export async function createTeamInvite(team_id: string, email: string, invited_by: string): Promise<TeamInvite> {
  const s = requireSupabase();
  const token = crypto.randomUUID();
  const { data, error } = await s
    .from("team_invites")
    .insert({ team_id, email: email.toLowerCase(), invited_by, token })
    .select()
    .single();
  await fail(error);
  return data as TeamInvite;
}

export async function acceptTeamInvite(token: string): Promise<string> {
  const s = requireSupabase();
  const { data, error } = await s.rpc("accept_team_invite", { invite_token: token });
  await fail(error);
  return data as string;
}

export async function revokeTeamInvite(id: string): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("team_invites").update({ status: "revoked" }).eq("id", id);
  await fail(error);
}

/* ---------------------------- interview etc ------------------------ */

export async function fetchInterviews(teamId: string): Promise<Interview[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("interviews")
    .select("*")
    .eq("team_id", teamId)
    .order("interview_date", { ascending: false });
  await fail(error);
  return (data ?? []) as Interview[];
}

export async function createInterview(
  values: Omit<Interview, "id" | "status" | "created_at" | "updated_at" | "conducted_by">,
  conducted_by: string
): Promise<Interview> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("interviews")
    .insert({ ...values, conducted_by })
    .select()
    .single();
  await fail(error);
  return data as Interview;
}

export async function setInterviewStatus(id: string, status: Interview["status"]): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("interviews").update({ status }).eq("id", id);
  await fail(error);
}

export async function fetchTeamDecisions(teamId: string): Promise<TeamDecision[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("team_decisions")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as TeamDecision[];
}

export async function createTeamDecision(
  values: { team_id: string; stage: string; decision: string; rationale: string },
  decided_by: string
): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("team_decisions").insert({ ...values, decided_by });
  await fail(error);
}

/* ---------------------------- feasibility -------------------------- */

export async function fetchFeasibility(teamId: string): Promise<FeasibilityReview | null> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("feasibility_reviews")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  await fail(error);
  return (data as FeasibilityReview) ?? null;
}

export async function saveFeasibility(
  teamId: string,
  authorId: string,
  existingId: string | null,
  values: Record<string, string>
): Promise<void> {
  const s = requireSupabase();
  const payload = { team_id: teamId, author_id: authorId, ...values };
  const { error } = existingId
    ? await s.from("feasibility_reviews").update(payload).eq("id", existingId)
    : await s.from("feasibility_reviews").insert(payload);
  await fail(error);
}

export async function reviewFeasibility(
  id: string,
  reviewerId: string,
  feedback: string | null,
  status: FeasibilityReview["status"]
): Promise<void> {
  const s = requireSupabase();
  const { error } = await s
    .from("feasibility_reviews")
    .update({ reviewer_id: reviewerId, reviewer_feedback: feedback, status })
    .eq("id", id);
  await fail(error);
}

/* ------------------------ prototype & user tests ------------------- */

export async function fetchPrototype(teamId: string): Promise<PrototypeTest | null> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("prototype_tests")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  await fail(error);
  return (data as PrototypeTest) ?? null;
}

export async function savePrototype(
  teamId: string,
  existingId: string | null,
  values: { solution_description: string; test_plan: string; iterations?: string }
): Promise<PrototypeTest> {
  const s = requireSupabase();
  const { data, error } = existingId
    ? await s.from("prototype_tests").update(values).eq("id", existingId).select().single()
    : await s.from("prototype_tests").insert({ team_id: teamId, ...values }).select().single();
  await fail(error);
  return data as PrototypeTest;
}

export async function reviewPrototype(
  id: string,
  reviewerId: string,
  feedback: string | null,
  status: PrototypeTest["status"],
  decision: PrototypeTest["decision"]
): Promise<void> {
  const s = requireSupabase();
  const { error } = await s
    .from("prototype_tests")
    .update({ reviewer_id: reviewerId, reviewer_feedback: feedback, status, decision })
    .eq("id", id);
  await fail(error);
}

export async function fetchUserTests(testId: string): Promise<UserTest[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("user_tests")
    .select("*")
    .eq("test_id", testId)
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as UserTest[];
}

export async function createUserTest(values: Omit<UserTest, "id" | "created_at">): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("user_tests").insert(values);
  await fail(error);
}

/* ---------------------------- proof cards -------------------------- */

export interface ProofCardFull extends ProofCard {
  skills: ProofCardSkill[];
  team: (Team & { problem: Problem | null }) | null;
}

export async function listMyCards(userId: string): Promise<ProofCard[]> {
  const s = requireSupabase();
  // Cards across teams this user belongs to
  const { data: memberships, error: memErr } = await s
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId);
  await fail(memErr);
  const ids = ((memberships ?? []) as { team_id: string }[]).map((m) => m.team_id);
  if (ids.length === 0) return [];
  const { data, error } = await s
    .from("proof_cards")
    .select("*")
    .in("team_id", ids)
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as ProofCard[];
}

export async function fetchCard(id: string): Promise<ProofCardFull | null> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("proof_cards")
    .select("*, skills:proof_card_skills(*), team:teams(*, problem:problems(*))")
    .eq("id", id)
    .maybeSingle();
  await fail(error);
  return (data as ProofCardFull) ?? null;
}

export async function listPublicCards(): Promise<ProofCard[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("proof_cards")
    .select("*")
    .eq("visibility", "public")
    .in("review_status", ["approved", "published"])
    .order("published_at", { ascending: false, nullsFirst: false });
  await fail(error);
  return (data ?? []) as ProofCard[];
}

export async function listAllCardsForReview(): Promise<ProofCard[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("proof_cards")
    .select("*")
    .order("updated_at", { ascending: false });
  await fail(error);
  return (data ?? []) as ProofCard[];
}

export async function createCard(values: {
  team_id: string;
  title: string;
  problem_title: string;
  problem_summary: string;
  validation_summary: string;
  feasibility_summary?: string;
  built_summary?: string;
  results_limitations?: string;
}): Promise<ProofCard> {
  const s = requireSupabase();
  const { data, error } = await s.from("proof_cards").insert(values).select().single();
  await fail(error);
  return data as ProofCard;
}

export async function updateCard(id: string, values: Record<string, unknown>): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("proof_cards").update(values).eq("id", id);
  await fail(error);
}

export async function setCardSkills(cardId: string, skills: { skill: string; evidence_summary: string }[]): Promise<void> {
  const s = requireSupabase();
  // Replace set — small, safe.
  const { error: delErr } = await s.from("proof_card_skills").delete().eq("card_id", cardId);
  await fail(delErr);
  if (skills.length > 0) {
    const { error } = await s
      .from("proof_card_skills")
      .insert(skills.map((sk) => ({ card_id: cardId, skill: sk.skill, evidence_summary: sk.evidence_summary })));
    await fail(error);
  }
}

/* ------------------------- mentors / comments ---------------------- */

export async function fetchMentorAssignments(teamId: string|null): Promise<MentorAssignment[]> {
  const s = requireSupabase();
  const q = s.from("mentor_assignments").select("*").eq("active", true);
  const { data, error } = teamId ? await q.eq("team_id", teamId) : await q;
  await fail(error);
  return (data ?? []) as MentorAssignment[];
}

export async function fetchMyMentorTeams(userId: string): Promise<Team[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("mentor_assignments")
    .select("team_id, teams(*)")
    .eq("mentor_id", userId)
    .eq("active", true);
  await fail(error);
  const rows = (data ?? []) as unknown as { team_id: string; teams: Team | null }[];
  return rows.map((r) => r.teams).filter((t): t is Team => t !== null);
}

export async function assignMentor(team_id: string, mentor_id: string, assigned_by: string): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("mentor_assignments").insert({ team_id, mentor_id, assigned_by });
  await fail(error);
}

export async function fetchComments(teamId: string, audience: Comment["audience"] | null): Promise<(Comment & { profile: Profile | null })[]> {
  const s = requireSupabase();
  const q = s
    .from("comments")
    .select("*, profile:profiles!comments_author_id_fkey(*)")
    .eq("team_id", teamId)
    .order("created_at");
  const { data, error } = audience ? await q.eq("audience", audience) : await q;
  await fail(error);
  return (data ?? []) as (Comment & { profile: Profile | null })[];
}

export async function addComment(team_id: string, author_id: string, body: string, audience: Comment["audience"]): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("comments").insert({ team_id, author_id, body, audience });
  await fail(error);
}

/* --------------------------- notifications ------------------------- */

export async function listNotifications(userId: string): Promise<Notification[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  await fail(error);
  return (data ?? []) as Notification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("notifications").update({ read: true }).eq("id", id);
  await fail(error);
}

export async function sendNotification(values: Omit<Notification, "id" | "read" | "created_at">): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("notifications").insert({ ...values, read: false });
  // Non-fatal: UI should never break because a notification failed.
  if (error) console.warn("notification not delivered:", error.message);
}

/* ------------------------------ admin ------------------------------ */

export async function listRoles(userId?: string): Promise<(UserRole & { profile: Profile | null })[]> {
  const s = requireSupabase();
  let q = s
    .from("user_roles")
    .select("*, profile:profiles!user_roles_user_id_fkey(*)")
    .order("granted_at", { ascending: false });
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  await fail(error);
  return (data ?? []) as (UserRole & { profile: Profile | null })[];
}

export async function grantRole(
  user_id: string,
  role: UserRole["role"],
  institution_id: string | null,
  granted_by: string
): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("user_roles").insert({ user_id, role, institution_id, granted_by });
  await fail(error);
}

export async function revokeRole(user_id: string, role: UserRole["role"]): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("user_roles").delete().eq("user_id", user_id).eq("role", role);
  await fail(error);
}

export async function fetchScreenings(problemId: string): Promise<ProblemScreening[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("problem_screenings")
    .select("*")
    .eq("problem_id", problemId)
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as ProblemScreening[];
}

export async function listAuditLogs(): Promise<AuditLog[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  await fail(error);
  return (data ?? []) as AuditLog[];
}

export async function writeAuditLog(
  actor_id: string | null,
  action: string,
  entity: string,
  entity_id: string | null,
  details?: Record<string, unknown>
): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("audit_logs").insert({ actor_id, action, entity, entity_id, details });
  if (error) console.warn("audit log not written:", error.message);
}

/* ==================================================================== */
/*  0003 — platform domains (RLS enforces every rule below; the client   */
/*  just talks to Postgres and surfaces errors)                         */
/* ==================================================================== */

/* ------------------------ organizations --------------------------- */

export async function registerOrganization(
  values: { name: string; kind: Organization["kind"]; description?: string; website_url?: string; city?: string },
  userId: string
): Promise<Organization> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("organizations")
    .insert({ ...values, created_by: userId })
    .select()
    .single();
  await fail(error);
  const org = data as Organization;
  // Registration self-membership: the org creator becomes its owner.
  const { error: mErr } = await s
    .from("organization_members")
    .insert({ organization_id: org.id, user_id: userId, org_role: "owner" });
  await fail(mErr);
  return org;
}

export async function listMyOrganizations(userId: string): Promise<(Organization & { org_role: OrgRole })[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("organization_members")
    .select("org_role, organization:organizations(*)")
    .eq("user_id", userId);
  await fail(error);
  return ((data ?? []) as unknown as { org_role: OrgRole; organization: Organization | null }[]).map(
    (row) => ({ ...(row.organization as Organization), org_role: row.org_role })
  );
}

export async function fetchOrganization(id: string): Promise<Organization | null> {
  const s = requireSupabase();
  const { data, error } = await s.from("organizations").select("*").eq("id", id).maybeSingle();
  await fail(error);
  return (data as Organization) ?? null;
}

/** Every organisation (organisations are publicly readable; the admin verification queue uses this). */
export async function listAllOrganizations(): Promise<Organization[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  await fail(error);
  return (data ?? []) as Organization[];
}

export async function fetchOrganizationRoster(orgId: string): Promise<(OrganizationMember & { profile: Profile | null })[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("organization_members")
    .select("*, profile:profiles(*)")
    .eq("organization_id", orgId)
    .order("created_at");
  await fail(error);
  return (data ?? []) as (OrganizationMember & { profile: Profile | null })[];
}

/** Platform admin action (RLS enforces it — org staff cannot verify themselves). */
export async function setOrganizationVerification(id: string, status: Organization["verification_status"]): Promise<void> {
  const s = requireSupabase();
  const patch: Record<string, unknown> = { verification_status: status };
  const { error } = await s.from("organizations").update(patch).eq("id", id);
  await fail(error);
}

/** Org staff may add plain members; owner/representative rows remain an admin grant. */
export async function addOrganizationMember(orgId: string, userId: string): Promise<void> {
  const s = requireSupabase();
  const { error } = await s
    .from("organization_members")
    .insert({ organization_id: orgId, user_id: userId, org_role: "member" });
  await fail(error);
}

export async function removeOrganizationMember(id: string): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("organization_members").delete().eq("id", id);
  await fail(error);
}

/* ------------------- team roles & applications -------------------- */

export async function listRoleRequirements(teamId: string): Promise<TeamRoleRequirement[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("team_role_requirements")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at");
  await fail(error);
  return (data ?? []) as TeamRoleRequirement[];
}

/** Replace-all under one call; team editors manage seat counts explicitly. */
export async function setRoleRequirements(
  teamId: string,
  rows: { skill: string; seats: number; note?: string }[]
): Promise<void> {
  const s = requireSupabase();
  const del = await s.from("team_role_requirements").delete().eq("team_id", teamId);
  await fail(del.error);
  if (rows.length === 0) return;
  const ins = await s
    .from("team_role_requirements")
    .insert(rows.map((r) => ({ team_id: teamId, skill: r.skill, seats: r.seats, note: r.note ?? null, filled_seats: 0 })));
  await fail(ins.error);
}

export async function applyToTeam(
  teamId: string,
  userId: string,
  roleNeeded: string | null,
  message: string | null
): Promise<void> {
  const s = requireSupabase();
  const { error } = await s
    .from("team_applications")
    .insert({ team_id: teamId, user_id: userId, role_needed: roleNeeded, message: message });
  await fail(error);
}

export async function listTeamApplications(teamId: string): Promise<(TeamApplication & { profile: Profile | null })[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("team_applications")
    .select("*, profile:profiles(*)")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as (TeamApplication & { profile: Profile | null })[];
}

export async function decideTeamApplication(
  id: string,
  status: TeamApplication["status"],
  decidedBy: string
): Promise<void> {
  const s = requireSupabase();
  const { error } = await s
    .from("team_applications")
    .update({ status, decided_by: decidedBy })
    .eq("id", id);
  await fail(error);
}

/* --------------------- milestones & tasks ------------------------- */

export async function listMilestones(teamId: string): Promise<ProjectMilestone[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("project_milestones")
    .select("*")
    .eq("team_id", teamId)
    .order("due_date", { ascending: true, nullsFirst: false });
  await fail(error);
  return (data ?? []) as ProjectMilestone[];
}

export async function createMilestone(values: {
  team_id: string;
  title: string;
  due_date?: string | null;
  deliverable_note?: string | null;
}): Promise<ProjectMilestone> {
  const s = requireSupabase();
  const { data, error } = await s.from("project_milestones").insert(values).select().single();
  await fail(error);
  return data as ProjectMilestone;
}

export async function updateMilestone(id: string, patch: Partial<ProjectMilestone>): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("project_milestones").update(patch).eq("id", id);
  await fail(error);
}

export async function deleteMilestone(id: string): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("project_milestones").delete().eq("id", id);
  await fail(error);
}

export async function listTasks(teamId: string): Promise<(ProjectTask & { assignee_profile: Profile | null })[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("project_tasks")
    .select("*, assignee_profile:assignee(id, full_name, email)")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });
  await fail(error);
  return (data ?? []) as (ProjectTask & { assignee_profile: Profile | null })[];
}

export async function createTask(values: {
  team_id: string;
  title: string;
  milestone_id?: string | null;
  assignee?: string | null;
  notes?: string | null;
}): Promise<ProjectTask> {
  const s = requireSupabase();
  const { data, error } = await s.from("project_tasks").insert(values).select().single();
  await fail(error);
  return data as ProjectTask;
}

/** Assignee may progress their own task; editors manage anything (RLS). */
export async function updateTask(id: string, patch: Partial<ProjectTask>): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("project_tasks").update(patch).eq("id", id);
  await fail(error);
}

export async function deleteTask(id: string): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("project_tasks").delete().eq("id", id);
  await fail(error);
}

/* ----------------------- company projects ------------------------- */

export async function listCompanyProjects(): Promise<CompanyProject[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("company_projects")
    .select("*, organization:organizations(name, kind, verification_status)")
    .neq("status", "draft")
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as CompanyProject[];
}

export async function listOrgCompanyProjects(orgId: string): Promise<CompanyProject[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("company_projects")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as CompanyProject[];
}

export async function createCompanyProject(values: Omit<CompanyProject, "id" | "created_at">): Promise<CompanyProject> {
  const s = requireSupabase();
  const { data, error } = await s.from("company_projects").insert(values).select().single();
  await fail(error);
  return data as CompanyProject;
}

/** RLS: organisation staff only; drafts stay hidden until listed. */
export async function updateCompanyProject(id: string, patch: Partial<CompanyProject>): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("company_projects").update(patch).eq("id", id);
  await fail(error);
}

/* ---------------------- payment milestones ------------------------ */

export async function listPaymentMilestones(projectId: string): Promise<PaymentMilestone[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("payment_milestones")
    .select("*")
    .eq("company_project_id", projectId)
    .order("due_date", { ascending: true, nullsFirst: false });
  await fail(error);
  return (data ?? []) as PaymentMilestone[];
}

export async function createPaymentMilestone(values: {
  company_project_id: string;
  title: string;
  amount_cents: number;
  due_date?: string | null;
  currency?: string;
}): Promise<PaymentMilestone> {
  const s = requireSupabase();
  const { data, error } = await s.from("payment_milestones").insert(values).select().single();
  await fail(error);
  return data as PaymentMilestone;
}

/**
 * Records a payment status change. The guard trigger rejects unauthorised
 * `paid` transitions — organisations cannot mark payments paid without the
 * ownership chain, and students can never mark their own payment paid.
 */
export async function updatePaymentMilestone(
  id: string,
  patch: Partial<Pick<PaymentMilestone, "status" | "paid_reference" | "due_date" | "title">>
): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("payment_milestones").update(patch).eq("id", id);
  await fail(error);
}

/* --------------------------- solutions ---------------------------- */

export async function listSolutions(): Promise<Solution[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("solutions")
    .select("*, team:teams(name)")
    .eq("exposure", "listed")
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as Solution[];
}

/** Team workspace view: every solution the team's permission chain can see. */
export async function listTeamSolutions(teamId: string): Promise<Solution[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("solutions")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as Solution[];
}

export async function createSolution(
  values: Omit<Solution, "id" | "created_at"> & { created_by: string }
): Promise<Solution> {
  const s = requireSupabase();
  const { data, error } = await s.from("solutions").insert(values).select().single();
  await fail(error);
  return data as Solution;
}

export async function updateSolution(id: string, patch: Partial<Solution>): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("solutions").update(patch).eq("id", id);
  await fail(error);
}

export async function expressSolutionInterest(
  solutionId: string,
  userId: string,
  interestType: SolutionInterest["interest_type"],
  message: string | null
): Promise<void> {
  const s = requireSupabase();
  const { error } = await s
    .from("solution_interests")
    .upsert(
      { solution_id: solutionId, user_id: userId, interest_type: interestType, message, status: "new" },
      { onConflict: "solution_id,user_id,interest_type" }
    );
  await fail(error);
}

export async function listSolutionInterests(solutionId: string): Promise<(SolutionInterest & { profile: Profile | null })[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("solution_interests")
    .select("*, profile:profiles(*)")
    .eq("solution_id", solutionId)
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as (SolutionInterest & { profile: Profile | null })[];
}

export async function updateInterestStatus(id: string, status: SolutionInterest["status"]): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("solution_interests").update({ status }).eq("id", id);
  await fail(error);
}

export async function listTransferAgreements(solutionId: string): Promise<SolutionTransferAgreement[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("solution_transfer_agreements")
    .select("*")
    .eq("solution_id", solutionId)
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as SolutionTransferAgreement[];
}

export async function proposeTransferAgreement(
  values: Omit<SolutionTransferAgreement, "id" | "created_at" | "executed_at">
): Promise<SolutionTransferAgreement> {
  const s = requireSupabase();
  const { data, error } = await s.from("solution_transfer_agreements").insert(values).select().single();
  await fail(error);
  return data as SolutionTransferAgreement;
}

export async function updateTransferAgreement(
  id: string,
  patch: Partial<Pick<SolutionTransferAgreement, "status" | "agreed_by_creator" | "agreed_by_other" | "terms" | "compensation_note" | "creator_rights_note" | "attribution_keeping">>
): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("solution_transfer_agreements").update(patch).eq("id", id);
  await fail(error);
}

/* ----------------------------- funding ---------------------------- */

export async function listFundingOpportunities(): Promise<FundingOpportunity[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("funding_opportunities")
    .select("*, organization:organizations(name, verification_status)")
    .neq("status", "closed")
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as FundingOpportunity[];
}

export async function createFundingOpportunity(
  values: Omit<FundingOpportunity, "id" | "created_at" | "verification_status">
): Promise<FundingOpportunity> {
  const s = requireSupabase();
  const { data, error } = await s.from("funding_opportunities").insert(values).select().single();
  await fail(error);
  return data as FundingOpportunity;
}

export async function updateFundingOpportunity(id: string, patch: Partial<FundingOpportunity>): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("funding_opportunities").update(patch).eq("id", id);
  await fail(error);
}

export async function applyForFunding(values: {
  opportunity_id: string;
  applicant: string;
  applicant_team?: string | null;
  pitch: string;
  requested_amount?: number | null;
}): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("funding_applications").insert(values);
  await fail(error);
}

export async function listFundingApplications(opportunityId: string): Promise<(FundingApplication & { profile: Profile | null })[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("funding_applications")
    .select("*, profile:profiles(*)")
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as (FundingApplication & { profile: Profile | null })[];
}

/** Funder-side decision; applicants can never self-approve (RLS + policy). */
export async function decideFundingApplication(
  id: string,
  status: FundingApplication["status"]
): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("funding_applications").update({ status }).eq("id", id);
  await fail(error);
}

/* ----------------------------- hardware --------------------------- */

export async function listMyHardware(teamIds: string[]): Promise<HardwareProject[]> {
  if (teamIds.length === 0) return [];
  const s = requireSupabase();
  const { data, error } = await s
    .from("hardware_projects")
    .select("*")
    .in("team_id", teamIds)
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as HardwareProject[];
}

export async function createHardwareProject(
  values: Omit<HardwareProject, "id" | "created_at"> & { created_by: string }
): Promise<HardwareProject> {
  const s = requireSupabase();
  const { data, error } = await s.from("hardware_projects").insert(values).select().single();
  await fail(error);
  return data as HardwareProject;
}

export async function updateHardwareProject(id: string, patch: Partial<HardwareProject>): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("hardware_projects").update(patch).eq("id", id);
  await fail(error);
}

/* ---------------------------- opportunities ------------------------ */

export async function listOpportunities(): Promise<JobOpportunity[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("job_opportunities")
    .select("*, organization:organizations(name, verification_status)")
    .neq("status", "closed")
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as JobOpportunity[];
}

export async function createOpportunity(
  values: Omit<JobOpportunity, "id" | "created_at" | "verification_status">
): Promise<JobOpportunity> {
  const s = requireSupabase();
  const { data, error } = await s.from("job_opportunities").insert(values).select().single();
  await fail(error);
  return data as JobOpportunity;
}

export async function updateOpportunity(id: string, patch: Partial<JobOpportunity>): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("job_opportunities").update(patch).eq("id", id);
  await fail(error);
}

export async function applyToOpportunity(values: {
  opportunity_id: string;
  user_id: string;
  evidence_note?: string | null;
  proof_card_id?: string | null;
}): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("opportunity_applications").insert(values);
  await fail(error);
}

export async function listOpportunityApplications(
  opportunityId: string
): Promise<(OpportunityApplication & { profile: Profile | null })[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("opportunity_applications")
    .select("*, profile:profiles(*)")
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as (OpportunityApplication & { profile: Profile | null })[];
}

export async function decideOpportunityApplication(
  id: string,
  status: OpportunityApplication["status"]
): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("opportunity_applications").update({ status }).eq("id", id);
  await fail(error);
}

/** Applicants may only withdraw before review (RLS restricts to 'submitted'). */
export async function withdrawOpportunityApplication(id: string): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("opportunity_applications").delete().eq("id", id);
  await fail(error);
}

export async function listMyOpportunityApplications(userId: string): Promise<(OpportunityApplication & { opportunity: JobOpportunity | null })[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("opportunity_applications")
    .select("*, opportunity:job_opportunities(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as (OpportunityApplication & { opportunity: JobOpportunity | null })[];
}

/** Hiring-side view: all applications to one organisation's opportunities. */
export async function listOrgOpportunityApplications(
  orgId: string
): Promise<(OpportunityApplication & { opportunity: JobOpportunity | null; profile: Profile | null })[]> {
  const s = requireSupabase();
  const { data: jobs, error: jobErr } = await s
    .from("job_opportunities")
    .select("id")
    .eq("organization_id", orgId);
  await fail(jobErr);
  const ids = ((jobs ?? []) as { id: string }[]).map((j) => j.id);
  if (ids.length === 0) return [];
  const { data, error } = await s
    .from("opportunity_applications")
    .select("*, opportunity:job_opportunities(*), profile:profiles(*)")
    .in("opportunity_id", ids)
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as (OpportunityApplication & { opportunity: JobOpportunity | null; profile: Profile | null })[];
}

/* ------------------------- structured reviews --------------------- */

export async function assignReviewer(values: {
  subject_type: ReviewAssignment["subject_type"];
  subject_id: string;
  reviewer_type: ReviewAssignment["reviewer_type"];
  reviewer_id: string;
  assigned_by: string;
  due_date?: string | null;
}): Promise<ReviewAssignment> {
  const s = requireSupabase();
  const { data, error } = await s.from("review_assignments").insert(values).select().single();
  await fail(error);
  return data as ReviewAssignment;
}

export async function listReviewAssignments(
  subjectType: ReviewAssignment["subject_type"],
  subjectId: string
): Promise<ReviewAssignment[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("review_assignments")
    .select("*")
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as ReviewAssignment[];
}

export async function listMyReviewAssignments(userId: string): Promise<ReviewAssignment[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("review_assignments")
    .select("*")
    .eq("reviewer_id", userId)
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as ReviewAssignment[];
}

export async function updateReviewAssignment(id: string, patch: Partial<ReviewAssignment>): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("review_assignments").update(patch).eq("id", id);
  await fail(error);
}

export async function submitReviewRecord(values: {
  assignment_id: string;
  dimensions: ReviewRecord["dimensions"];
  verdict: ReviewRecord["verdict"];
  feedback: string;
}): Promise<ReviewRecord> {
  const s = requireSupabase();
  const { data, error } = await s.from("review_records").insert(values).select().single();
  await fail(error);
  return data as ReviewRecord;
}

export async function listReviewRecords(assignmentIds: string[]): Promise<ReviewRecord[]> {
  if (assignmentIds.length === 0) return [];
  const s = requireSupabase();
  const { data, error } = await s
    .from("review_records")
    .select("*")
    .in("assignment_id", assignmentIds)
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as ReviewRecord[];
}

/** Platform-admin-only flag flip; the guard trigger authorises it server-side. */
export async function setReviewRecordVerification(id: string, verified: boolean): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("review_records").update({ verified }).eq("id", id);
  await fail(error);
}

/** Admin integrity queue — RLS lets a platform admin read every assignment. */
export async function listAllReviewAssignments(): Promise<(ReviewAssignment & { record: ReviewRecord | null })[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("review_assignments")
    .select("*, record:review_records(*)")
    .order("created_at", { ascending: false })
    .limit(50);
  await fail(error);
  return ((data ?? []) as unknown as (ReviewAssignment & { record: ReviewRecord[] | null })[]).map((row) => ({
    ...row,
    record: row.record && row.record.length > 0 ? row.record[0] ?? null : null,
  }));
}

/* ----------------------- proof contributions ---------------------- */

export async function listContributions(cardId: string): Promise<ProofContribution[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("proof_contributions")
    .select("*")
    .eq("card_id", cardId)
    .order("created_at");
  await fail(error);
  return (data ?? []) as ProofContribution[];
}

export async function addContribution(values: {
  card_id: string;
  user_id: string;
  contribution: string;
  deliverable_links?: string[];
  outcome_note?: string | null;
  paid?: boolean;
  kind?: ProofContribution["kind"];
}): Promise<ProofContribution> {
  const s = requireSupabase();
  const { data, error } = await s.from("proof_contributions").insert(values).select().single();
  await fail(error);
  return data as ProofContribution;
}

export async function deleteContribution(id: string): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("proof_contributions").delete().eq("id", id);
  await fail(error);
}

/* --------------------------- content reports ---------------------- */

export async function reportContent(values: {
  reporter: string;
  subject_type: ContentReport["subject_type"];
  subject_id: string;
  reason: ContentReport["reason"];
  detail?: string | null;
}): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("content_reports").insert(values);
  await fail(error);
}

export async function listOpenReports(): Promise<(ContentReport & { profile: Profile | null })[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("content_reports")
    .select("*, profile:profiles(*)")
    .in("status", ["open", "reviewed"])
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as (ContentReport & { profile: Profile | null })[];
}

export async function updateReportStatus(
  id: string,
  status: ContentReport["status"],
  handledBy: string
): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("content_reports").update({ status, handled_by: handledBy }).eq("id", id);
  await fail(error);
}

/* ---------------------------- storage ------------------------------ */

export async function listEvidence(teamId: string): Promise<EvidenceAttachment[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("evidence_attachments")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as EvidenceAttachment[];
}

export async function uploadEvidence(
  teamId: string,
  stage: EvidenceAttachment["stage"],
  visibility: EvidenceAttachment["visibility"],
  uploadedBy: string,
  file: File
) {
  const s = requireSupabase();
  const path = `${teamId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
  const { error: upErr } = await s.storage
    .from("evidence")
    .upload(path, file, { upsert: false });
  await fail(upErr);
  const { data: rec, error: recErr } = await s
    .from("evidence_attachments")
    .insert({
      team_id: teamId,
      stage,
      visibility,
      uploaded_by: uploadedBy,
      file_name: file.name,
      file_path: path,
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select()
    .single();
  await fail(recErr);
  return rec as EvidenceAttachment;
}

/** Signed URL valid for a short window; files stay private in storage. */
export async function evidenceDownloadUrl(filePath: string): Promise<string> {
  const s = requireSupabase();
  const { data, error } = await s.storage.from("evidence").createSignedUrl(filePath, 300);
  await fail(error);
  return data?.signedUrl ?? "";
}

export async function deleteEvidence(filePath: string, id: string): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.storage.from("evidence").remove([filePath]);
  if (error) console.warn("storage delete failed:", error.message);
  const recErr = await s.from("evidence_attachments").delete().eq("id", id);
  await fail(recErr.error);
}

/* ==================================================================== */
/*  0004 — college events. RLS + storage policies enforce every rule;   */
/*  the client never sends created_by on update and never invents ids.  */
/* ==================================================================== */

/** Dedicated PUBLIC bucket for published event posters (see 0004_events.sql).
 * Server-enforced: 5 MiB max, JPEG/PNG/WebP only. Nothing confidential
 * belongs in this bucket. The private "evidence" bucket is untouched. */
export const EVENT_POSTERS_BUCKET = "event_posters";

/** Uploads a poster into the creator's own first path segment, mirroring the
 * evidence convention: "{auth_uid}/{uuid}-{filename}". Returns the path. */
export async function uploadEventPoster(userId: string, file: File): Promise<string> {
  const s = requireSupabase();
  const path = `${userId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
  const { error: upErr } = await s.storage
    .from(EVENT_POSTERS_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });
  await fail(upErr);
  return path;
}

/** Public poster URL (public bucket, no signed URLs needed). */
export function eventPosterPublicUrl(posterPath: string): string {
  const s = requireSupabase();
  return s.storage.from(EVENT_POSTERS_BUCKET).getPublicUrl(posterPath).data.publicUrl;
}

export interface CreateEventValues {
  title: string;
  event_type: string;
  institution_name: string;
  city: string;
  state_name: string;
  start_date: string;
  end_date: string;
  poster_path: string;
  contact_number?: string | null;
  venue?: string | null;
  description?: string | null;
  registration_url?: string | null;
  contact_name?: string | null;
  schedule_note?: string | null;
  status?: string;
}

export async function createEvent(values: CreateEventValues, created_by: string): Promise<EventRow> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("events")
    .insert({ ...values, created_by })
    .select()
    .single();
  await fail(error);
  return data as EventRow;
}

/** Patch an event. created_by is ALWAYS stripped — ownership can never be
 * moved through the API, and RLS with-check would reject it anyway. */
export async function updateEvent(
  id: string,
  patch: Partial<CreateEventValues> & { status?: EventStatus }
): Promise<void> {
  const s = requireSupabase();
  const { created_by: _ignored, ...rest } = patch as Record<string, unknown>;
  const { error } = await s.from("events").update(rest).eq("id", id);
  await fail(error);
}

/** Publish / unpublish / cancel. RLS restricts transitions to the creator
 * (or a platform admin) server-side. */
export async function setEventStatus(id: string, status: EventStatus): Promise<void> {
  await updateEvent(id, { status });
}

/** Deletes the row first (RLS-verified), then best-effort cleans up the poster. */
export async function deleteEvent(id: string, posterPath: string): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("events").delete().eq("id", id);
  await fail(error);
  // Only succeeds for the caller's own folder (folder-scoped storage policy).
  const { error: rmErr } = await s.storage.from(EVENT_POSTERS_BUCKET).remove([posterPath]);
  if (rmErr) console.warn("poster object cleanup failed:", rmErr.message);
}

export async function fetchEvent(id: string): Promise<EventRow | null> {
  const s = requireSupabase();
  const { data, error } = await s.from("events").select("*").eq("id", id).maybeSingle();
  await fail(error);
  return (data as EventRow) ?? null;
}

export interface EventFilters {
  q?: string; // searches title + institution name
  city?: string;
  stateName?: string;
  eventType?: string;
  /** upcoming = still ahead or ongoing; past = finished; all = everything. */
  when?: "upcoming" | "past" | "all";
  /** soonest = earliest start date first; newest = most recently added. */
  sort?: "soonest" | "newest";
  limit?: number;
}

/** Public discovery listing — RLS already restricts rows to status =
 * 'published' for everyone except the creator/admin, so no status filter
 * is duplicated here. */
export async function listEvents(filters: EventFilters = {}): Promise<EventRow[]> {
  const s = requireSupabase();
  let q = s.from("events").select("*");
  if (filters.q) {
    // Commas would break the or() grammar; they add nothing to a search.
    const term = filters.q.replace(/[,()]/g, " ").trim();
    if (term) {
      q = q.or(`title.ilike.%${term}%,institution_name.ilike.%${term}%`);
    }
  }
  if (filters.city) q = q.eq("city", filters.city);
  if (filters.stateName) q = q.eq("state_name", filters.stateName);
  if (filters.eventType) q = q.eq("event_type", filters.eventType);
  if (filters.when === "upcoming") q = q.gte("end_date", todayIso());
  else if (filters.when === "past") q = q.lt("end_date", todayIso());
  const ascending = (filters.sort ?? "soonest") === "soonest";
  if (ascending) q = q.order("start_date", { ascending: true });
  else q = q.order("created_at", { ascending: false });
  q = q.limit(filters.limit ?? 60);
  const { data, error } = await q;
  await fail(error);
  return (data ?? []) as EventRow[];
}

export async function listMyEvents(userId: string): Promise<EventRow[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("events")
    .select("*")
    .eq("created_by", userId)
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as EventRow[];
}

/** Local (not UTC) yyyy-mm-dd — "upcoming" is judged in the viewer's day. */
function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function errMessage(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}

export type { Err };

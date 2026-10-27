import { requireSupabase } from "./supabase";
import type {
  AuditLog,
  Cohort,
  CohortMember,
  Comment,
  EvidenceAttachment,
  FeasibilityReview,
  Institution,
  Interview,
  MentorAssignment,
  Notification,
  Problem,
  ProblemScreening,
  Profile,
  ProofCard,
  ProofCardSkill,
  PrototypeTest,
  Team,
  TeamDecision,
  TeamInvite,
  TeamMember,
  UserRole,
  UserTest,
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

export function errMessage(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}

export type { Err };

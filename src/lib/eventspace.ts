import { requireSupabase, getSupabase } from "./supabase";
import { sendNotification, writeAuditLog } from "./api";
import { slugify } from "./eventspaceRules";
import type {
  EsAnnouncementRow,
  EsAwardRow,
  EsEvaluationRow,
  EsEventOrganizerRow,
  EsEventRow,
  EsEventStaffRow,
  EsEventTeamMemberRow,
  EsEventTeamRow,
  EsJudgeAssignmentRow,
  EsPublicResultRow,
  EsPublicShowcaseRow,
  EsRegistrationRow,
  EsResultRow,
  EsRoundRow,
  EsShowcaseRow,
  EsSubmissionFileRow,
  EsSubmissionRow,
  Notification,
} from "../types/database";

/* ------------------------------------------------------------------ */
/*  EventSpace data layer (0015).                                      */
/*  Conventions follow lib/api.ts: requireSupabase, throw on error,    */
/*  RLS is authoritative — the client never sends created_by/owner     */
/*  ids the server can derive, and never widens access client-side.    */
/* ------------------------------------------------------------------ */

async function fail(e: { message: string } | null) {
  if (e) throw new Error(e.message);
}

/* ==================================================================== */
/*  Organiser applications                                              */
/* ==================================================================== */

export async function getMyOrganizerApplication(): Promise<EsEventOrganizerRow | null> {
  const s = requireSupabase();
  const { data, error } = await s.from("es_event_organizers").select("*").maybeSingle();
  await fail(error);
  return (data ?? null) as EsEventOrganizerRow | null;
}

export async function applyForOrganizer(values: {
  org_name: string;
  official_email: string;
  position: string;
  website?: string | null;
  reason: string;
  verification_notes?: string | null;
}): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("es_event_organizers").insert({
    org_name: values.org_name,
    official_email: values.official_email,
    position: values.position,
    website: values.website || null,
    reason: values.reason,
    verification_notes: values.verification_notes || null,
  });
  await fail(error);
}

export async function withdrawOrganizerApplication(): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.rpc("es_withdraw_organizer_application");
  await fail(error);
}

/** Platform-admin only (enforced server-side by the RPC). */
export async function listPendingOrganizerApplications(): Promise<EsEventOrganizerRow[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("es_event_organizers")
    .select("*")
    .order("created_at", { ascending: true });
  await fail(error);
  return (data ?? []) as EsEventOrganizerRow[];
}

export async function reviewOrganizerApplication(
  userId: string,
  decision: "approved" | "rejected" | "suspended",
  note?: string | null
): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.rpc("es_review_organizer", {
    p_user_id: userId,
    p_decision: decision,
    p_note: note ?? null,
  });
  await fail(error);
  await writeAuditLog(
    null,
    `es_review_organizer:${decision}`,
    "es_event_organizers",
    userId,
    { note: note ?? null }
  );
}

/* ==================================================================== */
/*  Events: CRUD + discovery                                            */
/* ==================================================================== */

export interface EsDiscoveryFilters {
  search?: string;
  category?: string;
  format?: string;
  city?: string;
  registrationOpen?: boolean;
  page?: number;
  pageSize?: number;
}

export interface EsDiscoveryPage {
  events: EsEventRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** Public discovery — only published + public events (anon + authenticated). */
export async function discoverEvents(filters: EsDiscoveryFilters = {}): Promise<EsDiscoveryPage> {
  const s = requireSupabase();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(24, Math.max(6, filters.pageSize ?? 12));
  const from = (page - 1) * pageSize;

  let q = s
    .from("es_events")
    .select("*", { count: "exact" })
    .eq("status", "published")
    .eq("visibility", "public")
    .order("featured", { ascending: false })
    .order("starts_at", { ascending: true })
    .range(from, from + pageSize - 1);

  if (filters.search) {
    q = q.or(
      `title.ilike.%${filters.search}%,short_description.ilike.%${filters.search}%,institution_name.ilike.%${filters.search}%`
    );
  }
  if (filters.category) q = q.eq("category", filters.category);
  if (filters.format) q = q.eq("format", filters.format);
  if (filters.city) q = q.ilike("city", `%${filters.city}%`);

  const { data, error, count } = await q;
  await fail(error);
  return { events: (data ?? []) as EsEventRow[], total: count ?? 0, page, pageSize };
}

/** Featured events row for the landing page. */
export async function listFeaturedEvents(limit = 3): Promise<EsEventRow[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("es_events")
    .select("*")
    .eq("status", "published")
    .eq("visibility", "public")
    .eq("featured", true)
    .order("starts_at", { ascending: true })
    .limit(limit);
  await fail(error);
  return (data ?? []) as EsEventRow[];
}

/** Public page by slug (works for unlisted too, via authenticated read). */
export async function getEventBySlug(slug: string): Promise<EsEventRow | null> {
  const s = getSupabase();
  if (!s) return null;
  const { data, error } = await s.from("es_events").select("*").eq("slug", slug).maybeSingle();
  if (error) {
    // RLS-hidden rows return error only on query failure; a null means either
    // missing or not visible to this viewer.
    if (error.code !== "PGRST116") throw new Error(error.message);
    return null;
  }
  return (data ?? null) as EsEventRow | null;
}

export async function listMyManagedEvents(): Promise<EsEventRow[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("es_events")
    .select("*")
    .order("updated_at", { ascending: false });
  await fail(error);
  return (data ?? []) as EsEventRow[];
}

export async function listMyRegistrations(): Promise<EsRegistrationRow[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("es_registrations")
    .select("*")
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as EsRegistrationRow[];
}

export async function getEventById(id: string): Promise<EsEventRow | null> {
  const s = requireSupabase();
  const { data, error } = await s.from("es_events").select("*").eq("id", id).maybeSingle();
  await fail(error);
  return (data ?? null) as EsEventRow | null;
}

/**
 * The wizard stores unset optional fields as "" in React state, but Postgres
 * cannot cast "" to timestamptz / url-check columns. Send NULL instead for
 * every nullable es_events column.
 */
const ES_EVENT_NULLABLE_FIELDS = [
  "full_description",
  "cover_path",
  "poster_path",
  "logo_path",
  "edition",
  "theme",
  "official_url",
  "venue",
  "city",
  "state_name",
  "country",
  "online_instructions",
  "map_url",
  "starts_at",
  "ends_at",
  "registration_opens_at",
  "registration_closes_at",
  "submission_opens_at",
  "submission_deadline",
  "judging_starts_at",
  "judging_ends_at",
  "results_at",
  "resubmit_until",
  "eligibility_years",
  "eligibility_departments",
  "eligibility_institutions",
  "eligibility_regions",
  "age_note",
  "registration_capacity",
  "registration_note",
  "confirmation_message",
  "rules",
  "submission_requirements",
  "originality_terms",
  "ip_terms",
  "late_submission_terms",
  "disqualification_terms",
  "contact_name",
  "contact_email",
  "contact_phone",
] as const;

function nullEmptyEventFields<T extends Record<string, unknown>>(payload: T): T {
  const out: Record<string, unknown> = { ...payload };
  for (const key of ES_EVENT_NULLABLE_FIELDS) {
    if (out[key] === "") out[key] = null;
  }
  return out as T;
}

export async function createEventDraft(
  values: Partial<EsEventRow> & { title: string; category: EsEventRow["category"]; institution_name: string }
): Promise<EsEventRow> {
  const s = requireSupabase();
  // slug is NOT NULL UNIQUE in the schema; the wizard only fills it when the
  // user types one, so default it from the title (mirrors the UI preview).
  const slug = values.slug && values.slug.trim() !== "" ? values.slug : slugify(values.title);
  const { data, error } = await s
    .from("es_events")
    .insert(nullEmptyEventFields({ ...values, slug, status: "draft" }))
    .select("*")
    .single();
  await fail(error);
  return data as EsEventRow;
}

export async function updateEvent(id: string, values: Partial<EsEventRow>): Promise<EsEventRow> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("es_events")
    .update(nullEmptyEventFields(values))
    .eq("id", id)
    .select("*")
    .single();
  await fail(error);
  return data as EsEventRow;
}

export async function deleteEventDraft(id: string): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("es_events").delete().eq("id", id);
  await fail(error);
}

/* ==================================================================== */
/*  Rounds / staff / teams                                              */
/* ==================================================================== */

export async function listRounds(eventId: string): Promise<EsRoundRow[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("es_event_rounds")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order");
  await fail(error);
  return (data ?? []) as EsRoundRow[];
}

export async function upsertRound(
  eventId: string,
  round: Partial<EsRoundRow> & { name: string }
): Promise<EsRoundRow> {
  const s = requireSupabase();
  if (round.id) {
    const { data, error } = await s
      .from("es_event_rounds")
      .update({ ...round, event_id: eventId })
      .eq("id", round.id)
      .select("*")
      .single();
    await fail(error);
    return data as EsRoundRow;
  }
  const { data, error } = await s
    .from("es_event_rounds")
    .insert({ ...round, event_id: eventId })
    .select("*")
    .single();
  await fail(error);
  return data as EsRoundRow;
}

export async function deleteRound(roundId: string): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("es_event_rounds").delete().eq("id", roundId);
  await fail(error);
}

export async function listEventStaff(eventId: string): Promise<EsEventStaffRow[]> {
  const s = requireSupabase();
  const { data, error } = await s.from("es_event_staff").select("*").eq("event_id", eventId);
  await fail(error);
  return (data ?? []) as EsEventStaffRow[];
}

export async function resolveInvitee(eventId: string, email: string) {
  const s = requireSupabase();
  const { data, error } = await s.rpc("es_resolve_invitee", {
    p_event_id: eventId,
    p_email: email.trim(),
  });
  await fail(error);
  const rows = (data ?? []) as Array<{ user_id: string; full_name: string }>;
  return rows[0] ?? null;
}

export async function addEventStaff(
  eventId: string,
  userId: string,
  role: "manager" | "judge",
  grantedBy: string
): Promise<void> {
  const s = requireSupabase();
  const { error } = await s
    .from("es_event_staff")
    .insert({ event_id: eventId, user_id: userId, role, granted_by: grantedBy });
  await fail(error);
}

export async function removeEventStaff(staffId: string): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("es_event_staff").delete().eq("id", staffId);
  await fail(error);
}

export async function listEventTeams(eventId: string): Promise<EsEventTeamRow[]> {
  const s = requireSupabase();
  const { data, error } = await s.from("es_event_teams").select("*").eq("event_id", eventId);
  await fail(error);
  return (data ?? []) as EsEventTeamRow[];
}

export async function listTeamMembers(teamId: string): Promise<EsEventTeamMemberRow[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("es_event_team_members")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at");
  await fail(error);
  return (data ?? []) as EsEventTeamMemberRow[];
}

/** My pending team invitations across all events (RLS scopes to own rows). */
export async function listMyTeamInvites(
  userId: string
): Promise<Array<EsEventTeamMemberRow & { team_name: string | null }>> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("es_event_team_members")
    .select("*, team_name:es_event_teams(name)")
    .eq("user_id", userId)
    .eq("status", "invited");
  await fail(error);
  return (data ?? []).map((r) => {
    const row = r as EsEventTeamMemberRow & { team_name?: { name: string } | null };
    return { ...row, team_name: row.team_name?.name ?? null };
  });
}

export async function createEventTeam(
  eventId: string,
  name: string,
  userId: string
): Promise<EsEventTeamRow> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("es_event_teams")
    .insert({ event_id: eventId, name, leader_user_id: userId, created_by: userId })
    .select("*")
    .single();
  await fail(error);
  const team = data as EsEventTeamRow;
  // The leader is added as the first active member (registration verified by trigger).
  const { error: memberError } = await s.from("es_event_team_members").insert({
    team_id: team.id,
    user_id: userId,
    member_role: "leader",
    status: "active",
    invited_by: userId,
    responded_at: new Date().toISOString(),
  });
  await fail(memberError);
  return team;
}

export async function inviteTeamMember(teamId: string, userId: string, invitedBy: string): Promise<void> {
  const s = requireSupabase();
  const { error } = await s
    .from("es_event_team_members")
    .insert({ team_id: teamId, user_id: userId, invited_by: invitedBy });
  await fail(error);
}

export async function respondTeamInvite(memberId: string, accept: boolean): Promise<void> {
  const s = requireSupabase();
  const { error } = await s
    .from("es_event_team_members")
    .update({ status: accept ? "active" : "declined", responded_at: new Date().toISOString() })
    .eq("id", memberId);
  await fail(error);
}

export async function removeTeamMember(memberId: string): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("es_event_team_members").delete().eq("id", memberId);
  await fail(error);
}

/* ==================================================================== */
/*  Registrations                                                       */
/* ==================================================================== */

export async function listEventRegistrations(eventId: string): Promise<EsRegistrationRow[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("es_registrations")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as EsRegistrationRow[];
}

export async function getMyRegistration(eventId: string): Promise<EsRegistrationRow | null> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("es_registrations")
    .select("*")
    .eq("event_id", eventId)
    .maybeSingle();
  await fail(error);
  return (data ?? null) as EsRegistrationRow | null;
}

export async function registerForEvent(
  eventId: string,
  participationType: "individual" | "team",
  teamId: string | null,
  answers: Array<{ label: string; answer: string }>
): Promise<EsRegistrationRow> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("es_registrations")
    .upsert(
      { event_id: eventId, participation_type: participationType, team_id: teamId, answers },
      { onConflict: "event_id,user_id" }
    )
    .select("*")
    .single();
  await fail(error);
  return data as EsRegistrationRow;
}

export async function setRegistrationStatus(
  registrationId: string,
  status: EsRegistrationRow["status"]
): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("es_registrations").update({ status }).eq("id", registrationId);
  await fail(error);
}

export async function countActiveRegistrations(eventId: string): Promise<number> {
  const s = requireSupabase();
  const { count, error } = await s
    .from("es_registrations")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId)
    .in("status", ["registered", "pending", "waitlisted"]);
  await fail(error);
  return count ?? 0;
}

/* ==================================================================== */
/*  Submissions + files                                                 */
/* ==================================================================== */

export async function listEventSubmissions(eventId: string): Promise<EsSubmissionRow[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("es_submissions")
    .select("*")
    .eq("event_id", eventId)
    .order("updated_at", { ascending: false });
  await fail(error);
  return (data ?? []) as EsSubmissionRow[];
}

export async function getMySubmission(
  eventId: string,
  userId: string
): Promise<EsSubmissionRow | null> {
  const s = requireSupabase();
  // Scope to the caller's own individual submission OR their event team's
  // submission — never another team's, even if RLS would permit it.
  const reg = await getMyRegistration(eventId);
  const orFilter = `owner_user_id.eq.${userId}${reg?.team_id ? `,team_id.eq.${reg.team_id}` : ""}`;
  const { data, error } = await s
    .from("es_submissions")
    .select("*")
    .eq("event_id", eventId)
    .or(orFilter)
    .maybeSingle();
  await fail(error);
  return (data ?? null) as EsSubmissionRow | null;
}

export async function getSubmission(id: string): Promise<EsSubmissionRow | null> {
  const s = requireSupabase();
  const { data, error } = await s.from("es_submissions").select("*").eq("id", id).maybeSingle();
  await fail(error);
  return (data ?? null) as EsSubmissionRow | null;
}

export async function createSubmissionDraft(values: {
  event_id: string;
  owner_type: "individual" | "team";
  owner_user_id: string;
  team_id: string | null;
}): Promise<EsSubmissionRow> {
  const s = requireSupabase();
  const { data, error } = await s.from("es_submissions").insert(values).select("*").single();
  await fail(error);
  return data as EsSubmissionRow;
}

export async function updateSubmission(
  id: string,
  values: Partial<EsSubmissionRow>
): Promise<EsSubmissionRow> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("es_submissions")
    .update(values)
    .eq("id", id)
    .select("*")
    .single();
  await fail(error);
  return data as EsSubmissionRow;
}

export async function deleteSubmissionDraft(id: string): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("es_submissions").delete().eq("id", id);
  await fail(error);
}

export async function listSubmissionSnapshots(submissionId: string) {
  const s = requireSupabase();
  const { data, error } = await s
    .from("es_submission_snapshots")
    .select("*")
    .eq("submission_id", submissionId)
    .order("version", { ascending: false });
  await fail(error);
  return data ?? [];
}

export async function listSubmissionFiles(submissionId: string): Promise<EsSubmissionFileRow[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("es_submission_files")
    .select("*")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as EsSubmissionFileRow[];
}

/**
 * Uploads to the PRIVATE es_submission_files bucket at
 * "es_submission_files/{submissionId}/{uuid}-{filename}" and records the row.
 * Type/size validation mirrors the bucket + check constraints.
 */
export async function uploadSubmissionFile(
  submissionId: string,
  uploadedBy: string,
  file: File,
  kind: EsSubmissionFileRow["kind"]
): Promise<EsSubmissionFileRow> {
  const s = requireSupabase();
  const safeName = file.name.replace(/[^\w.-]+/g, "_").slice(0, 180);
  const objectKey = `${submissionId}/${crypto.randomUUID()}-${safeName}`;
  const storagePath = `es_submission_files/${objectKey}`;
  const { error: upErr } = await s.storage.from("es_submission_files").upload(objectKey, file, {
    upsert: false,
  });
  await fail(upErr);
  const { data, error } = await s
    .from("es_submission_files")
    .insert({
      submission_id: submissionId,
      storage_path: storagePath,
      object_key: objectKey,
      file_name: file.name.slice(0, 200),
      mime_type: file.type,
      size_bytes: file.size,
      kind,
      uploaded_by: uploadedBy,
    })
    .select("*")
    .single();
  await fail(error);
  return data as EsSubmissionFileRow;
}

export async function submissionFileDownloadUrl(objectKey: string): Promise<string> {
  const s = requireSupabase();
  const { data, error } = await s.storage.from("es_submission_files").createSignedUrl(objectKey, 300);
  await fail(error);
  return data?.signedUrl ?? "";
}

export async function deleteSubmissionFile(fileRow: EsSubmissionFileRow): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.storage.from("es_submission_files").remove([fileRow.object_key]);
  if (error) console.warn("storage delete failed:", error.message);
  const recErr = await s.from("es_submission_files").delete().eq("id", fileRow.id);
  await fail(recErr.error);
}

/* ==================================================================== */
/*  Judging                                                             */
/* ==================================================================== */

export async function listMyJudgeAssignments(): Promise<EsJudgeAssignmentRow[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("es_judge_assignments")
    .select("*")
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as EsJudgeAssignmentRow[];
}

export async function listEventJudgeAssignments(eventId: string): Promise<EsJudgeAssignmentRow[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("es_judge_assignments")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as EsJudgeAssignmentRow[];
}

export async function assignJudge(
  eventId: string,
  judgeUserId: string,
  submissionId: string,
  assignedBy: string
): Promise<void> {
  const s = requireSupabase();
  const { error } = await s
    .from("es_judge_assignments")
    .insert({
      event_id: eventId,
      judge_user_id: judgeUserId,
      submission_id: submissionId,
      assigned_by: assignedBy,
    });
  await fail(error);
}

export async function removeJudgeAssignment(assignmentId: string): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("es_judge_assignments").delete().eq("id", assignmentId);
  await fail(error);
}

export async function getEvaluation(assignmentId: string): Promise<EsEvaluationRow | null> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("es_evaluations")
    .select("*")
    .eq("assignment_id", assignmentId)
    .maybeSingle();
  await fail(error);
  return (data ?? null) as EsEvaluationRow | null;
}

/**
 * Saves a judge evaluation. The server recomputes total_score from the event
 * rubric — the client never sends a total.
 */
export async function saveEvaluation(values: {
  assignment_id: string;
  scores: Array<{ criterion: string; score: number | null }>;
  private_notes?: string | null;
  feedback?: string | null;
  recommendation?: string | null;
  is_draft: boolean;
}): Promise<void> {
  const s = requireSupabase();
  const existing = await getEvaluation(values.assignment_id);
  const payload = {
    assignment_id: values.assignment_id,
    scores: values.scores,
    private_notes: values.private_notes ?? null,
    feedback: values.feedback ?? null,
    recommendation: values.recommendation ?? "none",
    is_draft: values.is_draft,
  };
  const { error } = existing
    ? await s.from("es_evaluations").update(payload).eq("assignment_id", values.assignment_id)
    : await s.from("es_evaluations").insert(payload);
  await fail(error);
}

export async function listEventEvaluations(eventId: string): Promise<EsEvaluationRow[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("es_evaluations")
    .select("*, assignment:es_judge_assignments!inner(event_id)")
    .eq("assignment.event_id", eventId);
  await fail(error);
  return (data ?? []) as unknown as EsEvaluationRow[];
}

/* ==================================================================== */
/*  Awards / results                                                    */
/* ==================================================================== */

export async function listAwards(eventId: string): Promise<EsAwardRow[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("es_awards")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order");
  await fail(error);
  return (data ?? []) as EsAwardRow[];
}

export async function upsertAward(
  eventId: string,
  award: Partial<EsAwardRow> & { name: string }
): Promise<EsAwardRow> {
  const s = requireSupabase();
  if (award.id) {
    const { data, error } = await s
      .from("es_awards")
      .update({ ...award, event_id: eventId })
      .eq("id", award.id)
      .select("*")
      .single();
    await fail(error);
    return data as EsAwardRow;
  }
  const { data, error } = await s
    .from("es_awards")
    .insert({ ...award, event_id: eventId })
    .select("*")
    .single();
  await fail(error);
  return data as EsAwardRow;
}

export async function deleteAward(awardId: string): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("es_awards").delete().eq("id", awardId);
  await fail(error);
}

export async function listEventResults(eventId: string): Promise<EsResultRow[]> {
  const s = requireSupabase();
  const { data, error } = await s.from("es_results").select("*").eq("event_id", eventId);
  await fail(error);
  return (data ?? []) as EsResultRow[];
}

export async function upsertResult(
  eventId: string,
  createdBy: string,
  result: Partial<EsResultRow> & { award_id: string; submission_id: string }
): Promise<EsResultRow> {
  const s = requireSupabase();
  if (result.id) {
    const { data, error } = await s
      .from("es_results")
      .update(result)
      .eq("id", result.id)
      .select("*")
      .single();
    await fail(error);
    return data as EsResultRow;
  }
  const { data, error } = await s
    .from("es_results")
    .insert({ ...result, event_id: eventId, created_by: createdBy })
    .select("*")
    .single();
  await fail(error);
  return data as EsResultRow;
}

export async function deleteResult(resultId: string): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("es_results").delete().eq("id", resultId);
  await fail(error);
}

/** Publishes / unpublishes the results set for an event (organiser action). */
export async function setResultsPublished(eventId: string, published: boolean): Promise<void> {
  const s = requireSupabase();
  const { error: evErr } = await s
    .from("es_events")
    .update({ results_published: published })
    .eq("id", eventId);
  await fail(evErr);
  if (published) {
    // Publish every recorded result row in one pass (organiser-only policy).
    const { error } = await s
      .from("es_results")
      .update({ published: true, published_at: new Date().toISOString() })
      .eq("event_id", eventId);
    await fail(error);
  }
}

/** Public results (security_invoker view — safe fields only). */
export async function listPublicResults(eventSlug: string): Promise<EsPublicResultRow[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("es_public_results")
    .select("*")
    .eq("event_slug", eventSlug)
    .order("award_category");
  await fail(error);
  return (data ?? []) as EsPublicResultRow[];
}

/* ==================================================================== */
/*  Announcements + notifications                                       */
/* ==================================================================== */

/**
 * Delivers announcement notifications server-side via the
 * es_notify_event_audience SECURITY DEFINER RPC (migration 0016). The
 * database verifies the caller's organiser permission for the event, derives
 * recipients from the event itself (no arbitrary ids) and RAISES on any
 * failure — delivery errors are never silently swallowed.
 */
export async function notifyEventAudience(values: {
  event_id: string;
  audience: "participants" | "judges" | "all";
  title: string;
  body?: string | null;
  link?: string | null;
}): Promise<number> {
  const s = requireSupabase();
  const { data, error } = await s.rpc("es_notify_event_audience", {
    p_event_id: values.event_id,
    p_audience: values.audience,
    p_title: values.title,
    p_body: values.body ?? null,
    p_link: values.link ?? null,
  });
  await fail(error);
  return typeof data === "number" ? data : 0;
}

export async function listAnnouncements(eventId: string): Promise<EsAnnouncementRow[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("es_announcements")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  await fail(error);
  return (data ?? []) as EsAnnouncementRow[];
}

export async function createAnnouncement(values: {
  event_id: string;
  title: string;
  body: string;
  audience: EsAnnouncementRow["audience"];
  created_by: string;
}): Promise<EsAnnouncementRow> {
  const s = requireSupabase();
  const { data, error } = await s.from("es_announcements").insert(values).select("*").single();
  await fail(error);
  return data as EsAnnouncementRow;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const s = requireSupabase();
  const { error } = await s.from("es_announcements").delete().eq("id", id);
  await fail(error);
}

/**
 * Sends an in-app notification to many users using the existing notification
 * architecture. NOTE: event announcements no longer use this loop — they use
 * notifyEventAudience (es_notify_event_audience RPC), which verifies organiser
 * permission and derives recipients server-side. Kept for any other caller;
 * its client-side loop remains a documented limitation.
 */
export async function notifyMany(
  userIds: string[],
  notification: Omit<Notification, "id" | "read" | "created_at" | "user_id">
): Promise<number> {
  let delivered = 0;
  for (const user_id of userIds) {
    try {
      await sendNotification({ ...notification, user_id });
      delivered += 1;
    } catch {
      // sendNotification already swallows + warns; keep going.
    }
  }
  return delivered;
}

/* ==================================================================== */
/*  Showcase                                                            */
/* ==================================================================== */

export async function getShowcaseForSubmission(submissionId: string): Promise<EsShowcaseRow | null> {
  const s = requireSupabase();
  const { data, error } = await s.from("es_showcases").select("*").eq("submission_id", submissionId).maybeSingle();
  await fail(error);
  return (data ?? null) as EsShowcaseRow | null;
}

export async function listEventShowcases(eventId: string): Promise<EsShowcaseRow[]> {
  const s = requireSupabase();
  const { data, error } = await s.from("es_showcases").select("*").eq("event_id", eventId);
  await fail(error);
  return (data ?? []) as EsShowcaseRow[];
}

export async function createShowcaseDraft(values: {
  event_id: string;
  submission_id: string;
  created_by: string;
  approved_title: string;
  approved_summary: string;
  approved_problem?: string | null;
  approved_solution?: string | null;
  team_attribution: Array<{ name: string; role?: string }>;
  approved_demo_url?: string | null;
  approved_github_url?: string | null;
}): Promise<EsShowcaseRow> {
  const s = requireSupabase();
  const { data, error } = await s.from("es_showcases").insert(values).select("*").single();
  await fail(error);
  return data as EsShowcaseRow;
}

export async function updateShowcase(id: string, values: Partial<EsShowcaseRow>): Promise<EsShowcaseRow> {
  const s = requireSupabase();
  const { data, error } = await s.from("es_showcases").update(values).eq("id", id).select("*").single();
  await fail(error);
  return data as EsShowcaseRow;
}

export async function approveShowcase(id: string): Promise<void> {
  await updateShowcase(id, { status: "owner_approved" });
}

export async function publishShowcase(id: string): Promise<void> {
  await updateShowcase(id, { status: "published" });
}

export async function unpublishShowcase(id: string): Promise<void> {
  await updateShowcase(id, { status: "unpublished" });
}

/** Public showcase list (security_invoker view — showcase-safe fields only). */
export async function listPublicShowcases(limit = 24): Promise<EsPublicShowcaseRow[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("es_public_showcases")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(limit);
  await fail(error);
  return (data ?? []) as EsPublicShowcaseRow[];
}

export async function listPublicShowcasesForEvent(eventSlug: string): Promise<EsPublicShowcaseRow[]> {
  const s = requireSupabase();
  const { data, error } = await s
    .from("es_public_showcases")
    .select("*")
    .eq("event_slug", eventSlug)
    .order("published_at", { ascending: false });
  await fail(error);
  return (data ?? []) as EsPublicShowcaseRow[];
}

/* ==================================================================== */
/*  Media helpers (public event_posters bucket)                         */
/* ==================================================================== */

export const MAX_EVENT_MEDIA_BYTES = 5 * 1024 * 1024;

/** Uploads event cover/poster/logo into the caller's own folder. */
export async function uploadEventMedia(
  createdBy: string,
  file: File,
  purpose: "cover" | "poster" | "logo"
): Promise<string> {
  const s = requireSupabase();
  const safeName = file.name.replace(/[^\w.-]+/g, "_").slice(0, 120);
  const path = `${createdBy}/${purpose}-${crypto.randomUUID()}-${safeName}`;
  const { error } = await s.storage.from("event_posters").upload(path, file, { upsert: false });
  await fail(error);
  return path;
}

export function eventMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const s = getSupabase();
  if (!s) return null;
  const { data } = s.storage.from("event_posters").getPublicUrl(path);
  return data?.publicUrl ?? null;
}

/* ==================================================================== */
/*  Analytics (real aggregates only, computed over RLS-visible rows)    */
/* ==================================================================== */

export interface EsEventAnalytics {
  registrations: number;
  pendingRegistrations: number;
  teams: number;
  submissions: number;
  submittedComplete: number;
  shortlisted: number;
  judgeAssignments: number;
  completedEvaluations: number;
}

export async function getEventAnalytics(eventId: string): Promise<EsEventAnalytics> {
  const s = requireSupabase();
  const [regs, pending, teams, subs, complete, shortlisted, assignments, evals] = await Promise.all([
    s.from("es_registrations").select("*", { count: "exact", head: true }).eq("event_id", eventId).in("status", ["registered", "pending", "waitlisted"]),
    s.from("es_registrations").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "pending"),
    s.from("es_event_teams").select("*", { count: "exact", head: true }).eq("event_id", eventId),
    s.from("es_submissions").select("*", { count: "exact", head: true }).eq("event_id", eventId).neq("status", "draft"),
    s.from("es_submissions").select("*", { count: "exact", head: true }).eq("event_id", eventId).in("status", ["submitted", "resubmitted", "under_review", "shortlisted", "accepted"]),
    s.from("es_submissions").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "shortlisted"),
    s.from("es_judge_assignments").select("*", { count: "exact", head: true }).eq("event_id", eventId).neq("status", "removed"),
    s.from("es_evaluations").select("*", { count: "exact", head: true }).eq("is_draft", false)
      .in("assignment_id", (await s.from("es_judge_assignments").select("id").eq("event_id", eventId)).data?.map((r) => r.id) ?? []),
  ]);
  await fail(regs.error || pending.error || teams.error || subs.error || complete.error || shortlisted.error || assignments.error || evals.error);
  return {
    registrations: regs.count ?? 0,
    pendingRegistrations: pending.count ?? 0,
    teams: teams.count ?? 0,
    submissions: subs.count ?? 0,
    submittedComplete: complete.count ?? 0,
    shortlisted: shortlisted.count ?? 0,
    judgeAssignments: assignments.count ?? 0,
    completedEvaluations: evals.count ?? 0,
  };
}

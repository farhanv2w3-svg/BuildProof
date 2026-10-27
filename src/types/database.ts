/* ------------------------------------------------------------------ */
/*  BuildProof database model (mirrors supabase/migrations)             */
/* ------------------------------------------------------------------ */

export type AppRole =
  | "student"
  | "facilitator"
  | "mentor"
  | "faculty_coordinator"
  | "problem_owner"
  | "institution_admin"
  | "platform_admin";

export type ProblemCategory =
  | "education"
  | "local_business"
  | "accessibility"
  | "sustainability"
  | "public_services"
  | "operations"
  | "technology"
  | "other";

export type ProblemStatus = "submitted" | "screening" | "approved" | "rejected" | "needs_info";

export type CohortStatus = "planning" | "active" | "completed";
export type CohortMemberStatus = "proposed" | "active" | "left" | "removed";
export type CohortRole = "student" | "facilitator" | "faculty_coordinator" | "mentor";

export type TeamStatus = "forming" | "active" | "paused" | "stopped" | "completed";
export type TeamMemberStatus = "proposed" | "accepted" | "left" | "removed";
export type InviteStatus = "pending" | "accepted" | "declined" | "revoked";

export type EvidenceStage = "validation" | "feasibility" | "prototype";
export type EvidenceVisibility = "team" | "reviewers";

export type WorkStatus = "draft" | "submitted" | "reviewed";
export type StageDecision = "continue" | "pivot" | "stop" | "revise";
export type FDecision = "continue" | "revise" | "stop";

export type ProofTier = 1 | 2 | 3;
export type ProofReviewStatus =
  | "draft"
  | "submitted"
  | "changes_requested"
  | "approved"
  | "published"
  | "rejected";
export type ProofVisibility = "private" | "public";

/* ----------------------------- rows ------------------------------- */

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  college: string | null;
  grad_year: number | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  user_id: string;
  role: AppRole;
  institution_id: string | null;
  granted_by: string | null;
  granted_at: string;
}

export interface Institution {
  id: string;
  name: string;
  city: string | null;
  created_at: string;
}

export interface Cohort {
  id: string;
  institution_id: string;
  name: string;
  description: string | null;
  status: CohortStatus;
  /** Suggested interview gate for validation (default 8, edit by staff). */
  interview_gate: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CohortMember {
  id: string;
  cohort_id: string;
  user_id: string;
  cohort_role: CohortRole;
  status: CohortMemberStatus;
  created_at: string;
}

export interface Gate {
  id: string;
  cohort_id: string;
  name: string;
  description: string | null;
  min_interviews: number;
  created_at: string;
}

export interface Team {
  id: string;
  cohort_id: string;
  name: string;
  status: TeamStatus;
  problem_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  member_role: "student" | "facilitator" | "mentor";
  status: TeamMemberStatus;
  created_at: string;
}

export interface TeamInvite {
  id: string;
  team_id: string;
  email: string;
  invited_by: string | null;
  token: string;
  status: InviteStatus;
  created_at: string;
}

export interface Problem {
  id: string;
  title: string;
  description: string;
  category: ProblemCategory;
  affected_users: string;
  location: string | null;
  workaround: string | null;
  evidence_basis: string | null;
  owner_name: string | null;
  owner_contact: string | null;
  submitted_by: string | null;
  status: ProblemStatus;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProblemScreening {
  id: string;
  problem_id: string;
  reviewer_id: string | null;
  decision: "approved" | "rejected" | "needs_info";
  notes: string | null;
  created_at: string;
}

export interface Interview {
  id: string;
  team_id: string;
  conducted_by: string | null;
  interview_date: string;
  participant_label: string;
  participant_type: string;
  consent: boolean;
  key_findings: string;
  pain_points: string | null;
  patterns: string | null;
  status: WorkStatus;
  created_at: string;
  updated_at: string;
}

export interface EvidenceAttachment {
  id: string;
  team_id: string;
  stage: EvidenceStage;
  uploaded_by: string | null;
  file_name: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  visibility: EvidenceVisibility;
  created_at: string;
}

export interface FeasibilityReview {
  id: string;
  team_id: string;
  author_id: string | null;
  technical_feasibility: string | null;
  cost_resources: string | null;
  time_required: string | null;
  user_access: string | null;
  dependencies: string | null;
  risks: string | null;
  expected_value: string | null;
  recommended_next_step: string | null;
  decision: FDecision | null;
  status: WorkStatus;
  reviewer_id: string | null;
  reviewer_feedback: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrototypeTest {
  id: string;
  team_id: string;
  solution_description: string | null;
  test_plan: string | null;
  iterations: string | null;
  decision: FDecision | null;
  status: WorkStatus;
  reviewer_id: string | null;
  reviewer_feedback: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserTest {
  id: string;
  test_id: string;
  participant_label: string;
  users_approached: number;
  users_tested: number;
  tasks: string;
  outcome: string;
  feedback: string | null;
  observed_problems: string | null;
  created_at: string;
}

export interface TeamDecision {
  id: string;
  team_id: string;
  stage: "validation" | "feasibility" | "prototype";
  decision: StageDecision;
  rationale: string;
  decided_by: string | null;
  created_at: string;
}

export interface ProofCard {
  id: string;
  team_id: string;
  title: string;
  problem_title: string;
  problem_summary: string;
  validation_summary: string;
  feasibility_summary: string | null;
  built_summary: string | null;
  results_limitations: string | null;
  tier: ProofTier;
  tier_set_by: string | null;
  tier_note: string | null;
  review_status: ProofReviewStatus;
  visibility: ProofVisibility;
  published_at: string | null;
  published_by: string | null;
  reviewer_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProofCardSkill {
  id: string;
  card_id: string;
  skill: string;
  evidence_summary: string;
}

export interface MentorAssignment {
  id: string;
  team_id: string;
  mentor_id: string;
  assigned_by: string | null;
  active: boolean;
  created_at: string;
}

export interface Comment {
  id: string;
  team_id: string;
  author_id: string | null;
  body: string;
  audience: "team" | "reviewers";
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

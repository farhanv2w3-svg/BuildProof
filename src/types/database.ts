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
  /* 0003 extensions */
  source_type: ProblemSourceType;
  organization_id: string | null;
  required_skills: string[];
  deliverables: string | null;
  project_type: ProjectType | null;
  budget_note: string | null;
  timeline_note: string | null;
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

/* ------------------------------------------------------------------ */
/*  0003 — platform domains                                            */
/* ------------------------------------------------------------------ */

export type ProblemSourceType = "individual" | "company" | "small_business" | "ngo" | "platform";
export type ProjectType = "research" | "prototype" | "commissioned" | "startup_potential";

export type OrganizationKind = "company" | "small_business" | "ngo" | "funder" | "accelerator" | "research_lab";
export type OrgVerificationStatus = "unverified" | "pending" | "verified" | "rejected";
export type OrgRole = "owner" | "representative" | "member";

export type CompanyProjectLevel = "beginner" | "intermediate" | "advanced";
export type CompanyProjectStatus = "draft" | "listed" | "in_review" | "in_progress" | "completed" | "closed";
export type PaymentMilestoneStatus = "agreed" | "pending" | "due" | "paid" | "disputed" | "cancelled";

export type SolutionCategory =
  | "software"
  | "ai_data"
  | "business_automation"
  | "education"
  | "social_impact"
  | "agriculture"
  | "electronics"
  | "robotics"
  | "hardware"
  | "other";
export type SolutionStage = "prototype" | "tested" | "pilot" | "commercially_in_use";
export type SolutionExposure = "private" | "restricted" | "listed";
export type LicenseStatus = "unavailable" | "license_available" | "seek_adopters" | "acquisition_discussions";
export type InterestType = "license" | "fund" | "commission" | "collaborate" | "adopt" | "startup";
export type InterestStatus = "new" | "in_contact" | "closed";
export type AgreementType = "license" | "assignment" | "acquisition" | "further_development";
export type AgreementStatus = "draft" | "under_discussion" | "agreed" | "executed" | "cancelled";

export type FundingCategory =
  | "prototype_funding"
  | "hardware_funding"
  | "startup_capital"
  | "grant_competition"
  | "incubation"
  | "manufacturing_support"
  | "sponsored_research";
export type FundingVerificationStatus = "unverified" | "verified";
export type FundingStatus = "open" | "paused" | "closed";
export type FundingApplicationStatus = "submitted" | "under_review" | "approved" | "declined";

export type HardwareReadiness = "concept" | "prototype" | "near_complete" | "production_candidate";
export type HardwareIPStatus = "undecided" | "student_owned" | "licensed" | "transferred";

export type JobKind =
  | "internship"
  | "entry_level"
  | "apprenticeship"
  | "research"
  | "hardware_role"
  | "founding_team"
  | "project_contract";
export type JobLocationType = "onsite" | "remote" | "hybrid";
export type JobVerificationStatus = "unverified" | "verified";
export type JobStatus = "open" | "paused" | "closed";
export type OpportunityApplicationStatus = "submitted" | "under_review" | "interviewing" | "accepted" | "declined";

export type ReviewSubjectType = "solution" | "hardware_project" | "company_project" | "problem";
export type ReviewerType =
  | "problem_owner"
  | "sponsor"
  | "technical"
  | "domain_expert"
  | "end_user"
  | "hardware"
  | "business"
  | "operations";
export type ReviewAssignmentStatus = "assigned" | "in_progress" | "completed";
export type ReviewVerdict = "accepted" | "needs_revision" | "rejected" | "inconclusive";

export type ContributionKind = "project_work" | "community" | "company_assignment" | "internship" | "employment" | "founding";
export type ReportSubjectType = "problem" | "solution" | "hardware_project" | "company_project" | "opportunity" | "comment";
export type ReportReason = "misleading" | "inappropriate" | "spam" | "other";
export type ReportStatus = "open" | "reviewed" | "actioned" | "dismissed";
export type MilestoneStatus = "pending" | "in_progress" | "done" | "late";
export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TeamApplicationStatus = "pending" | "accepted" | "rejected";

export interface Organization {
  id: string;
  name: string;
  kind: OrganizationKind;
  description: string | null;
  website_url: string | null;
  city: string | null;
  verification_status: OrgVerificationStatus;
  verified_by: string | null;
  verified_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  org_role: OrgRole;
  created_at: string;
}

export interface TeamRoleRequirement {
  id: string;
  team_id: string;
  skill: string;
  seats: number;
  filled_seats: number;
  note: string | null;
  created_at: string;
}

export interface TeamApplication {
  id: string;
  team_id: string;
  user_id: string;
  role_needed: string | null;
  message: string | null;
  status: TeamApplicationStatus;
  decided_by: string | null;
  created_at: string;
}

export interface ProjectMilestone {
  id: string;
  team_id: string;
  title: string;
  due_date: string | null;
  status: MilestoneStatus;
  deliverable_note: string | null;
  created_at: string;
}

export interface ProjectTask {
  id: string;
  team_id: string;
  milestone_id: string | null;
  title: string;
  assignee: string | null;
  status: TaskStatus;
  notes: string | null;
  created_at: string;
}

export interface CompanyProject {
  id: string;
  organization_id: string;
  posted_by: string;
  title: string;
  description: string;
  level: CompanyProjectLevel;
  required_skills: string[];
  deliverables: string | null;
  team_size: number;
  duration_weeks: number | null;
  budget_currency: string;
  budget_min_amount: number | null;
  budget_max_amount: number | null;
  payment_terms: string | null;
  acceptance_criteria: string | null;
  revision_policy: string | null;
  ip_terms: string | null;
  confidentiality_note: string | null;
  supervision_note: string | null;
  selected_team_id: string | null;
  status: CompanyProjectStatus;
  created_at: string;
}

export interface PaymentMilestone {
  id: string;
  company_project_id: string;
  title: string;
  amount_cents: number;
  currency: string;
  due_date: string | null;
  status: PaymentMilestoneStatus;
  paid_reference: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface Solution {
  id: string;
  team_id: string;
  proof_card_id: string | null;
  name: string;
  summary: string;
  category: SolutionCategory;
  stage: SolutionStage;
  exposure: SolutionExposure;
  demo_url: string | null;
  license_status: LicenseStatus;
  known_limitations: string | null;
  next_steps: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SolutionInterest {
  id: string;
  solution_id: string;
  user_id: string;
  interest_type: InterestType;
  message: string | null;
  status: InterestStatus;
  created_at: string;
}

export interface SolutionTransferAgreement {
  id: string;
  solution_id: string;
  proposed_by: string;
  agreement_type: AgreementType;
  terms: string;
  compensation_note: string | null;
  creator_rights_note: string | null;
  attribution_keeping: boolean;
  confidential_access_note: string | null;
  status: AgreementStatus;
  agreed_by_creator: boolean;
  agreed_by_other: boolean;
  executed_at: string | null;
  created_at: string;
}

export interface FundingOpportunity {
  id: string;
  organization_id: string | null;
  created_by: string;
  title: string;
  category: FundingCategory;
  description: string;
  criteria: string | null;
  min_amount: number | null;
  max_amount: number | null;
  currency: string;
  application_requirements: string | null;
  verification_status: FundingVerificationStatus;
  status: FundingStatus;
  created_at: string;
}

export interface FundingApplication {
  id: string;
  opportunity_id: string;
  applicant: string;
  applicant_team: string | null;
  pitch: string;
  requested_amount: number | null;
  status: FundingApplicationStatus;
  created_at: string;
}

export interface HardwareBOMItem {
  item: string;
  qty: number;
  unit_cost: number;
}

export interface HardwareProject {
  id: string;
  team_id: string;
  name: string;
  description: string;
  problem_statement: string | null;
  current_stage: number;
  specs: Array<{ spec: string; value: string }>;
  bom: HardwareBOMItem[];
  cost_currency: string;
  cost_note: string | null;
  safety_considerations: string | null;
  evidence_note: string | null;
  incomplete_work: string | null;
  demo_url: string | null;
  readiness_class: HardwareReadiness;
  ip_status: HardwareIPStatus;
  created_by: string | null;
  created_at: string;
}

export interface JobOpportunity {
  id: string;
  organization_id: string | null;
  posted_by: string;
  title: string;
  kind: JobKind;
  description: string;
  required_skills: string[];
  location_type: JobLocationType;
  city: string | null;
  commitment_note: string | null;
  compensation_note: string | null;
  verification_status: JobVerificationStatus;
  status: JobStatus;
  created_at: string;
}

export interface OpportunityApplication {
  id: string;
  opportunity_id: string;
  user_id: string;
  evidence_note: string | null;
  proof_card_id: string | null;
  status: OpportunityApplicationStatus;
  created_at: string;
}

export interface ReviewAssignment {
  id: string;
  subject_type: ReviewSubjectType;
  subject_id: string;
  reviewer_type: ReviewerType;
  reviewer_id: string;
  assigned_by: string;
  status: ReviewAssignmentStatus;
  due_date: string | null;
  created_at: string;
}

export interface ReviewDimension {
  name: string;
  note: string;
}

export interface ReviewRecord {
  id: string;
  assignment_id: string;
  dimensions: ReviewDimension[];
  verdict: ReviewVerdict;
  feedback: string;
  verified: boolean;
  verified_at: string | null;
  created_at: string;
}

export interface ProofContribution {
  id: string;
  card_id: string;
  user_id: string;
  contribution: string;
  deliverable_links: string[];
  outcome_note: string | null;
  paid: boolean;
  kind: ContributionKind;
  created_at: string;
}

export interface ContentReport {
  id: string;
  reporter: string;
  subject_type: ReportSubjectType;
  subject_id: string;
  reason: ReportReason;
  detail: string | null;
  status: ReportStatus;
  handled_by: string | null;
  created_at: string;
}

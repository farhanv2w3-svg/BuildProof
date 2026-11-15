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
  proof_card_id: string | null;
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
  archived: boolean;
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

export interface FeatureAnnouncement {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  destination_route: string | null;
  status: "draft" | "scheduled" | "published" | "archived";
  publish_at: string | null;
  published_at: string | null;
  author_id: string | null;
  notification_created: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  user_id: string;
  in_app_enabled: boolean;
  push_enabled: boolean;
  feature_announcements: boolean;
  team_notifications: boolean;
  project_notifications: boolean;
  event_notifications: boolean;
  updated_at: string;
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
export type ReportSubjectType =
  | "problem"
  | "solution"
  | "hardware_project"
  | "company_project"
  | "opportunity"
  | "comment"
  | "es_event"
  | "es_submission"
  | "es_showcase";
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
  agreed_by_creator_at?: string | null;
  agreed_by_other_at?: string | null;
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
  lifecycle_status?: "idea" | "in_progress" | "prototype" | "testing" | "completed";
  visibility?: "private" | "restricted" | "public";
  published_at?: string | null;
  created_by: string | null;
  created_at: string;
}

export interface TeamMessage {
  id: string;
  team_id: string;
  sender_id: string;
  body: string;
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

/* ------------------------------------------------------------------ */
/*  0004 — college events                                              */
/* ------------------------------------------------------------------ */

export type EventType =
  | "hackathon"
  | "symposium"
  | "workshop"
  | "technical_fest"
  | "cultural_fest"
  | "coding_competition"
  | "robotics_hardware"
  | "project_exhibition"
  | "conference"
  | "other";

export type EventStatus = "draft" | "published" | "cancelled";

export interface EventRow {
  id: string;
  created_by: string;
  title: string;
  event_type: EventType;
  institution_name: string;
  city: string;
  state_name: string;
  start_date: string;
  end_date: string;
  poster_path: string;
  contact_number: string | null;
  venue: string | null;
  description: string | null;
  registration_url: string | null;
  contact_name: string | null;
  schedule_note: string | null;
  status: EventStatus;
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  0015 — EventSpace module (es_*)                                    */
/* ------------------------------------------------------------------ */

export type EsEventCategory =
  | "hackathon"
  | "ideathon"
  | "coding_competition"
  | "project_exhibition"
  | "workshop"
  | "conference"
  | "symposium"
  | "robotics_hardware"
  | "other";

export type EsEventFormat = "online" | "offline" | "hybrid";
export type EsEventVisibility = "public" | "unlisted" | "private";
export type EsParticipation = "individual" | "team" | "both";

export type EsEventStatus =
  | "draft"
  | "published"
  | "completed"
  | "cancelled"
  | "archived";

export type EsRegistrationStatus =
  | "registered"
  | "pending"
  | "waitlisted"
  | "withdrawn"
  | "cancelled"
  | "rejected";

export type EsSubmissionStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "revision_requested"
  | "resubmitted"
  | "shortlisted"
  | "accepted"
  | "rejected"
  | "withdrawn";

export type EsSubmissionFileKind = "presentation" | "document" | "screenshot" | "supporting";

export type EsAwardCategory =
  | "winner"
  | "runner_up"
  | "second_runner_up"
  | "best_innovation"
  | "best_prototype"
  | "best_research"
  | "special_recognition"
  | "custom";

export type EsRoundType = "submission" | "interview" | "presentation" | "review" | "other";
export type EsStaffRole = "manager" | "judge";
export type EsEvaluationRecommendation = "none" | "shortlist" | "accept" | "reject";
export type EsShowcaseStatus =
  | "draft"
  | "pending_approval"
  | "owner_approved"
  | "published"
  | "unpublished";

/** Organiser-configured registration question. */
export interface EsRegQuestion {
  label: string;
  type: "text" | "textarea" | "select";
  options?: string[];
  required: boolean;
}

/** Organiser-configured submission field. */
export interface EsSubmissionField {
  key: string;
  label: string;
  required: boolean;
}

/** Rubric criterion (weights must total 100). */
export interface EsCriterion {
  name: string;
  description?: string;
  weight: number;
}

export interface EsEventOrganizerRow {
  user_id: string;
  org_name: string;
  official_email: string;
  position: string;
  website: string | null;
  reason: string;
  verification_notes: string | null;
  status: "pending" | "approved" | "rejected" | "suspended";
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface EsEventRow {
  id: string;
  slug: string;
  created_by: string;
  title: string;
  category: EsEventCategory;
  short_description: string;
  full_description: string | null;
  cover_path: string | null;
  poster_path: string | null;
  logo_path: string | null;
  institution_name: string;
  edition: string | null;
  theme: string | null;
  official_url: string | null;
  format: EsEventFormat;
  venue: string | null;
  city: string | null;
  state_name: string | null;
  country: string | null;
  timezone: string;
  online_instructions: string | null;
  map_url: string | null;
  starts_at: string;
  ends_at: string;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  submission_opens_at: string | null;
  submission_deadline: string | null;
  judging_starts_at: string | null;
  judging_ends_at: string | null;
  results_at: string | null;
  resubmit_until: string | null;
  eligibility_levels: string[];
  eligibility_years: string[] | null;
  eligibility_departments: string[] | null;
  eligibility_institutions: string[] | null;
  eligibility_regions: string[] | null;
  age_note: string | null;
  participation: EsParticipation;
  min_team_size: number;
  max_team_size: number;
  registration_enabled: boolean;
  registration_capacity: number | null;
  registration_approval: boolean;
  reg_questions: EsRegQuestion[];
  registration_note: string | null;
  confirmation_message: string | null;
  rules: string | null;
  submission_requirements: string | null;
  originality_terms: string | null;
  ip_terms: string | null;
  late_submission_terms: string | null;
  disqualification_terms: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  faq: Array<{ q: string; a: string }>;
  submission_fields: EsSubmissionField[];
  evaluation_enabled: boolean;
  evaluation_criteria: EsCriterion[];
  feedback_visible: boolean;
  anonymous_judging: boolean;
  status: EsEventStatus;
  visibility: EsEventVisibility;
  registration_open: boolean;
  submission_open: boolean;
  judging_open: boolean;
  results_published: boolean;
  featured: boolean;
  published_at: string | null;
  cancelled_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface EsEventStaffRow {
  id: string;
  event_id: string;
  user_id: string;
  role: EsStaffRole;
  granted_by: string;
  created_at: string;
}

export interface EsRoundRow {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  round_type: EsRoundType;
  opens_at: string | null;
  closes_at: string | null;
  submission_config: Record<string, unknown>;
  evaluation_config: Record<string, unknown>;
  advancement: string | null;
  sort_order: number;
  created_at: string;
}

export interface EsEventTeamRow {
  id: string;
  event_id: string;
  name: string;
  leader_user_id: string;
  created_by: string;
  created_at: string;
}

export interface EsEventTeamMemberRow {
  id: string;
  team_id: string;
  user_id: string;
  member_role: "leader" | "member";
  status: "invited" | "active" | "declined" | "left" | "removed";
  invited_by: string;
  responded_at: string | null;
  created_at: string;
}

export interface EsRegistrationRow {
  id: string;
  event_id: string;
  user_id: string;
  participation_type: "individual" | "team";
  team_id: string | null;
  status: EsRegistrationStatus;
  answers: Array<{ label: string; answer: string }>;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EsSubmissionRow {
  id: string;
  event_id: string;
  round_id: string | null;
  owner_type: "individual" | "team";
  owner_user_id: string;
  team_id: string | null;
  status: EsSubmissionStatus;
  data: Record<string, unknown>;
  snapshot: Record<string, unknown> | null;
  snapshot_version: number;
  declarations: {
    originality?: string;
    rights?: string;
    rules_ack?: string;
    visibility_consent?: string;
    [key: string]: unknown;
  };
  linked_project_kind: "solution" | "hardware_project" | null;
  linked_project_id: string | null;
  submitted_at: string | null;
  revision_reason: string | null;
  review_note: string | null;
  shortlisted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EsSubmissionSnapshotRow {
  id: string;
  submission_id: string;
  version: number;
  data: Record<string, unknown>;
  created_at: string;
}

export interface EsSubmissionFileRow {
  id: string;
  submission_id: string;
  storage_path: string;
  object_key: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  kind: EsSubmissionFileKind;
  uploaded_by: string;
  created_at: string;
}

export interface EsJudgeAssignmentRow {
  id: string;
  event_id: string;
  judge_user_id: string;
  submission_id: string;
  status: "assigned" | "in_progress" | "completed" | "removed";
  assigned_by: string;
  created_at: string;
}

export interface EsEvaluationRow {
  id: string;
  assignment_id: string;
  scores: Array<{ criterion: string; score: number | null }>;
  total_score: number | null;
  private_notes: string | null;
  feedback: string | null;
  recommendation: EsEvaluationRecommendation | null;
  is_draft: boolean;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EsAwardRow {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  category: EsAwardCategory;
  prize_text: string | null;
  certificate_text: string | null;
  sponsor: string | null;
  sort_order: number;
  created_at: string;
}

export interface EsResultRow {
  id: string;
  event_id: string;
  award_id: string;
  submission_id: string;
  position: number | null;
  note: string | null;
  published: boolean;
  published_at: string | null;
  created_by: string;
  created_at: string;
}

export interface EsAnnouncementRow {
  id: string;
  event_id: string;
  title: string;
  body: string;
  audience: "participants" | "judges" | "all";
  created_by: string;
  created_at: string;
}

export interface EsShowcaseRow {
  id: string;
  event_id: string;
  submission_id: string;
  status: EsShowcaseStatus;
  approved_title: string;
  approved_summary: string;
  approved_problem: string | null;
  approved_solution: string | null;
  team_attribution: Array<{ name: string; role?: string }>;
  image_path: string | null;
  approved_demo_url: string | null;
  approved_github_url: string | null;
  owner_approved_by: string | null;
  owner_approved_at: string | null;
  published_by: string | null;
  published_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** Row shape of the es_public_showcases view. */
export interface EsPublicShowcaseRow {
  id: string;
  event_id: string;
  submission_id: string;
  approved_title: string;
  approved_summary: string;
  approved_problem: string | null;
  approved_solution: string | null;
  team_attribution: Array<{ name: string; role?: string }>;
  image_path: string | null;
  approved_demo_url: string | null;
  approved_github_url: string | null;
  published_at: string | null;
  event_title: string;
  event_slug: string;
  event_category: EsEventCategory;
}

/** Row shape of the es_public_results view. */
export interface EsPublicResultRow {
  id: string;
  event_id: string;
  award_id: string;
  submission_id: string;
  position: number | null;
  award_name: string;
  award_category: EsAwardCategory;
  event_title: string;
  event_slug: string;
  approved_title: string | null;
  approved_summary: string | null;
  approved_demo_url: string | null;
  approved_github_url: string | null;
  team_attribution: Array<{ name: string; role?: string }> | null;
  image_path: string | null;
  showcase_status: EsShowcaseStatus | null;
}

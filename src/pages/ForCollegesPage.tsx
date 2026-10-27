import { AudiencePage } from "./AudiencePage";

export default function ForCollegesPage() {
  return (
    <AudiencePage
      kicker="For colleges & institutions"
      title="Run cohorts where the work is real and reviewable."
      intro="BuildProof's initial operating model is a single-college pilot cohort: five teams, roughly 20–30 students, a two-week validation phase followed by an optional two-week prototype phase. Everything students produce is persisted, permissioned and reviewable — no slide decks as evidence."
      steps={[
        { title: "Set up your institution", body: "A platform admin registers the institution and grants an institution admin role to your designated staff member. Self-serve access doesn't exist by design." },
        { title: "Create a cohort", body: "Name it, describe the timeline (2+2 weeks is the operating model), and set the interview gate (default: 8 consented adult interviews per team)." },
        { title: "Add members and teams", body: "Add students by email as proposed members; they accept themselves. Create teams within the cohort; every team has its own private workspace with interviews, evidence and assessments." },
        { title: "Review continuously", body: "Faculty coordinators and facilitators see cohort progress: interview counts, validation decisions, feasibility statuses and test records — each with review state." },
        { title: "Approve and publish Proof Cards", body: "Facilitators/mentors review submitted Proof Cards, assign verification tiers, and institution admins decide what is published publicly. Publication is explicit, never automatic." },
      ]}
      promises={[
        "Full audit trail of reviews and administrative actions",
        "RLS-enforced separation: student work, staff oversight, accountable admin",
        "One clear outcome per team: verified Proof Card, pivot, or honest stop",
        "Culturally adjustable gates (e.g. interview counts) by authorised staff",
      ]}
      limits={[
        "Pilot is an operating plan — BuildProof has not yet run a pilot and says so",
        "Requires adult participants for fieldwork; no minors in unsupervised surveying",
        "Email digests require configuration — status lives in the app for now",
      ]}
      cta={{ to: "/apply", label: "Start the conversation" }}
      secondaryCta={{ to: "/for-mentors", label: "Understand mentoring" }}
    />
  );
}

import { AudiencePage } from "./AudiencePage";

export default function ForProblemOwnersPage() {
  return (
    <AudiencePage
      kicker="For businesses, NGOs & startups"
      title="See how your real problem gets investigated — with evidence."
      intro="Submit a problem your organisation actually faces. Then watch it get validated through genuine interviews and structured feasibility work — and only continue if teams's evidence supports a real test. You see permitted progress, students see your problem honestly framed."
      steps={[
        { title: "Submit your problem", body: "Title, description, affected users, location, current workaround, and why it matters. Include how you'd like to be contacted — that contact stays private to authorised reviewers." },
        { title: "Wait for screening", body: "A platform admin screens the submission. You receive an in-app notification with the decision either way. Not everything will be approved — that's the point." },
        { title: "If approved, it becomes visible to teams", body: "Approved problems appear in team problem discovery. Teams investigate with consented adult interviews and structured feasibility reviews." },
        { title: "Watch permitted progress", body: "As an owner of the problem, you can see submissions connected to your problem and any work teams choose to share with you. You never receive students' private interview notes." },
        { title: "Confirm or close", body: "At delivery, if you confirm work as genuinely delivered, that confirmation is what enables Tier 3 verification on a team's Proof Card — a human confirmation, not an automatic badge." },
      ]}
      promises={[
        "You'll see real evidence, not pitch decks: interview findings, test results, limitations",
        "Your contact and organisational details stay private by default",
        "Nothing is published publicly about your problem without approval",
        "No cost model to submit problems during the initial phase",
      ]}
      limits={[
        "No payment flows, marketplace or hiring fee system at launch",
        "Students are early builders — treat this as supervised project work, not freelancing",
        "Outcome depends on evidence gathered; it may end in a respectful 'stop' — that is the honest result",
      ]}
      cta={{ to: "/submit-problem", label: "Submit a problem" }}
      secondaryCta={{ to: "/signup", label: "Create an owner account" }}
    />
  );
}

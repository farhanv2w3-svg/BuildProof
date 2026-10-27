import { AudiencePage } from "./AudiencePage";

export default function ForMentorsPage() {
  return (
    <AudiencePage
      kicker="For mentors"
      title="Review work grounded in evidence, not hype."
      intro="Mentors are assigned to teams by cohort staff — there is no open mentor signup, no fake profiles, no automatic badges. When you're assigned, you see that team's actual work: interviews (types of findings), feasibility reasoning, tests and evidence."
      steps={[
        { title: "Be assigned through an institution or platform admin", body: "Roles are granted only after real verification — these buttons are honest: if you're reading this without an assigned role, you cannot self-promote, and that's a feature." },
        { title: "See assigned teams", body: "The Mentoring page lists teams with their interview counts, decisions, feasibility states and evidence attachments." },
        { title: "Review with substance", body: "Leave reviewer feedback on feasibility and prototype stages. Mark interviews as reviewed. Mark submission states with request-changes when needed." },
        { title: "Raise verification tiers", body: "Only authorised facilitators or mentors can set Proof Card verification tiers above Tier 1 (self-reported), and this is enforced in database policy, not by UI trust." },
        { title: "Refuse to sugar-coat", body: "The most valuable thing you can give teams is realistic feedback recorded in writing — it shapes their Proof Card and their learning." },
      ]}
      promises={[
        "Assignment-based privacy: only your teams, no browsing others' private data",
        "Reviewer feedback is recorded, attributable, and part of the audit trail",
        "Tier-2 review is a meaningful credential for students",
      ]}
      limits={[
        "No payment for mentoring in the initial phase",
        "No verified-by-BuildProof title — institutional affiliation is what provides verification",
      ]}
      cta={{ to: "/apply", label: "How to get assigned" }}
      secondaryCta={{ to: "/how-it-works", label: "See the review process" }}
    />
  );
}

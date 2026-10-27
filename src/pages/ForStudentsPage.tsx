import { AudiencePage } from "./AudiencePage";

export default function ForStudentsPage() {
  return (
    <AudiencePage
      kicker="For students & early builders"
      title="Prove what you did, not what you plan to do."
      intro="Most student portfolios are lists of courses and claims. BuildProof gives you a structured way to work on real problems and end up with evidence-backed Proof Cards — what you researched, what you built, what happened, reviewed by people with authority."
      steps={[
        { title: "Join through your college or a cohort", body: "Cohort membership is set up by an institution or facilitator. Until then you can still browse approved problems and submit problems you've noticed." },
        { title: "Pick a real problem", body: "Choose from screened problems, or submit your own and wait for screening. Choose one you can genuinely investigate." },
        { title: "Validate with real interviews", body: "Collecting 8+ consented adult interviews per team (suggested gate) teaches a skill most students never practice: talking to real people with consent and structure." },
        { title: "Assess feasibility honestly", body: "Cost, time, risks, access — reviewers help you see the truth, which will matter more than a polished deck." },
        { title: "Test something (optional but valuable)", body: "If validation says continue, build a paper prototype, no-code page, or small test. Record approached vs tested users honestly." },
        { title: "Produce your Proof Card", body: "Contributions, evidence, skills with supporting references, results AND limitations. Approved cards can be published and stay public." },
      ]}
      promises={[
        "Evidence-backed Proof Cards with verification tiers",
        "Private-by-default work; publication only after approval",
        "Decisions recorded at every stage — a real, followable story",
        "Skills records designed for employer conversations (dates, evidence, limitations)",
      ]}
      limits={[
        "Not a job portal: no guaranteed placements or paid projects at launch",
        "Stopping a weak idea is a normal, respected outcome",
        "Unapproved proof stays private to you and your reviewers",
      ]}
      cta={{ to: "/signup", label: "Create my account" }}
      secondaryCta={{ to: "/how-it-works", label: "See the stages" }}
    />
  );
}

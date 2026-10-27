export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy policy" updated="Draft updated 27 Oct 2026 — editable draft, not legal advice">
      <p>
        <strong>This is a project draft, not a document reviewed by a lawyer</strong>. BuildProof is
        an early-stage product; this page will be replaced by a properly reviewed version before
        any public launch.
      </p>

      <H>What we collect</H>
      <P>
        When you sign up we store your email, name (which you provide), and the minimal profile
        fields you choose to add (college, graduation year, short bio). We never ask for sensitive
        personal information such as caste, religion, income, or health data, and we do not want it.
      </P>

      <H>What stays private</H>
      <P>
        Interview notes, evidence attachments, feasibility documents, drafts and unapproved Proof
        Cards are private to team members and the authorised reviewers of those records. Private
        attachments live in a secured storage bucket and are only served through short-lived signed
        links — never permanent public URLs.
      </P>

      <H>What is public</H>
      <P>
        Only Proof Cards that have been both approved in review AND explicitly published appear on
        the public site, in summarised, anonymised form. Private notes, attachments, personal
        contact details and interviewees' identities are never published.
      </P>

      <H>Interview data & consent</H>
      <P>
        Our programme design requires that fieldwork section be conducted only with consenting
        adults who are told they may stop at any time. Participation labels are anonymised at
        entry. If you were an interview participant and want your data removed from a team's
        records, contact the team's facilitator or college coordinator; we will honour verified
        deletion requests.
      </P>

      <H>Retention & deletion</H>
      <P>
        We intend to delete records when requested, within a reasonable operational window. As the
        product does not yet have a self-serve deletion flow, contact the platform admin. Audit
        logs may retain entries for security review.
      </P>

      <H>Children</H>
      <P>
        BuildProof programme design requires adult participants for interviews. The platform is not
        directed at children, and we ask institutions to comply with local rules for student age.
      </P>

      <H id="report">Reporting a problem</H>
      <P>
        To report abusive content, data exposure, or an unsafe interaction, email the platform
        admin (currently: use the contact email in the footer — while this draft stands, treat it
        as an unmonitored placeholder and contact the college coordinator initially).
      </P>

      <H>Contact</H>
      <PPlaceholder />
    </LegalShell>
  );
}

import { LegalShell, H, P, PPlaceholder } from "./LegalShell";

export default function TermsPage() {
  return (
    <LegalShell title="Terms of use" updated="Draft updated 27 Oct 2026 — editable draft, not legal advice">
      <p>
        <strong>This is a project draft, not a document reviewed by a lawyer</strong>. Replace with
        a properly reviewed version before any public launch. By using BuildProof you acknowledge
        it is an early-stage, evolving product.
      </p>

      <H>The service</H>
      <P>
        BuildProof provides tooling for problem discovery, validation workflows, evidence
        management, structured reviews and Proof Cards. It is not a social network, marketplace,
        job portal or degree programme, and nothing in the product constitutes legal, financial,
        medical or career advice.
      </P>

      <H id="accounts">Accounts</H>
      <P>
        You must provide a valid email you control and keep credentials secure. One prudential
        rule from our review model: never share login access between users, even teammates. Do not
        impersonate others or register with false identity details. Roles are administrative
        grants, not claims users can make.
      </P>

      <H>The honesty covenant</H>
      <P>
        This platform's core promise is truth. Fabricating interview data, inventing participant
        consent, claiming work that did not happen, or misrepresenting verification tier is grounds
        for record revocation. Reviewers who inflate tiers without evidence will have grants
        revoked. Restated: BuildProof will not invent verification — please don't either.
      </P>

      <H>Research safety & consent</H>
      <P>
        Only consenting adults should participate in user interviews recorded here. Participants
        must be told what's happening and can stop at any time. Anonymised labels are required.
        Fieldwork that could put anyone at risk — minors, safety hazards, or sensitive contexts —
        is out of scope for the programme.
      </P>

      <H>Content ownership</H>
      <P>
        Your submissions and evidence remain yours. By publishing a Proof Card you grant the
        platform a right to display that card publicly in anonymised form. Terms for future paid
        project work (scope, payment, IP transfer, disputes) will be published separately before
        any such features activate — none exist today.
      </P>

      <H>Events (EventSpace)</H>
      <P>
        For competitions hosted through EventSpace, the event organiser (not BuildProof) sets the
        rules, judges the entries and awards prizes; BuildProof provides the venue, private
        submissions, judging and showcase tooling. Your project remains yours — nothing is
        published to a public showcase unless you approve that specific content yourself. Public
        showcase publication also requires the organiser's action. Event organisers are
        independently verified by platform administrators and must state originality, IP and
        disqualification terms on each event; read them before registering. BuildProof does not
        promise certificates, prizes or selection outcomes, and it does not process prize money.
      </P>

      <H>Enforcement</H>
      <P>
        Administrators can revoke verification grants, remove content that violates the honesty
        covenant, and suspend accounts that abuse the platform. There is no self-serve account
        deletion yet — to have your account or records removed, contact the platform admin (see
        the privacy policy for the current limitation).
      </P>

      <H id="contact">Contact &amp; reporting</H>
      <PPlaceholder />

      <H>Changes</H>
      <P>
        These terms and the product may change. Material changes will be reflected in this draft.
        We don't claim any subscription, contract, promise of income, or employment.
      </P>
    </LegalShell>
  );
}

import { LegalShell, H, P, PPlaceholder } from "./LegalShell";

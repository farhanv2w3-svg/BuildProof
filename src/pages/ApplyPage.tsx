import { ButtonLink, InfoNote } from "../components/ui";

export default function ApplyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
      <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brand-600">Joining BuildProof</p>
      <h1 className="display-title mt-2 text-3xl sm:text-4xl">How to actually join.</h1>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
        BuildProof is brand new — there are no verified mentors, partner institutions or paying
        clients yet, and we don't pretend otherwise. Here's each realistic route to join today:
      </p>

      <div className="mt-8 grid gap-4">
        <RouteCard
          title="Students & problem owners — sign up directly"
          body="Create an account and choose your role at signup. Both roles are real: browse problems or submit one. Higher roles are granted by admins only."
          cta={{ to: "/signup", label: "Sign up" }}
        />
        <RouteCard
          title="Colleges — institutional access"
          body="Email hello@buildproof.org (placeholder address — it is not a monitored inbox yet) describing your institution and cohort plan. Access is granted manually by a platform admin after a real conversation."
          cta={null}
        />
        <RouteCard
          title="Mentors — invitation-based at launch"
          body="Mentor accounts are created by admins for verified people. Self-signup deliberately cannot produce a mentor role."
          cta={null}
        />
        <RouteCard
          title="Facilitator / coordinator roles"
          body="Granted to staff running an actual cohort. There is no open application form — on purpose, until moderation capacity exists."
          cta={null}
        />
      </div>

      <div className="mt-8">
        <InfoNote>
          We'd rather grow access slowly and honestly than inflate the user base with unverifiable
          roles. Every claim on this page reflects current functionality.
        </InfoNote>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink to="/signup" size="lg">Sign up as student / owner</ButtonLink>
        <ButtonLink to="/submit-problem" variant="secondary" size="lg">Submit a problem</ButtonLink>
      </div>
    </div>
  );
}

function RouteCard({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: { to: string; label: string } | null;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-card">
      <h2 className="display-title text-[16px]">{title}</h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{body}</p>
      {cta && (
        <ButtonLink to={cta.to} variant="secondary" size="sm" className="mt-3">
          {cta.label}
        </ButtonLink>
      )}
    </div>
  );
}

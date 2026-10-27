import type { ReactNode } from "react";
import { ButtonLink } from "../components/ui";

/** Shared audience-page scaffold: hero, workflow steps, expectations, CTA. */
export function AudiencePage({
  kicker,
  title,
  intro,
  steps,
  promises,
  limits,
  cta,
  secondaryCta,
}: {
  kicker: string;
  title: string;
  intro: string;
  steps: { title: string; body: string }[];
  promises: string[];
  limits: string[];
  cta: { to: string; label: string };
  secondaryCta?: { to: string; label: string };
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6">
      <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brand-600">{kicker}</p>
      <h1 className="display-title mt-2 text-3xl sm:text-4xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">{intro}</p>

      <div className="mt-10 space-y-4">
        {steps.map((s, i) => (
          <div key={s.title} className="rounded-card border border-line bg-surface p-5 shadow-card">
            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 font-display text-[14px] font-extrabold text-brand-700">
                {i + 1}
              </span>
              <div>
                <h2 className="display-title text-[15.5px]">{s.title}</h2>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{s.body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <div className="rounded-card border border-brand-200 bg-brand-50 p-5">
          <h3 className="display-title text-[15px] text-brand-800">What to expect</h3>
          <ul className="mt-2 space-y-1.5">
            {promises.map((p) => (
              <li key={p} className="flex gap-2 text-[13px] text-brand-800/90">
                <span aria-hidden>·</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-card border border-line bg-canvas p-5">
          <h3 className="display-title text-[15px]">Honest limits</h3>
          <ul className="mt-2 space-y-1.5">
            {limits.map((l) => (
              <li key={l} className="flex gap-2 text-[13px] text-ink-soft">
                <span aria-hidden>·</span>
                {l}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink to={cta.to} size="lg">{cta.label}</ButtonLink>
        {secondaryCta && (
          <ButtonLink to={secondaryCta.to} variant="secondary" size="lg">
            {secondaryCta.label}
          </ButtonLink>
        )}
      </div>
    </div>
  );
}

export function PageNote({ children }: { children: ReactNode }) {
  return <p className="mt-6 text-[12px] text-ink-soft">{children}</p>;
}

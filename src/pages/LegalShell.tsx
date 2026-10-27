import type { ReactNode } from "react";

/** Simple wrapper for legal draft pages; rendered inside PublicLayout. */
export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="display-title text-3xl sm:text-4xl">{title}</h1>
      <p className="mt-2 text-[12.5px] font-semibold text-accent-700">{updated}</p>
      <div className="prose-page mt-8">{children}</div>
    </div>
  );
}

export function H({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="display-title mt-8 text-xl">
      {children}
    </h2>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-[14px] leading-relaxed text-ink-soft">{children}</p>;
}

export function PPlaceholder() {
  return (
    <P>
      <strong>HELLO@BUILDPROOF.ORG is a placeholder address and is not a monitored inbox yet.</strong>{" "}
      Until real contact details are configured, contact the college coordinator or the platform
      administrator directly. Do not send sensitive data to unverified addresses.
    </P>
  );
}

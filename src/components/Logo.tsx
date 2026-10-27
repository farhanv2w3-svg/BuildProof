import { cn } from "../lib/utils";

/**
 * BuildProof brand assets. Original SVG drawn for this project — not a stock icon.
 * Mark: ascending proof bars (progression) + verification check, on a brand tile.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="BuildProof logo"
      className={cn("h-8 w-8 shrink-0", className)}
    >
      <rect width="32" height="32" rx="7" fill="#1a6b58" />
      <rect x="5.5" y="21" width="5.5" height="6.5" rx="1.3" fill="#fff" opacity="0.45" />
      <rect x="13.2" y="16" width="5.5" height="11.5" rx="1.3" fill="#fff" opacity="0.6" />
      <rect x="21" y="11" width="5.5" height="16.5" rx="1.3" fill="#fff" opacity="0.78" />
      <path
        d="M6.5 13.5l5.4 5.3L25 6.5"
        fill="none"
        stroke="#f2b53c"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  className,
  invert = false,
}: {
  className?: string;
  /** invert: for dark headers — wordmark text turns white */
  invert?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="h-8 w-8" />
      <span
        className={cn(
          "font-display text-[19px] font-extrabold tracking-tight leading-none",
          invert ? "text-white" : "text-ink"
        )}
      >
        Build<span className="text-brand-600">Proof</span>
      </span>
    </span>
  );
}

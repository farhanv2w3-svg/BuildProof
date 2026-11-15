import { useEffect } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Link } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { cn } from "../lib/utils";

/* ------------------------------- Button ---------------------------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-[background-color,border-color,color,box-shadow,transform] duration-200 active:scale-[0.98] disabled:opacity-55 disabled:pointer-events-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-800 shadow-[0_1px_2px_rgb(16_91_73/0.24)]",
  secondary: "bg-surface text-ink border border-line hover:border-brand-400 hover:text-brand-700",
  ghost: "text-ink-soft hover:text-ink hover:bg-brand-100/60",
  danger: "bg-danger text-white hover:opacity-90",
  accent: "bg-lime-400 text-ink hover:bg-lime-300",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={rest.disabled || loading}
      {...rest}
    >
      {loading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({
  to,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  to: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={cn(base, variants[variant], sizes[size], className)}>
      {children}
    </Link>
  );
}

/* -------------------------------- Card ----------------------------- */

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>("[data-confirm-dialog-primary]")?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-lift">
        <h2 id="confirm-dialog-title" className="font-display text-lg font-bold text-ink">{title}</h2>
        <p id="confirm-dialog-description" className="mt-2 text-sm text-ink-soft">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button data-confirm-dialog-primary variant={destructive ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "bg-surface border border-line rounded-card shadow-card",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
      <div>
        <h3 className="font-display text-[16px] font-bold text-ink">{title}</h3>
        {sub && <p className="text-[13px] text-ink-soft mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------- Badge ---------------------------- */

const badgeTones: Record<string, string> = {
  neutral: "bg-line/60 text-ink-soft",
  brand: "bg-brand-100 text-brand-700",
  accent: "bg-accent-100 text-accent-700",
  success: "bg-success-soft text-success",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-research-soft text-research-strong",
  testing: "bg-testing-soft text-testing-strong",
  mentor: "bg-mentor-soft text-mentor-strong",
};

export function Badge({ tone = "neutral", children, className }: { tone?: keyof typeof badgeTones; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold tracking-wide", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

/* -------------------------------- Form ----------------------------- */

export function Field({
  label,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="text-[13px] font-semibold text-ink">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-[12.5px] text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200/70 disabled:opacity-60";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputCls, "h-10", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputCls, "min-h-[96px] resize-y", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputCls, "h-10 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%235b6b66%22%20stroke-width%3D%222.5%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22/%3E%3C/svg%3E')] bg-[right_12px_center] bg-no-repeat pr-9", className)} {...rest}>
      {children}
    </select>
  );
}

/* ------------------------------- States ---------------------------- */

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn("h-5 w-5 animate-spin text-brand-500", className)} aria-label="Loading" />;
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-ink-soft">
      <Spinner /> {label}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line bg-surface px-6 py-10 text-center">
      {icon && <div className="text-brand-400">{icon}</div>}
      <p className="font-display font-bold text-ink">{title}</p>
      {description && <p className="max-w-md text-[13.5px] text-ink-soft">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-[13.5px] text-danger">
      {message}
    </div>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  return (
    <div role="status" className="rounded-lg border border-success/25 bg-success-soft px-4 py-3 text-[13.5px] text-success">
      {message}
    </div>
  );
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-[13px] text-brand-800">
      {children}
    </div>
  );
}

/* ----------------------------- Misc ------------------------------- */

export function PageTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="display-title text-2xl sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-ink-soft">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Meta({ children }: { children: ReactNode }) {
  return <span className="text-[12.5px] text-ink-soft">{children}</span>;
}

export function PrivacyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-canvas border border-line px-3 py-2 text-[12px] text-ink-soft">
      <strong className="text-ink">Privacy:</strong> {children}
    </p>
  );
}

import { useEffect, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { getSupabase } from "../../lib/supabase";
import { AuthShell, Unconfigured } from "./SignupPage";
import { Card, ErrorBanner, LoadingBlock } from "../../components/ui";

/**
 * OAuth / email-confirmation / recovery callback.
 * Exchanges the ?code= or #hash tokens for a session, then continues to the
 * `next` destination. Errors are shown rather than hidden — e.g. an expired
 * confirmation link, or a redirect URL not on the Supabase allowlist.
 */
export default function AuthCallbackPage() {
  const supabase = getSupabase();
  const [params] = useSearchParams();
  const [status, setStatus] = useState<"working" | "ok" | "error">("working");
  const [err, setErr] = useState<string | null>(null);
  const attempted = useRef(false);

  const next = params.get("next") ?? "/app";
  // Only allow internal destinations — prevents open-redirect abuse.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  useEffect(() => {
    if (!supabase || attempted.current) return;
    attempted.current = true;

    (async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
      if (error) {
        setErr(error.message);
        setStatus("error");
      } else {
        setStatus("ok");
      }
      // On success AuthProvider's onAuthStateChange picks the session up and
      // the Navigate below sends the user onward.
    })();
  }, [supabase]);

  if (!supabase) return <Unconfigured />;

  return (
    <AuthShell title="Finishing sign-in…">
      <Card className="p-6">
        {err ? (
          <>
            <ErrorBanner message={err} />
            <p className="mt-3 text-[13px] text-ink-soft">
              Common causes: the link expired, it was already used, or the site URL isn't in the
              Supabase redirect allowlist. Try signing in again, or request a fresh link.
            </p>
            <div className="mt-4 flex gap-2">
              <a href="/login" className="text-[13.5px] font-semibold text-brand-700 hover:underline">
                Go to sign in
              </a>
            </div>
          </>
        ) : (
          <>
            <LoadingBlock label={status === "ok" ? "Signed in — redirecting…" : "Completing authentication…"} />
            {status === "ok" && <RedirectOnSuccess to={safeNext} />}
          </>
        )}
      </Card>
    </AuthShell>
  );
}

function RedirectOnSuccess({ to }: { to: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 800);
    return () => clearTimeout(t);
  }, []);
  if (!ready) return null;
  return <Navigate to={to} replace />;
}

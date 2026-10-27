import { AlertTriangle } from "lucide-react";
import { useState } from "react";

/**
 * Shown when the BuildProof Supabase environment variables are missing.
 * Nothing is faked — the app states plainly that the backend isn't configured.
 */
export function BackendNotice() {
  const [dismissed, setDismissed] = useState(false);
  const hasEnv =
    import.meta.env.VITE_SUPABASE_URL &&
    !String(import.meta.env.VITE_SUPABASE_URL).includes("YOUR-");
  const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  if (hasEnv || dismissed || !isLocalhost) return null;

  return (
    <div className="flex items-start gap-3 border-b border-accent-600/30 bg-warn-soft px-4 py-2.5 text-[13px] text-warn">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1">
        <strong>Backend not configured.</strong> Authentication and data are unavailable until
        <code className="mx-1 rounded bg-warn-soft px-1">.env</code>
        contains a real BuildProof Supabase URL and anon key. See <code className="rounded bg-warn-soft px-1">.env.example</code> and
        <code className="mx-1 rounded bg-warn-soft px-1">docs/deployment.md</code>.
      </p>
      <button className="font-semibold underline" onClick={() => setDismissed(true)}>
        Dismiss
      </button>
    </div>
  );
}

import { ShieldAlert } from "lucide-react";
import { ButtonLink, EmptyState } from "../components/ui";

export default function AccessDeniedPage() {
  return (
    <div className="container-xl flex min-h-[70vh] items-center justify-center px-4">
      <EmptyState
        icon={<ShieldAlert className="h-6 w-6" />}
        title="Access to this page is restricted"
        description="Your current roles don't include permission for this area. Permissions are enforced by database policies — they cannot be changed from the browser. Ask a platform administrator if you believe this is a mistake."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink to="/app" variant="secondary" size="sm">Back to dashboard</ButtonLink>
            <ButtonLink to="/apply" size="sm">How roles are granted</ButtonLink>
          </div>
        }
      />
    </div>
  );
}

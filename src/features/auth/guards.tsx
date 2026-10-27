import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../../lib/auth";
import { LoadingBlock } from "../../components/ui";
import { hasRoleAccess } from "../../lib/rbac";
import type { AppRole } from "../../types/database";

/** Redirects unauthenticated users to login, preserving the intended URL. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingBlock label="Checking your session…" />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

/** Renders an access-denied page when the user's roles do not match. */
export function RequireRoles({ allowed, children }: { allowed: AppRole[]; children: ReactNode }) {
  const { roles, loading } = useAuth();
  if (loading) return <LoadingBlock />;
  if (!hasRoleAccess(roles, allowed)) return <Navigate to="/app/access-denied" replace />;
  return <>{children}</>;
}

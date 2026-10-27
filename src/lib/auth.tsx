import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import type { AppRole, Profile, UserRole } from "../types/database";
import { SELF_ASSIGNABLE_ROLES } from "./rbac";

interface AuthState {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured] = useState(() => supabase !== null);

  async function loadUserData(user: User | null) {
    if (!supabase || !user) {
      setProfile(null);
      setRoles([]);
      return;
    }
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("*").eq("user_id", user.id),
    ]);
    setProfile((profileRes.data as Profile) ?? null);
    const rows = (rolesRes.data ?? []) as UserRole[];
    setRoles(rows.map((r) => r.role));
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadUserData(data.session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setRoles([]);
      } else if (newSession) {
        await loadUserData(newSession.user);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
    // loadUserData is stable in practice; session object identity changes each event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setRoles([]);
  }

  const value: AuthState = {
    configured,
    loading,
    session,
    user: session?.user ?? null,
    profile,
    roles,
    signOut,
    refresh: async () => {
      await loadUserData(session?.user ?? null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Role the user picked at signup (metadata), defaulting to student. */
export function requestedRole(user: User | null): AppRole {
  const raw = (user?.user_metadata as Record<string, unknown> | null)?.["role"];
  return SELF_ASSIGNABLE_ROLES.includes(raw as AppRole) ? (raw as AppRole) : "student";
}

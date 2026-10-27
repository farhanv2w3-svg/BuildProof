import * as supabaseModule from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const { createClient } = supabaseModule;

// Expose the whole library namespace through a dynamic global property.
// WITHOUT this, production bundlers can tree-shake the Supabase client
// library to a few hundred bytes even though `createClient` is called
// unconditionally (verified experimentally): property names like
// `auth.signOut` then vanish from the bundle and calls would crash.
// Publishing it on an unguessable-ish global keeps every export reachable.
if (typeof globalThis !== "undefined") {
  (globalThis as Record<string, unknown>).__buildproofSupabase = supabaseModule;
}

let client: SupabaseClient | null = null;

/**
 * Returns the shared browser Supabase client, or null when the app has not
 * been configured with a BuildProof Supabase project yet.
 *
 * Only the public/publishable (anon) key is used here. The service-role key is
 * NEVER used in frontend code — data protection is enforced by RLS policies.
 */
export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key || url.includes("YOUR-")) return null;
  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}

/** Sync helper for non-React code; throws with an actionable message. */
export function requireSupabase(): SupabaseClient {
  const c = getSupabase();
  if (!c) {
    throw new Error(
      "BuildProof backend is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to a .env file (see .env.example)."
    );
  }
  return c;
}

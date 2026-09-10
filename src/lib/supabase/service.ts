import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

/** Service-role client — bypasses RLS entirely. Use ONLY server-side, and
 * only to call functions that are themselves not reachable by the normal
 * authenticated client (REVOKEd from public/anon/authenticated), after this
 * route has already resolved the real user via the session-scoped client
 * (@/lib/supabase/server). Never pass client-supplied user_id/limit/cost
 * through to a privileged RPC without resolving them server-side first. */
export function createServiceClient() {
  return createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

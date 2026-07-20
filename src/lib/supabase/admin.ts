import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client — bypasses RLS. Server-side ONLY (API routes / server
 * actions). Used for writes that must be validated and scored server-side.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

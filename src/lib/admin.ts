import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Server-side admin gate for /api/admin/* routes: verifies the session AND the
 * is_admin flag in the database (never trusts the client).
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, admin: null };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile?.is_admin) return { user: null, admin: null };
  return { user, admin };
}

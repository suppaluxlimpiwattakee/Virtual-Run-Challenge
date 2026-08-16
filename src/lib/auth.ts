import { createClient } from '@/lib/supabase/server';
import type { Profile, AppSettings } from '@/lib/types';

/**
 * Next.js signals control flow (dynamic rendering, redirect, notFound) by
 * throwing tagged errors. Those must never be swallowed by a catch-all.
 */
function rethrowFrameworkErrors(err: unknown): void {
  if (typeof err === 'object' && err !== null && 'digest' in err) throw err;
}

/** Current auth user + profile (null profile → registration incomplete). */
export async function getUserAndProfile() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { user: null, profile: null };

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    return { user, profile: (profile as Profile | null) ?? null };
  } catch (err) {
    rethrowFrameworkErrors(err);
    // Misconfigured env or Supabase unreachable — treat as signed out rather
    // than crashing the page.
    console.error('[auth] getUserAndProfile failed:', err);
    return { user: null, profile: null };
  }
}

export async function getSettings(): Promise<AppSettings | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle();
    return (data as AppSettings | null) ?? null;
  } catch (err) {
    rethrowFrameworkErrors(err);
    console.error('[settings] load failed:', err);
    return null;
  }
}

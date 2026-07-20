import { createClient } from '@/lib/supabase/server';
import type { Profile, AppSettings } from '@/lib/types';

/** Current auth user + profile (null profile → registration incomplete). */
export async function getUserAndProfile() {
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
}

export async function getSettings(): Promise<AppSettings | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle();
  return (data as AppSettings | null) ?? null;
}

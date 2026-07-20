import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        // Root page routes to /register (first login) or /dashboard
        return NextResponse.redirect(`${origin}/`);
      }
      console.error('[auth] code exchange rejected:', error.message);
    } catch (err) {
      console.error('[auth] code exchange failed:', err);
    }
  }
  return NextResponse.redirect(`${origin}/login`);
}

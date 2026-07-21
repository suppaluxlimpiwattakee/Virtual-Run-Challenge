import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/** Update the caller's own preferences (currently: email reminders on/off). */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.email_reminders !== 'boolean')
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  // Service client so the update also works for admin accounts (RLS blocks
  // self-updates on admin rows); only this whitelisted field is written.
  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({ email_reminders: body.email_reminders })
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: 'Could not save.' }, { status: 500 });
  return NextResponse.json({ ok: true, email_reminders: body.email_reminders });
}

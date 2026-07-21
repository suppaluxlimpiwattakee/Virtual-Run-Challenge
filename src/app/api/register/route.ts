import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  EDUCATION_OPTIONS,
  ETHNICITY_OPTIONS,
  HEIGHT_LIMITS,
  POSITION_OPTIONS,
  RACE_OPTIONS,
  WEIGHT_LIMITS,
} from '@/lib/constants';
import { isValidDateString } from '@/lib/dates';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const {
    access_code,
    full_name,
    nickname,
    dob,
    sex,
    height_cm,
    weight_kg_baseline,
    position,
    education,
    race,
    ethnicity,
    location,
    institution,
    contact,
    consent,
    research_consent,
    email_reminders,
  } = body;

  // ---- Server-side validation ----
  if (consent !== true)
    return NextResponse.json({ error: 'Consent is required to participate.' }, { status: 400 });
  if (typeof full_name !== 'string' || full_name.trim().length < 2)
    return NextResponse.json({ error: 'Please enter your full name.' }, { status: 400 });
  if (typeof nickname !== 'string' || !/^[\w\- ]{2,24}$/.test(nickname.trim()))
    return NextResponse.json(
      { error: 'Nickname must be 2–24 letters, numbers, spaces or dashes.' },
      { status: 400 }
    );
  if (!isValidDateString(dob))
    return NextResponse.json({ error: 'Invalid date of birth.' }, { status: 400 });
  const age = (Date.now() - new Date(dob).getTime()) / (365.25 * 86400000);
  if (age < 16 || age > 110)
    return NextResponse.json({ error: 'Date of birth out of range.' }, { status: 400 });
  if (!['male', 'female', 'other'].includes(sex))
    return NextResponse.json({ error: 'Invalid sex.' }, { status: 400 });
  const h = Number(height_cm);
  const w = Number(weight_kg_baseline);
  if (!Number.isFinite(h) || h < HEIGHT_LIMITS.min || h > HEIGHT_LIMITS.max)
    return NextResponse.json({ error: 'Height must be 90–250 cm.' }, { status: 400 });
  if (!Number.isFinite(w) || w < WEIGHT_LIMITS.min || w > WEIGHT_LIMITS.max)
    return NextResponse.json({ error: 'Weight must be 25–300 kg.' }, { status: 400 });
  if (!POSITION_OPTIONS.includes(position))
    return NextResponse.json({ error: 'Please select your position.' }, { status: 400 });
  if (!EDUCATION_OPTIONS.includes(education))
    return NextResponse.json({ error: 'Please select your education level.' }, { status: 400 });
  if (!RACE_OPTIONS.includes(race))
    return NextResponse.json({ error: 'Please select a race option.' }, { status: 400 });
  if (!ETHNICITY_OPTIONS.includes(ethnicity))
    return NextResponse.json({ error: 'Please select an ethnicity option.' }, { status: 400 });

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from('profiles')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing)
    return NextResponse.json({ error: 'You are already registered.' }, { status: 409 });

  // ---- Access code gate (symposium payment verification) ----
  const code = typeof access_code === 'string' ? access_code.trim().toUpperCase() : '';
  if (!/^[A-Z2-9]{4}-?[A-Z2-9]{4}$/.test(code))
    return NextResponse.json(
      { error: 'Please enter your access code (format: XXXX-XXXX).' },
      { status: 400 }
    );
  const normalized = code.includes('-') ? code : `${code.slice(0, 4)}-${code.slice(4)}`;

  // Atomic claim: only succeeds if the code exists AND is still unused.
  // (used_by references profiles, so we stamp user linkage after insert.)
  const { data: claimed } = await admin
    .from('access_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('code', normalized)
    .is('used_at', null)
    .select('id')
    .maybeSingle();
  if (!claimed)
    return NextResponse.json(
      { error: 'That access code is invalid or has already been used. Check your registration confirmation or contact the organizers.' },
      { status: 400 }
    );

  const releaseCode = () =>
    admin.from('access_codes').update({ used_at: null, used_by: null }).eq('id', claimed.id);

  const { error } = await admin.from('profiles').insert({
    user_id: user.id,
    full_name: full_name.trim(),
    nickname: nickname.trim(),
    dob,
    sex,
    height_cm: h,
    weight_kg_baseline: w,
    position,
    education,
    race,
    ethnicity,
    location: typeof location === 'string' ? location.trim() || null : null,
    institution: typeof institution === 'string' ? institution.trim() || null : null,
    contact: typeof contact === 'string' ? contact.trim() || null : null,
    research_consent: research_consent === true,
    email_reminders: email_reminders === true,
    consent_at: new Date().toISOString(),
    is_admin: false,
  });

  if (error) {
    await releaseCode(); // give the code back so they can retry
    if (error.code === '23505')
      return NextResponse.json(
        { error: 'That nickname is taken — try another one.' },
        { status: 409 }
      );
    return NextResponse.json({ error: 'Registration failed. Try again.' }, { status: 500 });
  }

  // Link the claimed code to the new profile for the admin ledger
  await admin.from('access_codes').update({ used_by: user.id }).eq('id', claimed.id);

  return NextResponse.json({ ok: true });
}

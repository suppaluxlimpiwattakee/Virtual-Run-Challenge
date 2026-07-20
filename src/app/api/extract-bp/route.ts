import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { BP_LIMITS } from '@/lib/constants';
import type { ExtractedBp } from '@/lib/types';

// Server-side only — ANTHROPIC_API_KEY never reaches the client.
// Constructed lazily so builds don't require the key.
let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

const ALLOWED_MEDIA = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
type AllowedMedia = (typeof ALLOWED_MEDIA)[number];

const PROMPT = `You are reading a photo of a home blood pressure monitor screen.
Extract the displayed values and respond with ONLY a JSON object, no other text:
{"sbp": <number|null>, "dbp": <number|null>, "pulse": <number|null>, "confidence": "high"|"low"}

Rules:
- sbp = systolic (the larger, upper number, usually labeled SYS)
- dbp = diastolic (usually labeled DIA)
- pulse = heart rate (usually labeled PUL, PULSE, or a heart symbol)
- Use null for any value you cannot read.
- confidence is "high" only when the screen is clearly readable and the values are unambiguous; otherwise "low".
- If the image is not a BP monitor, return all nulls with "low" confidence.`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.image || typeof body.image !== 'string')
    return NextResponse.json({ error: 'Missing image.' }, { status: 400 });

  const mediaType: AllowedMedia = ALLOWED_MEDIA.includes(body.media_type)
    ? body.media_type
    : 'image/jpeg';

  // ~7 MB base64 cap (≈5 MB binary) — the client compresses before upload
  if (body.image.length > 7_000_000)
    return NextResponse.json({ error: 'Image is too large. Try again.' }, { status: 413 });

  try {
    const response = await getAnthropic().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: body.image },
            },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
      return NextResponse.json({ error: 'Could not read the monitor. Enter values manually.' }, { status: 422 });

    const parsed = JSON.parse(jsonMatch[0]);
    const clean = (v: unknown, min: number, max: number): number | null => {
      const n = Number(v);
      return Number.isInteger(n) && n >= min && n <= max ? n : null;
    };

    const result: ExtractedBp = {
      sbp: clean(parsed.sbp, BP_LIMITS.sbp.min, BP_LIMITS.sbp.max),
      dbp: clean(parsed.dbp, BP_LIMITS.dbp.min, BP_LIMITS.dbp.max),
      pulse: clean(parsed.pulse, BP_LIMITS.pulse.min, BP_LIMITS.pulse.max),
      confidence: parsed.confidence === 'high' ? 'high' : 'low',
    };

    if (result.sbp === null && result.dbp === null)
      return NextResponse.json(
        { error: 'Could not read any values from the photo. Enter them manually.' },
        { status: 422 }
      );

    return NextResponse.json(result);
  } catch (err) {
    console.error('extract-bp failed:', err);
    return NextResponse.json(
      { error: 'Photo reading is temporarily unavailable. Enter values manually.' },
      { status: 502 }
    );
  }
}

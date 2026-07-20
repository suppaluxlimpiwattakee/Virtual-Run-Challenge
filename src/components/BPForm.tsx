'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BP_CRISIS } from '@/lib/constants';
import { todayLocal } from '@/lib/dates';
import { celebrate } from '@/components/celebrate';
import { BadgeToast } from '@/components/BadgeToast';
import type { ExtractedBp } from '@/lib/types';

const input =
  'w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-center text-2xl font-bold shadow-sm focus:border-brand focus:outline-none';

/** Downscale + JPEG-compress a photo before sending it for extraction. */
async function compressImage(file: File): Promise<{ base64: string; blob: Blob }> {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1568;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85)
  );
  const base64 = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(blob);
  });
  return { base64, blob };
}

export function BPForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sbp, setSbp] = useState('');
  const [dbp, setDbp] = useState('');
  const [pulse, setPulse] = useState('');
  const [arm, setArm] = useState<'L' | 'R'>('L');
  const [source, setSource] = useState<'manual' | 'photo'>('manual');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [confidence, setConfidence] = useState<'high' | 'low' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ points: number; scoring: boolean } | null>(null);
  const [crisis, setCrisis] = useState(false);
  const [newBadges, setNewBadges] = useState<string[]>([]);

  async function handlePhoto(file: File) {
    setError(null);
    setExtracting(true);
    try {
      const { base64, blob } = await compressImage(file);
      setPhotoBlob(blob);
      const res = await fetch('/api/extract-bp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, media_type: 'image/jpeg' }),
      });
      const data: ExtractedBp & { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not read the photo. Enter values manually.');
        setSource('manual');
        return;
      }
      setSbp(data.sbp?.toString() ?? '');
      setDbp(data.dbp?.toString() ?? '');
      setPulse(data.pulse?.toString() ?? '');
      setConfidence(data.confidence);
      setSource('photo');
      setConfirming(true); // user must review before saving
    } catch {
      setError('Could not process the photo. Enter values manually.');
      setSource('manual');
    } finally {
      setExtracting(false);
    }
  }

  async function save() {
    setError(null);
    const s = Number(sbp);
    const d = Number(dbp);
    if (!s || !d) {
      setError('Enter both systolic and diastolic values.');
      return;
    }
    setSaving(true);

    // Upload the photo (if any) to the private bucket first
    let photoPath: string | null = null;
    if (photoBlob && source === 'photo') {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const path = `${user.id}/${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from('bp-photos')
          .upload(path, photoBlob, { contentType: 'image/jpeg' });
        if (!upErr) photoPath = path;
      }
    }

    const res = await fetch('/api/logs/bp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sbp: s,
        dbp: d,
        pulse: pulse || null,
        arm,
        source,
        photo_path: photoPath,
        local_date: todayLocal(),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? 'Could not save.');
      return;
    }

    setConfirming(false);
    // Safety warning is NOT gamified: no confetti, no points fanfare
    if (s >= BP_CRISIS.sbp || d >= BP_CRISIS.dbp) {
      setCrisis(true);
    } else {
      setSaved({ points: data.points, scoring: data.scoring });
      if (data.scoring) celebrate();
      setNewBadges(data.newBadges ?? []);
    }
    router.refresh();
  }

  if (crisis) {
    return (
      <div className="rounded-2xl border-2 border-red-500 bg-red-50 p-5">
        <p className="text-lg font-extrabold text-red-700">⚠️ Your reading is very high</p>
        <p className="mt-2 text-sm leading-relaxed text-red-800">
          Your blood pressure reading was saved, but it is in a range that needs attention
          (≥ {BP_CRISIS.sbp}/{BP_CRISIS.dbp} mmHg). Please:
        </p>
        <ul className="mt-2 list-disc pl-5 text-sm leading-relaxed text-red-800">
          <li>Sit down and rest quietly for 5 minutes, then measure again.</li>
          <li>
            If it stays this high — or you have chest pain, shortness of breath, weakness,
            vision changes, or difficulty speaking — <strong>seek urgent medical care now</strong>.
          </li>
        </ul>
        <button onClick={() => setCrisis(false)}
          className="mt-4 w-full rounded-full bg-red-600 py-3 font-bold text-white">
          I understand
        </button>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="animate-pop-in rounded-2xl bg-white p-6 text-center shadow">
        <BadgeToast badges={newBadges} onDone={() => setNewBadges([])} />
        <div className="text-5xl">✅</div>
        <p className="mt-2 text-xl font-extrabold">Reading saved!</p>
        <p className="mt-1 text-sm text-foreground/60">
          {saved.scoring
            ? `+${saved.points} points and a raffle ticket 🎟️`
            : 'Already scored a BP log today — this one still counts toward your trend.'}
        </p>
        <button onClick={() => { setSaved(null); setSbp(''); setDbp(''); setPulse(''); setPhotoBlob(null); setSource('manual'); setConfidence(null); }}
          className="mt-4 rounded-full bg-brand px-6 py-2.5 font-bold text-white">
          Log another
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Photo capture */}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])} />
      <button type="button" onClick={() => fileRef.current?.click()} disabled={extracting}
        className="w-full rounded-2xl border-2 border-dashed border-accent bg-accent/5 py-4 font-bold text-accent transition active:scale-95 disabled:opacity-60">
        {extracting ? '🔍 Reading your monitor…' : '📷 Snap a photo of your monitor'}
      </button>

      {confirming && (
        <div className="animate-pop-in rounded-xl bg-gold/15 px-4 py-3 text-sm font-medium">
          {confidence === 'high'
            ? '✨ Values read from your photo — please check them before saving.'
            : '🤔 The photo was hard to read — please double-check every value below.'}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="mb-1 text-center text-xs font-bold text-foreground/60">SYS (mmHg)</p>
          <input inputMode="numeric" className={input} value={sbp}
            onChange={(e) => setSbp(e.target.value.replace(/\D/g, ''))} placeholder="120" />
        </div>
        <div>
          <p className="mb-1 text-center text-xs font-bold text-foreground/60">DIA (mmHg)</p>
          <input inputMode="numeric" className={input} value={dbp}
            onChange={(e) => setDbp(e.target.value.replace(/\D/g, ''))} placeholder="80" />
        </div>
        <div>
          <p className="mb-1 text-center text-xs font-bold text-foreground/60">Pulse</p>
          <input inputMode="numeric" className={input} value={pulse}
            onChange={(e) => setPulse(e.target.value.replace(/\D/g, ''))} placeholder="70" />
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        <span className="text-sm font-semibold text-foreground/60">Arm:</span>
        {(['L', 'R'] as const).map((a) => (
          <button key={a} type="button" onClick={() => setArm(a)}
            className={`rounded-full px-5 py-1.5 text-sm font-bold transition ${
              arm === a ? 'bg-brand text-white' : 'bg-white ring-1 ring-black/10'
            }`}>
            {a === 'L' ? 'Left' : 'Right'}
          </button>
        ))}
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <button onClick={save} disabled={saving}
        className="w-full rounded-full bg-brand py-4 text-lg font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-60">
        {saving ? 'Saving…' : confirming ? 'Confirm & save' : 'Save reading'}
      </button>
      <p className="text-center text-xs text-foreground/50">
        2 points for your first reading each day · every scoring log = 1 raffle ticket
      </p>
    </div>
  );
}

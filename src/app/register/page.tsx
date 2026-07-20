'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  EDUCATION_OPTIONS,
  ETHNICITY_OPTIONS,
  POSITION_OPTIONS,
  RACE_OPTIONS,
} from '@/lib/constants';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: '',
    nickname: '',
    dob: '',
    sex: '',
    height_cm: '',
    weight_kg_baseline: '',
    position: '',
    education: '',
    race: '',
    ethnicity: '',
    location: '',
    institution: '',
    contact: '',
    consent: false,
    research_consent: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const bmi = useMemo(() => {
    const h = Number(form.height_cm) / 100;
    const w = Number(form.weight_kg_baseline);
    if (!h || !w) return null;
    return Math.round((w / (h * h)) * 10) / 10;
  }, [form.height_cm, form.weight_kg_baseline]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.consent) {
      setError('Please read and accept the privacy notice to join.');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  const input =
    'w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-base shadow-sm focus:border-brand focus:outline-none';
  const label = 'mb-1 block text-sm font-semibold text-foreground/80';

  return (
    <main className="mx-auto max-w-md px-5 py-8 pb-16">
      <div className="text-center">
        <div className="text-5xl">👋</div>
        <h1 className="mt-2 text-2xl font-extrabold text-brand">Welcome! Let’s get you set up</h1>
        <p className="mt-1 text-sm text-foreground/60">
          One-time registration — takes about a minute.
        </p>
      </div>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label className={label}>Full name *</label>
          <input required className={input} value={form.full_name}
            onChange={(e) => set('full_name', e.target.value)} placeholder="Jane Doe" />
        </div>
        <div>
          <label className={label}>Nickname (shown on leaderboards) *</label>
          <input required className={input} value={form.nickname} maxLength={24}
            onChange={(e) => set('nickname', e.target.value)} placeholder="SpeedyJane" />
          <p className="mt-1 text-xs text-foreground/50">
            This is the only name other participants will ever see.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Date of birth *</label>
            <input required type="date" className={input} value={form.dob}
              onChange={(e) => set('dob', e.target.value)} />
          </div>
          <div>
            <label className={label}>Sex *</label>
            <select required className={input} value={form.sex}
              onChange={(e) => set('sex', e.target.value)}>
              <option value="">Select…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Height (cm) *</label>
            <input required type="number" step="0.1" min={90} max={250} className={input}
              value={form.height_cm} onChange={(e) => set('height_cm', e.target.value)} />
          </div>
          <div>
            <label className={label}>Weight (kg) *</label>
            <input required type="number" step="0.1" min={25} max={300} className={input}
              value={form.weight_kg_baseline}
              onChange={(e) => set('weight_kg_baseline', e.target.value)} />
          </div>
        </div>

        {bmi && (
          <div className="animate-pop-in rounded-xl bg-accent/10 px-4 py-3 text-sm">
            Your BMI: <strong>{bmi}</strong>{' '}
            <span className="text-foreground/60">
              — this is your starting point. We’ll track your trend from here!
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Position *</label>
            <select required className={input} value={form.position}
              onChange={(e) => set('position', e.target.value)}>
              <option value="">Select…</option>
              {POSITION_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Education *</label>
            <select required className={input} value={form.education}
              onChange={(e) => set('education', e.target.value)}>
              <option value="">Select…</option>
              {EDUCATION_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Race *</label>
            <select required className={input} value={form.race}
              onChange={(e) => set('race', e.target.value)}>
              <option value="">Select…</option>
              {RACE_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Ethnicity *</label>
            <select required className={input} value={form.ethnicity}
              onChange={(e) => set('ethnicity', e.target.value)}>
              <option value="">Select…</option>
              {ETHNICITY_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={label}>City / location</label>
          <input className={input} value={form.location} placeholder="Irvine, CA"
            onChange={(e) => set('location', e.target.value)} />
        </div>
        <div>
          <label className={label}>Institution / workplace</label>
          <input className={input} value={form.institution}
            onChange={(e) => set('institution', e.target.value)} />
        </div>
        <div>
          <label className={label}>Phone number</label>
          <input type="tel" inputMode="tel" autoComplete="tel" className={input}
            value={form.contact} placeholder="(555) 123-4567"
            onChange={(e) => set('contact', e.target.value)} />
        </div>

        <div className="rounded-xl border border-black/10 bg-white p-4 text-xs leading-relaxed text-foreground/70">
          <p className="mb-2 text-sm font-bold text-foreground">Consent</p>
          <p>
            We collect the details on this form plus your blood pressure, exercise, and weight logs
            to run this challenge. Your health data and personal details are visible only to you
            and the organizing (admin) team. Public leaderboards show your <strong>nickname,
            points, distance, and streak only</strong> — never your blood pressure, weight, or any
            personal details. You can ask the organizers to delete your data at any time.
          </p>
          <label className="mt-3 flex items-start gap-2 text-sm text-foreground">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-brand" checked={form.consent}
              onChange={(e) => set('consent', e.target.checked)} />
            <span>I have read the notice and consent to my health data being collected for this
              challenge. *</span>
          </label>
          <p className="mt-4">
            <strong>Research use (optional):</strong> your blood pressure readings and demographic
            information may also be used, in de-identified form, for future research. Your name and
            contact details will <strong>never</strong> be exposed or published — analyses use
            anonymized data only. You may participate in the challenge without agreeing to this.
          </p>
          <label className="mt-2 flex items-start gap-2 text-sm text-foreground">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-brand"
              checked={form.research_consent}
              onChange={(e) => set('research_consent', e.target.checked)} />
            <span>I agree that my de-identified data may be used for future research.</span>
          </label>
        </div>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}

        <button type="submit" disabled={saving}
          className="w-full rounded-full bg-brand py-4 text-lg font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-60">
          {saving ? 'Joining…' : 'Join the challenge 🚀'}
        </button>
      </form>
    </main>
  );
}

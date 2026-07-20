// Scoring, conversion, and validation rules for the Virtual Run Challenge.
// These are the single source of truth used by the server-side API routes.

export const POINTS = {
  PER_EQUIVALENT_KM: 1,
  PER_BP_LOG: 2, // max one scoring BP log per day
  PER_WEIGH_IN: 5, // one scoring weigh-in per calendar week
  STREAK_BONUS: 20, // every 7 consecutive days with >= 1 log
} as const;

// Weekly raffle-ticket goals — achievable targets over the 2-month challenge.
// Each goal awards 1 ticket per calendar week (idempotent via unique index).
export const TICKET_GOALS = {
  bp_week: {
    label: 'BP tracker',
    description: 'Log your blood pressure on 4+ days this week',
    daysRequired: 4,
  },
  exercise_week: {
    label: 'Stay active',
    description: 'Be active on 3+ days (or cover 10+ km) this week',
    daysRequired: 3,
    kmAlternative: 10,
  },
  weigh_week: {
    label: 'Weekly weigh-in',
    description: 'Record your weight once this week',
  },
  perfect_week: {
    label: 'Perfect week',
    description: 'Hit all three goals in the same week — bonus ticket!',
  },
} as const;

export type TicketGoalKey = keyof typeof TICKET_GOALS;

// Registration option lists (NIH-style categories)
export const RACE_OPTIONS = [
  'American Indian or Alaska Native',
  'Asian',
  'Black or African American',
  'Native Hawaiian or Other Pacific Islander',
  'White',
  'More than one race',
  'Prefer not to say',
] as const;

export const ETHNICITY_OPTIONS = [
  'Hispanic or Latino',
  'Not Hispanic or Latino',
  'Prefer not to say',
] as const;

export const EDUCATION_OPTIONS = [
  'High school or equivalent',
  "Associate's degree",
  "Bachelor's degree",
  "Master's degree",
  'Doctorate or professional degree (MD, PhD, etc.)',
  'Other',
] as const;

export const POSITION_OPTIONS = [
  'Physician',
  'Nurse',
  'Pharmacist',
  'Student',
  'Researcher',
  'Allied health professional',
  'Other',
] as const;

// Non-running activity → equivalent km
export const CONVERSIONS = {
  run: { factor: 1, label: 'Run', detail: '1 km = 1 km' },
  walk: { factor: 1, label: 'Walk', detail: '1 km = 1 km' },
  cycle: { factor: 0.4, label: 'Cycle', detail: '1 km = 0.4 km' },
  other: { perTenMin: 1, label: 'Other', detail: '10 min ≈ 1 km' },
} as const;

export type ActivityType = 'run' | 'walk' | 'cycle' | 'other';

export function equivalentKm(
  activity: ActivityType,
  distanceKm: number | null,
  durationMin: number | null
): number {
  if (activity === 'other') {
    return Math.round(((durationMin ?? 0) / 10) * 100) / 100;
  }
  const factor = activity === 'cycle' ? CONVERSIONS.cycle.factor : 1;
  return Math.round((distanceKm ?? 0) * factor * 100) / 100;
}

export const BP_LIMITS = {
  sbp: { min: 60, max: 260 },
  dbp: { min: 30, max: 160 },
  pulse: { min: 25, max: 220 },
} as const;

// Home BP crisis threshold — shows a non-gamified safety warning
export const BP_CRISIS = { sbp: 180, dbp: 120 } as const;
// Home BP on-target threshold for weekly traffic-light feedback
export const BP_TARGET = { sbp: 135, dbp: 85 } as const;

export const WEIGHT_LIMITS = { min: 25, max: 300 } as const;
export const HEIGHT_LIMITS = { min: 90, max: 250 } as const;
export const DAILY_KM_FLAG_THRESHOLD = 42; // flag (not reject) for admin review

export const BADGES: Record<string, { label: string; emoji: string; description: string }> = {
  first_log: { label: 'First Steps', emoji: '🎉', description: 'Logged your first entry' },
  streak_7: { label: 'One Week Wonder', emoji: '🔥', description: '7-day logging streak' },
  streak_30: { label: 'Habit Hero', emoji: '🏆', description: '30-day logging streak' },
  km_50: { label: '50 km Club', emoji: '👟', description: '50 total equivalent km' },
  km_100: { label: 'Century Runner', emoji: '💯', description: '100 total equivalent km' },
  km_200: { label: 'Road Warrior', emoji: '🚀', description: '200 total equivalent km' },
  bp_improver: { label: 'BP Improver', emoji: '❤️', description: '4-week average systolic dropped ≥ 5 mmHg' },
  perfect_week: { label: 'Perfect Week', emoji: '⭐', description: 'BP + exercise + weigh-in all in one week' },
};

export const FINAL_SPRINT_DAYS = 14;

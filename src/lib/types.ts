export interface Profile {
  user_id: string;
  full_name: string;
  nickname: string;
  dob: string;
  sex: 'male' | 'female' | 'other';
  height_cm: number;
  weight_kg_baseline: number;
  occupation: string | null;
  institution: string | null;
  contact: string | null;
  consent_at: string;
  is_admin: boolean;
  current_streak: number;
  longest_streak: number;
  last_log_date: string | null;
  logging_days: number;
  created_at: string;
}

export interface BpLog {
  id: string;
  user_id: string;
  sbp: number;
  dbp: number;
  pulse: number | null;
  arm: 'L' | 'R' | null;
  measured_at: string;
  local_date: string;
  source: 'manual' | 'photo';
  photo_path: string | null;
  is_scoring: boolean;
  created_at: string;
}

export interface ExerciseLog {
  id: string;
  user_id: string;
  activity_type: 'run' | 'walk' | 'cycle' | 'other';
  distance_km: number | null;
  duration_min: number | null;
  equivalent_km: number;
  logged_at: string;
  local_date: string;
  flagged: boolean;
  created_at: string;
}

export interface WeightLog {
  id: string;
  user_id: string;
  weight_kg: number;
  logged_at: string;
  local_date: string;
  iso_week: string;
  is_scoring: boolean;
  created_at: string;
}

export interface AppSettings {
  id: number;
  challenge_start_date: string;
  challenge_end_date: string;
  route_name: string;
  route_total_km: number;
  double_points: boolean;
  updated_at: string;
}

export interface LeaderboardRow {
  nickname: string;
  total_points: number;
  total_km: number;
  current_streak: number;
  logging_days: number;
}

export interface Badge {
  id: string;
  user_id: string;
  badge_key: string;
  earned_at: string;
}

export interface ExtractedBp {
  sbp: number | null;
  dbp: number | null;
  pulse: number | null;
  confidence: 'high' | 'low';
}

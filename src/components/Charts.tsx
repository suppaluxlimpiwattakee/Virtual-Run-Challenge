'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface BpWeekPoint {
  week: string;
  sbp: number | null;
  dbp: number | null;
}

export function BPTrendChart({ data }: { data: BpWeekPoint[] }) {
  if (!data.length)
    return <p className="py-8 text-center text-sm text-foreground/50">No readings yet — log your first BP to see your trend!</p>;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#00000012" />
        <XAxis dataKey="week" fontSize={10} />
        <YAxis domain={[50, 190]} fontSize={10} />
        <Tooltip />
        <ReferenceLine y={135} stroke="#e85d3d" strokeDasharray="4 4" />
        <ReferenceLine y={85} stroke="#2a9d8f" strokeDasharray="4 4" />
        <Line type="monotone" dataKey="sbp" name="Systolic" stroke="#e85d3d" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
        <Line type="monotone" dataKey="dbp" name="Diastolic" stroke="#2a9d8f" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

export interface WeightPoint {
  date: string;
  weight: number;
}

export function WeightTrendChart({ data, baseline }: { data: WeightPoint[]; baseline: number }) {
  if (!data.length)
    return <p className="py-8 text-center text-sm text-foreground/50">No weigh-ins yet — one per week keeps the trend going!</p>;
  const values = [...data.map((d) => d.weight), baseline];
  const min = Math.floor(Math.min(...values) - 2);
  const max = Math.ceil(Math.max(...values) + 2);
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#00000012" />
        <XAxis dataKey="date" fontSize={10} />
        <YAxis domain={[min, max]} fontSize={10} />
        <Tooltip />
        <ReferenceLine y={baseline} stroke="#f4a825" strokeDasharray="4 4" label={{ value: 'baseline', fontSize: 10 }} />
        <Line type="monotone" dataKey="weight" name="Weight (kg)" stroke="#e85d3d" strokeWidth={2.5} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

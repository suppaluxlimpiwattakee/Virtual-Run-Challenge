'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const COLORS = ['#e85d3d', '#2a9d8f', '#f4a825', '#5a67d8', '#d53f8c', '#38a169', '#718096'];

export function CohortBpChart({
  data,
}: {
  data: { week: string; sbp: number | null; dbp: number | null; readings: number }[];
}) {
  if (!data.length)
    return <p className="py-8 text-center text-sm text-foreground/50">No BP data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#00000012" />
        <XAxis dataKey="week" fontSize={10} />
        <YAxis domain={['dataMin - 5', 'dataMax + 5']} fontSize={10} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="sbp" name="Avg systolic" stroke="#e85d3d" strokeWidth={2.5} dot />
        <Line type="monotone" dataKey="dbp" name="Avg diastolic" stroke="#2a9d8f" strokeWidth={2.5} dot />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function WeeklyBarChart({
  data,
  dataKey,
  name,
  color = '#e85d3d',
}: {
  data: Record<string, string | number>[];
  dataKey: string;
  name: string;
  color?: string;
}) {
  if (!data.length)
    return <p className="py-8 text-center text-sm text-foreground/50">No data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#00000012" />
        <XAxis dataKey="week" fontSize={10} />
        <YAxis allowDecimals={false} fontSize={10} />
        <Tooltip />
        <Bar dataKey={dataKey} name={name} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BreakdownPie({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length)
    return <p className="py-8 text-center text-sm text-foreground/50">No data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius={80}
          label={(p) => `${p.name} (${p.value})`} labelLine={false} fontSize={10}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function BreakdownBars({ data, color = '#5a67d8' }: { data: { name: string; value: number }[]; color?: string }) {
  if (!data.length)
    return <p className="py-8 text-center text-sm text-foreground/50">No data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 40, bottom: 4 }}>
        <XAxis type="number" allowDecimals={false} fontSize={10} />
        <YAxis type="category" dataKey="name" width={120} fontSize={10} />
        <Tooltip />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11 }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

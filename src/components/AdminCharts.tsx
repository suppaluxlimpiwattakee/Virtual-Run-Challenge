'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export function LogsPerDayChart({ data }: { data: { date: string; logs: number }[] }) {
  if (!data.length)
    return <p className="py-8 text-center text-sm text-foreground/50">No logs yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#00000012" />
        <XAxis dataKey="date" fontSize={10} />
        <YAxis allowDecimals={false} fontSize={10} />
        <Tooltip />
        <Bar dataKey="logs" fill="#e85d3d" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

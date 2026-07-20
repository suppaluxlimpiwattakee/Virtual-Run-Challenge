'use client';

import { useMemo, useState } from 'react';

export interface Entrant {
  nickname: string;
  tickets: number;
}

const COLORS = [
  '#e85d3d', '#2a9d8f', '#f4a825', '#5a67d8', '#d53f8c',
  '#38a169', '#dd6b20', '#319795', '#805ad5', '#e53e3e',
];

interface Segment {
  nickname: string;
  tickets: number;
  startDeg: number; // from top, clockwise
  endDeg: number;
  color: string;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  // deg measured clockwise from 12 o'clock
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z`;
}

export function LuckyWheel({
  entrants,
  rotation,
  spinning,
  size = 420,
}: {
  entrants: Entrant[];
  rotation: number; // degrees to rotate the wheel (cumulative)
  spinning: boolean;
  size?: number;
}) {
  const segments: Segment[] = useMemo(() => {
    const total = entrants.reduce((s, e) => s + e.tickets, 0) || 1;
    let angle = 0;
    return entrants.map((e, i) => {
      const span = (e.tickets / total) * 360;
      const seg: Segment = {
        nickname: e.nickname,
        tickets: e.tickets,
        startDeg: angle,
        endDeg: angle + span,
        color: COLORS[i % COLORS.length],
      };
      angle += span;
      return seg;
    });
  }, [entrants]);

  const c = size / 2;
  const r = c - 8;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      {/* Pointer */}
      <div
        className="absolute left-1/2 top-0 z-10 -translate-x-1/2"
        style={{
          width: 0,
          height: 0,
          borderLeft: '14px solid transparent',
          borderRight: '14px solid transparent',
          borderTop: '26px solid #1f2430',
          filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))',
        }}
      />
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? 'transform 5s cubic-bezier(0.12, 0.6, 0.08, 1)' : 'none',
        }}
      >
        <circle cx={c} cy={c} r={r + 6} fill="#1f2430" />
        {segments.length === 1 ? (
          <circle cx={c} cy={c} r={r} fill={segments[0].color} />
        ) : (
          segments.map((s, i) => (
            <path key={i} d={arcPath(c, c, r, s.startDeg, s.endDeg)} fill={s.color}
              stroke="#ffffff" strokeWidth="1.5" />
          ))
        )}
        {segments.map((s, i) => {
          const span = s.endDeg - s.startDeg;
          if (span < 14) return null; // too thin to label
          const mid = (s.startDeg + s.endDeg) / 2;
          const pos = polar(c, c, r * 0.62, mid);
          return (
            <text key={`t${i}`} x={pos.x} y={pos.y} fill="#fff" fontSize={Math.min(16, 8 + span / 4)}
              fontWeight="bold" textAnchor="middle" dominantBaseline="middle"
              transform={`rotate(${mid} ${pos.x} ${pos.y})`}>
              {s.nickname.length > 12 ? s.nickname.slice(0, 11) + '…' : s.nickname}
            </text>
          );
        })}
        <circle cx={c} cy={c} r={30} fill="#ffffff" />
        <text x={c} y={c + 7} fontSize="24" textAnchor="middle">🎟️</text>
      </svg>
    </div>
  );
}

/**
 * Compute the cumulative rotation needed for the wheel to stop with `winner`'s
 * segment under the top pointer, given current cumulative rotation.
 */
export function targetRotation(
  entrants: Entrant[],
  winner: string,
  currentRotation: number
): number {
  const total = entrants.reduce((s, e) => s + e.tickets, 0) || 1;
  let angle = 0;
  let center = 0;
  let span = 360;
  for (const e of entrants) {
    const s = (e.tickets / total) * 360;
    if (e.nickname === winner) {
      span = s;
      center = angle + s / 2;
      break;
    }
    angle += s;
  }
  // jitter within the middle 70% of the segment so it doesn't look scripted
  const jitter = (Math.random() - 0.5) * span * 0.7;
  const landing = center + jitter; // degrees from top, clockwise
  // Wheel must rotate so `landing` sits at 0° (top): rotation ≡ -landing (mod 360)
  const desiredMod = ((-landing % 360) + 360) % 360;
  const currentMod = ((currentRotation % 360) + 360) % 360;
  const delta = ((desiredMod - currentMod + 360) % 360) + 360 * 6; // 6 extra spins
  return currentRotation + delta;
}

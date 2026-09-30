/** Hairline line language shared by scenes 2–3: bundles of fine curves, fans converging on a point, colour waves. */
import React from "react";

export const STRAND = ["#E0703F", "#6E63D9", "#3F8F55", "#2F86A8", "#C41C72", "#C9A21F"];

/** A ring broken into hairline bundles. `spin` in degrees, `gap` 0..1 opens the segments. */
export const HairRing: React.FC<{ r0: number; cols: string[]; spin: number; seg?: number; n?: number; opacity?: number }> = ({ r0, cols, spin, seg = 0.62, n = 9, opacity = 1 }) => (
  <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", transform: `rotate(${spin}deg)`, opacity, overflow: "visible" }}>
    {cols.map((c, i) =>
      Array.from({ length: n }, (_, j) => {
        const r = r0 + j * 1.3;
        const len = r * seg;
        return (
          <circle key={`${i}-${j}`} r={r} cx={50} cy={50} fill="none" stroke={c} strokeWidth={0.35} strokeLinecap="round"
            strokeDasharray={`${len} ${r * 6.283 - len}`} strokeDashoffset={-((i * r * 6.283) / cols.length) - j * 1.1}
            opacity={0.35 + 0.65 * (1 - Math.abs(j - (n - 1) / 2) / ((n - 1) / 2))} />
        );
      }),
    )}
  </svg>
);

/** Fans of hairlines from each source converging on (fx, fy). `draw` 0..1 draws them on. Coordinates in the 100×56.25 frame box. */
export const Fans: React.FC<{ sources: [number, number, string][]; fx: number; fy: number; draw: number; n?: number; spread?: number }> = ({ sources, fx, fy, draw, n = 16, spread = 2.6 }) => (
  <svg className="stage" viewBox="0 0 100 56.25" preserveAspectRatio="none">
    <defs>
      {sources.map(([x, y, c], k) => (
        <linearGradient key={k} id={`fg${k}`} gradientUnits="userSpaceOnUse" x1={x} y1={y} x2={fx} y2={fy}>
          <stop offset="0" stopColor={c} stopOpacity="0" /><stop offset=".25" stopColor={c} stopOpacity=".75" /><stop offset="1" stopColor="#C41C72" stopOpacity=".95" />
        </linearGradient>
      ))}
    </defs>
    {sources.map(([x, y], k) =>
      Array.from({ length: n }, (_, j) => {
        const o = (j - (n - 1) / 2) / ((n - 1) / 2);
        const d = `M${x + 3.6} ${y + o * spread * 0.35} C${x + 16 + o * 3} ${y + o * spread},${fx - 16 - Math.abs(o) * 4} ${fy + (y - fy) * 0.12 + o * spread * 0.6},${fx} ${fy}`;
        const local = Math.max(0, Math.min(1, draw * 1.25 - k * 0.04 - Math.abs(o) * 0.08));
        return <path key={`${k}-${j}`} d={d} fill="none" stroke={`url(#fg${k})`} strokeWidth={0.07} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - local} opacity={0.35 + 0.65 * (1 - Math.abs(o))} />;
      }),
    )}
  </svg>
);

/** Colour waves that ripple along a line and settle into one Berry line. `settle` 0 → wavy, 1 → flat. `phase` animates the ripple. */
export const Waves: React.FC<{ settle: number; phase: number; x1?: number; x2?: number; y?: number; draw?: number; tail?: number }> = ({ settle, phase, x1 = -2, x2 = 46, y = 28.1, draw = 1, tail = 14 }) => {
  const cols = ["#EAB9CB", "#ECBF9B", "#B8BDEE", "#A6D1E0"];
  return (
    <svg className="stage" viewBox="0 0 100 56.25" preserveAspectRatio="none" style={{ overflow: "visible" }}>
      {cols.map((c, k) => {
        const amp = [5.5, -3.5, 4.2, -2.6][k] * (1 - settle);
        const pts: string[] = [];
        for (let i = 0; i <= 60; i++) {
          const x = x1 + ((x2 - x1) * i) / 60;
          const env = Math.sin((Math.PI * i) / 60) ** 1.5;
          pts.push(`${x.toFixed(2)},${(y + amp * env * Math.sin(i / 6 + phase + k * 1.3)).toFixed(2)}`);
        }
        return <polyline key={k} points={pts.join(" ")} fill="none" stroke={c} strokeWidth={0.55} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} opacity={1 - 0.95 * settle ** 2} />;
      })}
      <line x1={x1} y1={y} x2={x2 + tail} y2={y} stroke="#C41C72" opacity={settle ** 1.5} strokeWidth={0.55} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} />
      <line x1={x2 - 6} y1={y} x2={x2 + tail} y2={y} stroke="#C41C72" strokeWidth={0.55} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - Math.max(0, Math.min(1, (draw - 0.6) / 0.4))} />
    </svg>
  );
};

/** Sweeping hairline bundles across the frame. `draw` 0..1. */
export const Sweep: React.FC<{ draw: number; opacity?: number }> = ({ draw, opacity = 1 }) => {
  const cols = ["#C41C72", "#E0703F", "#6E63D9"];
  return (
    <svg className="stage" viewBox="0 0 100 56.25" preserveAspectRatio="none" style={{ opacity }}>
      <defs>
        {cols.map((c, i) => (
          <linearGradient key={i} id={`sw${i}`} gradientUnits="userSpaceOnUse" x1="10" y1="56" x2="100" y2="0">
            <stop offset="0" stopColor={c} stopOpacity="0" /><stop offset=".35" stopColor={c} stopOpacity=".85" /><stop offset="1" stopColor={c} stopOpacity=".35" />
          </linearGradient>
        ))}
      </defs>
      {cols.map((_, i) =>
        Array.from({ length: 18 }, (_, j) => {
          const o = (j - 8.5) / 8.5;
          const b = i * 3.2 + o * 1.4;
          return (
            <path key={`${i}-${j}`} d={`M 12 ${60 + b} C 40 ${44 + b * 1.1}, 70 ${26 + b * 0.9}, 104 ${-2 + b * 0.6}`} fill="none" stroke={`url(#sw${i})`} strokeWidth={0.07}
              pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - Math.max(0, Math.min(1, draw * 1.2 - i * 0.08))} opacity={0.35 + 0.65 * (1 - Math.abs(o))} />
          );
        }),
      )}
    </svg>
  );
};

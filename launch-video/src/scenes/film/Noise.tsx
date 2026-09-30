import React from "react";
import { useCurrentFrame } from "remotion";
import { FONT, MONO } from "../../brand/fonts";
import { EASE, clamp } from "../../brand/motion";
import { CURVE } from "../../brand/physics";
import { colour, stage } from "../../brand/tokens";
import { FRAGMENT_KINDS, Fragment } from "../../ui/Fragments";
import { Stage } from "../../ui/Stage";
import { PILLS, PillChip } from "../Pills";
import { rnd } from "../shared3";

/**
 * Scene 1 · The Noise (0:00–0:10). Many.
 *   0–215    the vocabulary of a business decodes word by word, faster and
 *            faster, and real fragments spawn around it in depth (1 → 110)
 *   215–420  the pill flow: every feature, flowing, accelerating
 *   420–540  hard cut: the "switch" wall, rows accelerating with motion blur
 *   540–600  back in the swarm, violent; "Everywhere." slams; the camera
 *            flies through the letters into the core
 */
export const NOISE_FRAMES = 600;

const WORDS = [
  { w: "Tasks.", at: 8 },
  { w: "Projects.", at: 58 },
  { w: "Invoices.", at: 98 },
  { w: "Clients.", at: 130 },
  { w: "Notes.", at: 156 },
  { w: "Calendar.", at: 176 },
  { w: "Docs.", at: 192 },
];
const COUNTS = [1, 4, 12, 30, 52, 80, 110];
const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#$%&*+=<>/";

/** One word decoding: scrambled Geist Mono glyphs lock in left to right into Geist Semibold. */
const Decode: React.FC<{ word: string; f0: number; f: number; size: number }> = ({ word, f0, f, size }) => (
  <div style={{ display: "flex", fontFamily: FONT, fontWeight: 600, fontSize: size, letterSpacing: "-0.05em", lineHeight: 1, color: stage.inkText }}>
    {word.split("").map((ch, i) => {
      const lock = f0 + 2 + i;
      const locked = f >= lock;
      const g = GLYPHS[Math.floor(rnd(`${word}-${i}-${f}`) * GLYPHS.length)];
      return (
        <span key={i} style={{ position: "relative", display: "inline-block" }}>
          <span style={{ opacity: locked ? 1 : 0 }}>{ch}</span>
          {!locked && f >= f0 ? (
            <span style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", fontFamily: MONO, fontWeight: 400, fontSize: size * 0.7, opacity: 0.6, color: colour.blush }}>{g}</span>
          ) : null}
        </span>
      );
    })}
  </div>
);

/* ——— The swarm: seeded shells, each fragment on its own orbit. ——— */
type P = { i: number; th: number; ph: number; r: number; w: number; badge?: number };
export const SWARM: P[] = Array.from({ length: 110 }, (_, i) => ({
  i,
  th: rnd(`sw-th-${i}`, 0, Math.PI * 2),
  ph: Math.acos(rnd(`sw-ph-${i}`, -0.85, 0.85)),
  r: rnd(`sw-r-${i}`, 560, 1500),
  w: rnd(`sw-w-${i}`, 0.0025, 0.007) * (rnd(`sw-d-${i}`) < 0.3 ? -1 : 1),
  badge: rnd(`sw-b-${i}`) < 0.16 ? Math.ceil(rnd(`sw-bn-${i}`, 1, 9)) : undefined,
}));

/** Where every fragment is at a given swarm time (shared with the Collapse so the freeze matches). */
export const swarmAt = (time: number, spin = 1) =>
  SWARM.map((p) => {
    const th = p.th + time * p.w * spin + time * 0.0015;
    const x = p.r * Math.sin(p.ph) * Math.cos(th);
    const y = p.r * Math.cos(p.ph) * 0.62;
    const z = p.r * Math.sin(p.ph) * Math.sin(th);
    return { ...p, x, y, z };
  });

export const project = (p: { x: number; y: number; z: number }, d = 1700) => {
  const zz = Math.max(-d + 220, p.z);
  const s = 1500 / (d + zz);
  return { x: 960 + p.x * s, y: 540 + p.y * s, s, z: zz };
};

export const Swarm: React.FC<{ time: number; count: number; d?: number; spin?: number; dim?: number; glow?: number; spawnFrom?: number[]; f?: number }> = ({ time, count, d = 1700, spin = 1, dim = 1, glow = 0, spawnFrom, f = 0 }) => {
  const pts = swarmAt(time, spin)
    .slice(0, count)
    .map((p) => ({ p, q: project(p, d) }))
    .sort((a, b) => b.p.z - a.p.z);
  return (
    <>
      {pts.map(({ p, q }) => {
        const fog = Math.max(0.2, Math.min(1, 1.1 - (p.z + 600) / 2200));
        const blur = Math.min(14, Math.abs(p.z + 150) / 95);
        // Each fragment arrives out of depth when its word decodes.
        const born = spawnFrom ? clamp(f, [spawnFrom[p.i] ?? 0, (spawnFrom[p.i] ?? 0) + 18], [0, 1], EASE.settle) : 1;
        if (born <= 0) return null;
        return (
          <div
            key={p.i}
            style={{
              position: "absolute",
              left: q.x,
              top: q.y,
              transform: `translate(-50%, -50%) scale(${q.s * 0.9 * (0.6 + 0.4 * born)}) perspective(900px) rotateY(${(-p.x / 1500) * 25}deg) rotateX(${(p.y / 900) * 14}deg)`,
              filter: `blur(${blur + (1 - born) * 8}px) brightness(${(0.55 + 0.45 * fog) * (1 + glow)})`,
              // Fragments reaching the lens fade instead of washing the frame out.
              opacity: (0.3 + 0.7 * fog) * dim * born * clamp(q.z, [-1200, -900], [0, 1]),
            }}
          >
            <Fragment kind={FRAGMENT_KINDS[p.i % FRAGMENT_KINDS.length]} i={p.i} light="ink" badge={p.badge && Math.floor((f + p.i * 7) / 20) % 3 !== 0 ? p.badge : undefined} />
          </div>
        );
      })}
    </>
  );
};

/** The frame each fragment is born on: its word's decode. */
const SPAWN: number[] = SWARM.map((p) => {
  const k = COUNTS.findIndex((c) => p.i < c);
  return WORDS[Math.max(0, k)].at + (p.i % 5) * 2;
});

/* ——— Pills on Ink: the feature vocabulary, flowing. ——— */
const inkPill = (p: (typeof PILLS)[number]) => (p.bg === colour.ink ? { ...p, bg: colour.paper, fg: colour.ink } : p);
const PillFlow: React.FC<{ f: number }> = ({ f }) => {
  const rows = 7;
  const H = 104;
  const T = f / 60;
  return (
    <>
      {Array.from({ length: rows }, (_, r) => {
        const y = 540 + (r - (rows - 1) / 2) * (H + 26);
        const dir = r % 2 ? 1 : -1;
        // Accelerating flow: position is the integral of a rising speed (150 → 900 px/s).
        const x = 150 * T + (750 / 2) * ((T * T) / 3.4) + rnd(`pr-${r}`, 0, 500);
        const enter = clamp(f, [r * 3, r * 3 + 26], [0, 1], EASE.settle);
        const order = [...PILLS].sort((a, b) => rnd(`n${r}-${a.label}`) - rnd(`n${r}-${b.label}`));
        return (
          <div key={r} style={{ position: "absolute", left: (dir > 0 ? -3500 : -1200) + dir * x - (1 - enter) * dir * 700, top: y - H / 2, display: "flex", gap: 20, opacity: enter }}>
            {Array.from({ length: 22 }, (_, i) => (
              <PillChip key={i} p={inkPill(order[i % order.length])} h={H} />
            ))}
          </div>
        );
      })}
    </>
  );
};

/* ——— The switch wall. ——— */
const Wall: React.FC<{ f: number }> = ({ f }) => {
  const rows = 9;
  const T = f / 60;
  const speed = 200 + 1800 * Math.min(1, T / 2);
  const blur = Math.max(0, (speed - 400) / 160);
  return (
    <>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <filter id="mblur">
          <feGaussianBlur stdDeviation={`${blur} 0`} />
        </filter>
      </svg>
      {Array.from({ length: rows }, (_, r) => {
        const off = r - (rows - 1) / 2;
        const dir = r % 2 ? 1 : -1;
        const x = 200 * T + 900 * T * T * 0.5 + rnd(`wr-${r}`, 0, 400);
        const centre = off === 0;
        return (
          <div
            key={r}
            style={{
              position: "absolute",
              left: (dir > 0 ? -4800 : -1400) + dir * x,
              top: 540 + off * 118,
              transform: "translateY(-50%)",
              whiteSpace: "nowrap",
              fontFamily: FONT,
              fontWeight: 600,
              fontSize: 96,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              color: stage.inkText,
              opacity: centre ? 1 : 0.3,
              filter: blur > 0.3 ? "url(#mblur)" : undefined,
            }}
          >
            {Array.from({ length: 24 }, () => "switch").join("  ")}
          </div>
        );
      })}
    </>
  );
};

export const Noise: React.FC = () => {
  const f = useCurrentFrame();
  const wordIdx = WORDS.reduce((k, w, i) => (f >= w.at ? i : k), -1);
  const count = COUNTS[Math.max(0, wordIdx)];
  // The words give way to the pills.
  const wordsOut = clamp(f, [205, 222], [1, 0]);
  const pills = f >= 215 && f < 420;
  const wall = f >= 420 && f < 540;
  const slam = f >= 540;
  // Camera: pulls back during the pills (1b), then violent in the slam.
  const d = slam ? 1750 - 250 * clamp(f, [570, 600], [0, 1], CURVE.depart) : 1700 + 500 * clamp(f, [205, 330], [0, 1], EASE.settle);
  const pop = clamp(f, [540, 548], [1.35, 1], EASE.settle);
  const fly = clamp(f, [572, 600], [0, 1], CURVE.depart);
  return (
    <Stage kind="ink">
      {!wall ? (
        <div style={{ position: "absolute", inset: 0, transform: slam ? `scale(${1 + fly * 1.2})` : undefined }}>
          <Swarm time={f} count={slam ? 110 : pills ? 110 : count} d={d} spin={slam ? 5 : 1} dim={pills ? 0.45 : 1} spawnFrom={SPAWN} f={f} />
        </div>
      ) : null}
      {wordIdx >= 0 && f < 222 ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 540, transform: "translateY(-50%)", display: "flex", justifyContent: "center", opacity: wordsOut }}>
          <Decode key={wordIdx} word={WORDS[wordIdx].w} f0={WORDS[wordIdx].at} f={f} size={160} />
        </div>
      ) : null}
      {pills ? (
        <div style={{ position: "absolute", inset: 0 }}>
          <PillFlow f={f - 215} />
        </div>
      ) : null}
      {wall ? <Wall f={f - 420} /> : null}
      {slam ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -54%) scale(${pop * (1 + fly * 8)})`,
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: 380,
            letterSpacing: "-0.05em",
            lineHeight: 1,
            color: stage.inkText,
            whiteSpace: "nowrap",
            textShadow: "0 0 80px rgba(196, 28, 114, 0.45)",
            opacity: 1 - clamp(f, [588, 600], [0, 1]),
            filter: `blur(${fly * 10}px)`,
          }}
        >
          Everywhere.
        </div>
      ) : null}
    </Stage>
  );
};

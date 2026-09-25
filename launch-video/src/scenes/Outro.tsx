import React from "react";
import { useCurrentFrame } from "remotion";
import { FONT, MONO } from "../brand/fonts";
import { GlyphName } from "../brand/glyphs.generated";
import { LOCKUP_MARK } from "../brand/logo.generated";
import { EASE, clamp } from "../brand/motion";
import { respond } from "../brand/physics";
import { energy, stage } from "../brand/tokens";
import { Icon } from "../components/Glyph";
import { EnergyField } from "../gl/EnergyField";
import { Finish } from "../ui/Stage";
import { Lockup } from "../ui/Lockup";
import { rnd } from "./shared3";

/**
 * The outro: "the construction sheet" (user references: brand-construction
 * frame, blueprint, exploded technical diagrams, orbit diagrams, halftone).
 * The Zenboard mark is drawn as a technical drawing on the Ink stage, lit by
 * the energy field: guides, lobe radii, dimensions, a halftone fill, orbits
 * carrying light, the four things it holds with live data, an exploded view of
 * the workspace's layers and a title block. Then the white lockup rises in
 * front and its selection handles snap in. 7s; the last 2.5s hold while the
 * orbits and the light keep moving.
 */
export const OUTRO_FRAMES = 420;

const C = { x: 960, y: 540 };
const MS = 620;
const U = MS / 32;
const LOBES = [
  { x: 7.4, y: 7.4 },
  { x: 24.6, y: 7.4 },
  { x: 7.4, y: 24.6 },
  { x: 24.6, y: 24.6 },
].map((p) => ({ x: C.x + (p.x - 16) * U, y: C.y + (p.y - 16) * U }));
const R = 7.4 * U;

const CREAM = (a: number) => `rgba(247, 241, 232, ${a})`;
const LINE = CREAM(0.3);
const SOFT = CREAM(0.14);

/** Progress of a window on the settle curve. */
const at = (f: number, a: number, b: number) => clamp(f, [a, b], [0, 1], EASE.settle);

/** A solid line that draws itself (pathLength-normalised). */
const Draw: React.FC<{ d: string; p: number; stroke?: string; w?: number; style?: React.CSSProperties }> = ({ d, p, stroke = LINE, w = 1.2, style }) => (
  <path d={d} fill="none" stroke={stroke} strokeWidth={w} pathLength={1} strokeDasharray={`${p} 2`} strokeLinecap="round" style={style} />
);

const Mono: React.FC<{ x: number; y: number; o: number; children: React.ReactNode; rotate?: number; size?: number; align?: "left" | "center" }> = ({ x, y, o, children, rotate = 0, size = 16, align = "left" }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      fontFamily: MONO,
      fontSize: size,
      letterSpacing: "0.08em",
      color: CREAM(0.62),
      transform: `${align === "center" ? "translateX(-50%) " : ""}rotate(${rotate}deg)`,
      transformOrigin: "0 0",
      whiteSpace: "nowrap",
      opacity: o,
    }}
  >
    {children}
  </div>
);

/** A feature tag with a tiny live histogram of its data, like a lab readout. */
const Tag: React.FC<{ x: number; y: number; icon: GlyphName; label: string; data: string; f: number; t0: number; seed: string; right?: boolean }> = ({ x, y, icon, label, data, f, t0, seed, right }) => {
  const o = at(f, t0, t0 + 20);
  const bars = 14;
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: o, translate: `${(1 - o) * (right ? 16 : -16)}px 0px`, display: "flex", flexDirection: right ? "row" : "row-reverse", alignItems: "flex-end", gap: 12 }}>
      <div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", background: CREAM(0.09), border: `1px solid ${LINE}`, fontFamily: MONO, fontSize: 17, letterSpacing: "0.08em", color: CREAM(0.8) }}>
          <Icon name={icon} size={18} tint={CREAM(0.8)} fill />
          {label}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 13, color: CREAM(0.5), marginTop: 6, letterSpacing: "0.04em", textAlign: right ? "left" : "right" }}>{data}</div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 40, paddingBottom: 22 }}>
        {Array.from({ length: bars }, (_, i) => {
          const h = rnd(`${seed}-${i}`, 0.15, 1);
          const g = at(f, t0 + 8 + i * 1.5, t0 + 30 + i * 1.5);
          return <div key={i} style={{ width: 4, height: 34 * h * g, background: i === bars - 1 ? energy.rose : CREAM(0.55) }} />;
        })}
      </div>
    </div>
  );
};

/** fig. 02: an exploded isometric view of the workspace's layers (Making Software-style). */
const Exploded: React.FC<{ f: number; x: number; y: number }> = ({ f, x, y }) => {
  const layers = [
    { label: "MONEY", icon: "receipt" as GlyphName },
    { label: "CLIENTS", icon: "users" as GlyphName },
    { label: "DOCS", icon: "file-text" as GlyphName },
    { label: "TASKS", icon: "list-checks" as GlyphName },
  ];
  const open = at(f, 150, 230);
  const iso = (px: number, py: number) => `${px * 0.866 - py * 0.866},${(px + py) * 0.5}`;
  const W = 150;
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: at(f, 140, 170) }}>
      <svg width={360} height={300} style={{ overflow: "visible" }}>
        {layers.map((l, i) => {
          const dy = 190 - i * (16 + 34 * open);
          const top = i === layers.length - 1;
          return (
            <g key={l.label} transform={`translate(150 ${dy})`}>
              <polygon points={`${iso(0, 0)} ${iso(W, 0)} ${iso(W, W)} ${iso(0, W)}`} fill={top ? `${energy.pink}55` : CREAM(0.06)} stroke={top ? energy.rose : LINE} strokeWidth={1} />
              <polygon points={`${iso(0, W)} ${iso(W, W)} ${iso(W, W)},6 ${iso(0, W)},6`} fill="none" />
              {/* The leader line and its label. */}
              <line x1={iso(W, W / 2).split(",")[0]} y1={iso(W, W / 2).split(",")[1]} x2={170} y2={Number(iso(W, W / 2).split(",")[1])} stroke={LINE} strokeDasharray="3 4" />
              <text x={178} y={Number(iso(W, W / 2).split(",")[1]) + 5} fill={CREAM(0.65)} fontFamily={MONO} fontSize={13} letterSpacing="0.08em">
                {l.label}
              </text>
            </g>
          );
        })}
        {/* The vertical assembly axis. */}
        <line x1={150} y1={40 - 60 * open} x2={150} y2={260} stroke={SOFT} strokeDasharray="4 5" />
      </svg>
      <Mono x={-20} y={-40} o={1} size={13}>
        fig. 02 — one workspace, every layer
      </Mono>
    </div>
  );
};

/** The drawing-sheet title block (blueprint reference). */
const TitleBlock: React.FC<{ f: number; x: number; y: number }> = ({ f, x, y }) => {
  const p = at(f, 160, 220);
  const t = at(f, 185, 235);
  const W = 440;
  const H = 120;
  return (
    <div style={{ position: "absolute", left: x, top: y }}>
      <svg width={W} height={H} style={{ overflow: "visible", position: "absolute" }}>
        <Draw d={`M0 0 H${W} V${H} H0 Z`} p={p} />
        <Draw d={`M0 40 H${W}`} p={p} />
        <Draw d={`M0 80 H${W}`} p={p} />
        <Draw d={`M240 0 V${H}`} p={p} />
        <Draw d={`M350 40 V${H}`} p={p} />
      </svg>
      {[
        ["ZENBOARD — THE MARK", 12, 13],
        ["fig. 01", 252, 13],
        ["SCALE 1:20", 12, 53],
        ["REV 2026.09", 252, 53],
        ["A1", 362, 53],
        ["LIFE DESIGN STUDIO", 12, 93],
        ["SHEET 1/1", 252, 93],
        ["OK", 362, 93],
      ].map(([s, lx, ly]) => (
        <div key={s as string} style={{ position: "absolute", left: lx as number, top: ly as number, fontFamily: MONO, fontSize: 13, letterSpacing: "0.08em", color: CREAM(0.62), opacity: t, whiteSpace: "nowrap" }}>
          {s}
        </div>
      ))}
    </div>
  );
};

/** Orbits around the mark (atom / orbit-diagram references), each carrying light. */
const ORBITS = [
  { rx: 520, ry: 150, rot: -28, colour: energy.pink, speed: 0.55, label: "0°/+45°" },
  { rx: 520, ry: 150, rot: 28, colour: energy.apricot, speed: -0.45, label: "180°/−45°" },
  { rx: 400, ry: 95, rot: 90, colour: energy.lavender, speed: 0.4, label: "90°/0°" },
];
const orbitPoint = (o: (typeof ORBITS)[number], a: number) => {
  const x = Math.cos(a) * o.rx;
  const y = Math.sin(a) * o.ry;
  const t = (o.rot * Math.PI) / 180;
  return { x: C.x + x * Math.cos(t) - y * Math.sin(t), y: C.y + x * Math.sin(t) + y * Math.cos(t) };
};

export const OutroArt: React.FC<{ f: number }> = ({ f }) => {
  const field = at(f, 0, 70);
  const frame = at(f, 0, 50);
  const guides = at(f, 10, 60);
  const circles = LOBES.map((_, i) => at(f, 30 + i * 8, 90 + i * 8));
  const halftone = at(f, 50, 140);
  const outline = at(f, 40, 120);
  const orbitDraw = at(f, 70, 140);
  const dims = at(f, 90, 150);
  const lock = at(f, 200, 250);
  const snap = respond(f, 240);
  const tagline = at(f, 255, 300);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: stage.ink, fontFamily: FONT }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.25 + 0.75 * field }}>
        <EnergyField t={f / 60 + 3} intensity={0.35 + 0.65 * field} frame={f} />
      </div>

      {/* The mark: an energy-lit translucent body, a halftone screen, a traced outline. */}
      <svg width={MS} height={MS} viewBox="0 0 32 32" style={{ position: "absolute", left: C.x - MS / 2, top: C.y - MS / 2, overflow: "visible" }}>
        <defs>
          <linearGradient id="mk" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={energy.pink} stopOpacity={0.5} />
            <stop offset="0.6" stopColor={energy.rose} stopOpacity={0.32} />
            <stop offset="1" stopColor={energy.apricot} stopOpacity={0.4} />
          </linearGradient>
          <pattern id="dots" width={0.62} height={0.62} patternUnits="userSpaceOnUse">
            <circle cx={0.31} cy={0.31} r={0.13} fill={CREAM(0.55)} />
          </pattern>
          <clipPath id="grow">
            <circle cx={16} cy={16} r={24 * halftone} />
          </clipPath>
        </defs>
        <path d={LOCKUP_MARK} fill="url(#mk)" opacity={halftone} />
        <path d={LOCKUP_MARK} fill="url(#dots)" clipPath="url(#grow)" />
        <path d={LOCKUP_MARK} fill="none" stroke={CREAM(0.7)} strokeWidth={0.07} pathLength={1} strokeDasharray={`${outline} 2`} />
      </svg>

      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {/* Frame brackets and corner markers. */}
        <Draw d="M 250 60 L 170 60 L 170 1020 L 250 1020" p={frame} />
        <Draw d="M 1670 60 L 1750 60 L 1750 1020 L 1670 1020" p={frame} />
        {[60, 1020].flatMap((y) => [170, 1750].map((x) => <rect key={`${x}-${y}`} x={x - 5} y={y - 5} width={10} height={10} fill={CREAM(0.5)} opacity={frame} />))}
        {/* Guides. */}
        {[C.x - MS / 2, C.x + MS / 2].map((x) => (
          <line key={x} x1={x} y1={0} x2={x} y2={1080} stroke={SOFT} opacity={guides} />
        ))}
        {[C.y - MS / 2, C.y + MS / 2].map((y) => (
          <line key={y} x1={0} y1={y} x2={1920} y2={y} stroke={SOFT} strokeDasharray="6 8" opacity={guides} />
        ))}
        <Draw d={`M ${C.x - MS / 2 - 80} ${C.y - MS / 2 - 80} L ${C.x + MS / 2 + 80} ${C.y + MS / 2 + 80}`} p={guides} stroke={SOFT} />
        <Draw d={`M ${C.x + MS / 2 + 80} ${C.y - MS / 2 - 80} L ${C.x - MS / 2 - 80} ${C.y + MS / 2 + 80}`} p={guides} stroke={SOFT} />
        {/* Lobe circles and radii. */}
        {LOBES.map((l, i) => (
          <g key={i}>
            <circle cx={l.x} cy={l.y} r={R} fill="none" stroke={LINE} strokeWidth={1.2} pathLength={1} strokeDasharray={`${circles[i]} 2`} transform={`rotate(-90 ${l.x} ${l.y})`} />
            <Draw d={`M ${l.x} ${l.y} L ${l.x + (i % 2 ? R : -R) * 0.7071} ${l.y + (i < 2 ? -R : R) * 0.7071}`} p={at(f, 70 + i * 6, 100 + i * 6)} />
            <circle cx={l.x} cy={l.y} r={3} fill={CREAM(0.6)} opacity={circles[i]} />
          </g>
        ))}
        {/* Dimension lines (blueprint): width and height of the mark in units. */}
        <g opacity={dims}>
          <line x1={C.x - MS / 2} y1={C.y - MS / 2 - 18} x2={C.x - MS / 2} y2={C.y - MS / 2 - 70} stroke={LINE} />
          <line x1={C.x + MS / 2} y1={C.y - MS / 2 - 18} x2={C.x + MS / 2} y2={C.y - MS / 2 - 70} stroke={LINE} />
          <Draw d={`M ${C.x} ${C.y - MS / 2 - 56} H ${C.x - (MS / 2) * dims} M ${C.x} ${C.y - MS / 2 - 56} H ${C.x + (MS / 2) * dims}`} p={1} />
          <path d={`M ${C.x - MS / 2 + 10} ${C.y - MS / 2 - 61} L ${C.x - MS / 2} ${C.y - MS / 2 - 56} L ${C.x - MS / 2 + 10} ${C.y - MS / 2 - 51}`} fill="none" stroke={LINE} />
          <path d={`M ${C.x + MS / 2 - 10} ${C.y - MS / 2 - 61} L ${C.x + MS / 2} ${C.y - MS / 2 - 56} L ${C.x + MS / 2 - 10} ${C.y - MS / 2 - 51}`} fill="none" stroke={LINE} />
          <line x1={C.x - MS / 2 - 18} y1={C.y + MS / 2} x2={C.x - MS / 2 - 70} y2={C.y + MS / 2} stroke={LINE} />
          <line x1={C.x - MS / 2 - 18} y1={C.y - MS / 2} x2={C.x - MS / 2 - 70} y2={C.y - MS / 2} stroke={LINE} />
          <Draw d={`M ${C.x - MS / 2 - 56} ${C.y} V ${C.y - (MS / 2) * dims} M ${C.x - MS / 2 - 56} ${C.y} V ${C.y + (MS / 2) * dims}`} p={1} />
        </g>
        {/* Orbits with arrowheads; the light dots travel once drawn. */}
        {ORBITS.map((o, i) => (
          <g key={i} transform={`rotate(${o.rot} ${C.x} ${C.y})`}>
            <ellipse cx={C.x} cy={C.y} rx={o.rx} ry={o.ry} fill="none" stroke={o.colour} strokeWidth={1.6} opacity={0.75} pathLength={1} strokeDasharray={`${orbitDraw * 0.92} 2`} style={{ filter: `drop-shadow(0 0 6px ${o.colour})` }} />
          </g>
        ))}
        {ORBITS.map((o, i) => {
          const live = at(f, 120, 150);
          return [0, 1, 2].map((k) => {
            const a = (f / 60) * o.speed * 2 + (k * Math.PI * 2) / 3 + i;
            const p = orbitPoint(o, a);
            return <circle key={`${i}-${k}`} cx={p.x} cy={p.y} r={k === 0 ? 7 : 4.5} fill={o.colour} opacity={live} style={{ filter: `drop-shadow(0 0 8px ${o.colour})` }} />;
          });
        })}
      </svg>

      {/* Annotations. */}
      <Mono x={C.x} y={C.y - MS / 2 - 90} o={dims} align="center">
        32.00 u
      </Mono>
      <Mono x={C.x - MS / 2 - 100} y={C.y - 190} o={dims} rotate={-90}>
        32.00 u
      </Mono>
      <Mono x={LOBES[0].x - R - 10} y={LOBES[0].y - R - 34} o={circles[0]}>
        Ø 14.8 u
      </Mono>
      <Mono x={LOBES[3].x + R - 60} y={LOBES[3].y + R + 12} o={circles[3]}>
        R 7.40
      </Mono>
      {ORBITS.slice(0, 2).map((o, i) => {
        const p = orbitPoint(o, 0);
        return (
          <Mono key={i} x={p.x + 14} y={p.y - 26} o={at(f, 120, 150)} size={14}>
            {o.label}
          </Mono>
        );
      })}
      <Tag x={LOBES[0].x - R - 330} y={LOBES[0].y - 40} icon="list-checks" label="WORK" data="11 tasks today" f={f} t0={120} seed="w" />
      <Tag x={LOBES[1].x + R + 30} y={LOBES[1].y - 40} icon="users" label="CLIENTS" data="3 active · 1 approved" f={f} t0={128} seed="c" right />
      <Tag x={LOBES[2].x - R - 330} y={LOBES[2].y - 40} icon="sun-horizon" label="LIFE" data="12-day walk streak" f={f} t0={136} seed="l" />
      <Tag x={LOBES[3].x + R + 30} y={LOBES[3].y - 40} icon="receipt" label="MONEY" data="$1,875.00 paid" f={f} t0={144} seed="m" right />
      <Mono x={214} y={90} o={frame} rotate={90} size={22}>
        fig. 01 — the mark
      </Mono>
      <Mono x={1712} y={1000} o={frame} rotate={-90} size={22}>
        ZENBOARD · 2026
      </Mono>
      <Mono x={290} y={52} o={at(f, 30, 70)} size={14}>
        CONSTRUCTION SHEET 01 — EVERYTHING → ONE
      </Mono>
      <Exploded f={f} x={250} y={720} />
      <TitleBlock f={f} x={1250} y={880} />

      {/* A soft ink scrim so the lockup and tagline read over the drawing. */}
      <div style={{ position: "absolute", left: C.x - 620, top: C.y - 190, width: 1240, height: 420, borderRadius: "50%", background: `radial-gradient(closest-side, rgba(40,4,23,.62), rgba(40,4,23,.3) 60%, transparent)`, opacity: lock }} />
      {/* The lockup, white, in front; the selection box draws and its handles snap. */}
      <div style={{ position: "absolute", left: C.x, top: C.y, transform: `translate(-50%, -50%) translateY(${(1 - lock) * 24}px)`, opacity: lock, filter: `blur(${(1 - lock) * 8}px)` }}>
        <div style={{ position: "relative", padding: "18px 28px" }}>
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
            <rect x={0.5} y={0.5} width="99.6%" height="99%" fill="none" stroke={CREAM(0.7)} pathLength={1} strokeDasharray={`${at(f, 225, 262)} 2`} />
          </svg>
          <Lockup h={150} ink={stage.inkText} mark={stage.inkText} />
          {[
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
          ].map(([x, y]) => (
            <div key={`${x}${y}`} style={{ position: "absolute", left: x ? "100%" : 0, top: y ? "100%" : 0, width: 10, height: 10, marginLeft: -5, marginTop: -5, background: stage.inkText, transform: `scale(${snap})` }} />
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 26, fontFamily: FONT, fontSize: 34, color: CREAM(0.88), letterSpacing: "-0.01em", opacity: tagline, translate: `0 ${(1 - tagline) * 14}px` }}>The single platform to manage work, life, and business.</div>
      </div>
      <Finish />
    </div>
  );
};

export const Outro: React.FC = () => <OutroArt f={useCurrentFrame()} />;
export const OutroStyleframe: React.FC = () => <OutroArt f={330} />;

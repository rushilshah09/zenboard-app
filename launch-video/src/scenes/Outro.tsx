import React from "react";
import { Audio } from "@remotion/media";
import { staticFile, useCurrentFrame } from "remotion";
import { FONT, MONO } from "../brand/fonts";
import { LOCKUP_MARK } from "../brand/logo.generated";
import { EASE, clamp } from "../brand/motion";
import { respond } from "../brand/physics";
import { energy, stage } from "../brand/tokens";
import { MeshGradient } from "../gl/MeshGradient";
import { Finish } from "../ui/Stage";
import { Lockup } from "../ui/Lockup";

/**
 * The outro: "the construction sheet". One thing is lit: the white Zenboard
 * lockup. Everything else is a quiet, monochrome background layer on a soft
 * mesh gradient: the mark drawn as a technical drawing (guides, lobe radii,
 * two orbits) and three real pieces of the product (a task, a calendar event,
 * a client map) sitting in the corners, each tied to the mark by a hairline.
 * 7s; the last 2.5s hold while the orbits and the light keep moving.
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
const LINE = CREAM(0.16);
const SOFT = CREAM(0.08);
/** Everything behind the lockup lives at this strength. */
const QUIET = 0.62;

/** Progress of a window on the settle curve. */
const at = (f: number, a: number, b: number) => clamp(f, [a, b], [0, 1], EASE.settle);

/** A solid line that draws itself (pathLength-normalised), or a dashed one that fades in. */
const Draw: React.FC<{ d: string; p: number; stroke?: string; w?: number; dash?: boolean }> = ({ d, p, stroke = LINE, w = 1, dash }) =>
  dash ? (
    <path d={d} fill="none" stroke={stroke} strokeWidth={w} strokeDasharray="3 6" opacity={p} />
  ) : (
    <path d={d} fill="none" stroke={stroke} strokeWidth={w} pathLength={1} strokeDasharray={`${p} 2`} strokeLinecap="round" />
  );

const Mono: React.FC<{ x: number; y: number; o: number; children: React.ReactNode; rotate?: number; align?: "left" | "center" }> = ({ x, y, o, children, rotate = 0, align = "left" }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      fontFamily: MONO,
      fontSize: 14,
      letterSpacing: "0.1em",
      color: CREAM(0.42),
      transform: `${align === "center" ? "translateX(-50%) " : ""}rotate(${rotate}deg)`,
      transformOrigin: "0 0",
      whiteSpace: "nowrap",
      opacity: o,
    }}
  >
    {children}
  </div>
);

/* ——— Editorial side notes: diagrams and small type, monochrome, one rose accent. ——— */

const ACCENT = energy.rose;

/** Small editorial text block: a mono index, an uppercase heading, a short paragraph. */
const Note: React.FC<{ f: number; t0: number; x: number; y: number; w: number; index: string; heading: string[]; body: string; align?: "left" | "right" }> = ({ f, t0, x, y, w, index, heading, body, align = "left" }) => {
  const o = at(f, t0, t0 + 40);
  const b = at(f, t0 + 14, t0 + 54);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, textAlign: align, fontFamily: FONT }}>
      <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.12em", color: CREAM(0.45), opacity: o }}>{index}</div>
      <div style={{ marginTop: 10, fontSize: 30, fontWeight: 400, lineHeight: 1.08, letterSpacing: "0.01em", textTransform: "uppercase", color: CREAM(0.82), opacity: o, translate: `0 ${(1 - o) * 10}px` }}>
        {heading.map((h) => (
          <div key={h}>{h}</div>
        ))}
      </div>
      <div style={{ marginTop: 14, fontSize: 14, lineHeight: 1.55, color: CREAM(0.5), opacity: b, translate: `0 ${(1 - b) * 8}px` }}>{body}</div>
    </div>
  );
};

/** fig. 02: concentric orbits with points of work riding them (editorial orbit diagram). */
const RingDiagram: React.FC<{ f: number; x: number; y: number }> = ({ f, x, y }) => {
  const W = 400;
  const cx = W / 2;
  const cy = 110;
  const rings = [
    { rx: 180, ry: 44 },
    { rx: 130, ry: 32 },
    { rx: 82, ry: 20 },
    { rx: 36, ry: 9 },
  ];
  const draw = at(f, 120, 190);
  const live = at(f, 150, 190);
  // A vertical column and two diagonals of dots, like the reference sheet.
  const column = [-96, -64, -34, 34, 64, 96];
  return (
    <div style={{ position: "absolute", left: x, top: y }}>
      <svg width={W} height={220} style={{ overflow: "visible" }}>
        {rings.map((r, i) => (
          <ellipse key={i} cx={cx} cy={cy} rx={r.rx} ry={r.ry} fill="none" stroke={CREAM(0.4)} strokeWidth={1.2} pathLength={1} strokeDasharray={`${clamp(draw * 1.3 - i * 0.1, [0, 1], [0, 1])} 2`} />
        ))}
        {column.map((dy, i) => (
          <circle key={`c${i}`} cx={cx} cy={cy + dy} r={Math.abs(dy) > 80 ? 4 : 3.2} fill={CREAM(Math.abs(dy) > 50 ? 0.75 : 0.4)} opacity={at(f, 140 + i * 3, 170 + i * 3)} />
        ))}
        {[-1, 1].flatMap((s) =>
          [0.55, 0.9].map((k, i) => (
            <g key={`d${s}${i}`} opacity={at(f, 150 + i * 4, 180 + i * 4)}>
              <circle cx={cx + s * 150 * k} cy={cy - 70 * k} r={3.2} fill={CREAM(0.45)} />
              <circle cx={cx + s * 150 * k} cy={cy + 70 * k} r={3.2} fill={CREAM(0.45)} />
            </g>
          )),
        )}
        {rings.map((r, i) =>
          [0, 1].map((k) => {
            const a = (f / 60) * (0.5 - i * 0.12) * (i % 2 ? -1 : 1) + k * Math.PI + i;
            const hot = i === 1 && k === 0;
            return <circle key={`r${i}${k}`} cx={cx + Math.cos(a) * r.rx} cy={cy + Math.sin(a) * r.ry} r={hot ? 5 : 3.6} fill={hot ? ACCENT : CREAM(0.85)} opacity={live} style={hot ? { filter: `drop-shadow(0 0 6px ${ACCENT})` } : undefined} />;
          }),
        )}
        <text x={-4} y={cy + 5} textAnchor="end" fill={CREAM(0.55)} fontFamily={MONO} fontSize={13} letterSpacing="0.1em" opacity={live}>
          WORK
        </text>
        <text x={W + 4} y={cy + 5} fill={CREAM(0.55)} fontFamily={MONO} fontSize={13} letterSpacing="0.1em" opacity={live}>
          LIFE
        </text>
      </svg>
      <div style={{ position: "absolute", left: 0, top: 232, fontFamily: MONO, fontSize: 12, letterSpacing: "0.08em", color: CREAM(0.4), opacity: draw, whiteSpace: "nowrap" }}>fig. 02 — three rings, one centre</div>
    </div>
  );
};

/** fig. 03: every module on a spoke from one hub (editorial radial diagram). */
const SPOKES = ["Tasks", "Calendar", "Docs", "Clients", "Money", "Habits", "Goals", "Notes"];
const SpokeDiagram: React.FC<{ f: number; x: number; y: number }> = ({ f, x, y }) => {
  const S = 250;
  const c = S / 2;
  const L = 118;
  const grow = at(f, 150, 215);
  return (
    <div style={{ position: "absolute", left: x, top: y }}>
      <svg width={S} height={S} style={{ overflow: "visible" }}>
        <circle cx={c} cy={c} r={11} fill="none" stroke={CREAM(0.55)} opacity={grow} />
        <circle cx={c} cy={c} r={3} fill={CREAM(0.8)} opacity={grow} />
        {SPOKES.map((name, i) => {
          const a = (i / SPOKES.length) * Math.PI * 2 - Math.PI / 2 + 0.2;
          const g = clamp(grow * 1.4 - i * 0.05, [0, 1], [0, 1]);
          const ex = c + Math.cos(a) * L * g;
          const ey = c + Math.sin(a) * L * g;
          const r = 0.45 + 0.4 * ((i * 37) % 10) / 10;
          const hot = name === "Clients";
          const deg = (a * 180) / Math.PI;
          const flip = deg > 90 && deg < 270;
          return (
            <g key={name}>
              <line x1={c + Math.cos(a) * 14} y1={c + Math.sin(a) * 14} x2={ex} y2={ey} stroke={CREAM(0.4)} strokeWidth={1.1} />
              <circle cx={c + Math.cos(a) * L * r} cy={c + Math.sin(a) * L * r} r={hot ? 6 : i % 3 === 0 ? 5.5 : 4.5} fill={hot ? ACCENT : CREAM(i % 2 ? 0.45 : 0.85)} opacity={at(f, 190 + i * 3, 215 + i * 3)} style={hot ? { filter: `drop-shadow(0 0 6px ${ACCENT})` } : undefined} />
              <text
                transform={`translate(${c + Math.cos(a) * (L + 10)} ${c + Math.sin(a) * (L + 10)}) rotate(${flip ? deg + 180 : deg})`}
                textAnchor={flip ? "end" : "start"}
                dominantBaseline="middle"
                fill={CREAM(0.5)}
                fontFamily={MONO}
                fontSize={12}
                letterSpacing="0.06em"
                opacity={at(f, 200 + i * 3, 225 + i * 3)}
              >
                {name}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ position: "absolute", left: 0, top: -84, fontFamily: MONO, fontSize: 12, letterSpacing: "0.08em", color: CREAM(0.4), opacity: grow, whiteSpace: "nowrap" }}>fig. 03 — every module, one hub</div>
    </div>
  );
};

/** Blueprint call-outs on the mark: a hatched lobe and a dashed lobe, with arrows and labels. */
const CallOuts: React.FC<{ f: number }> = ({ f }) => {
  const o = at(f, 110, 170);
  const a = LOBES[2];
  const b = LOBES[1];
  return (
    <>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <pattern id="hatch" width={10} height={10} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={10} stroke={CREAM(0.3)} strokeWidth={1.2} />
          </pattern>
          <clipPath id="lobeClip">
            <rect x={a.x - R} y={a.y - R} width={R * 0.75} height={R * 2} />
          </clipPath>
        </defs>
        <circle cx={a.x} cy={a.y} r={R} fill="url(#hatch)" clipPath="url(#lobeClip)" opacity={o} />
        <circle cx={b.x} cy={b.y} r={R} fill="none" stroke={CREAM(0.45)} strokeDasharray="6 7" opacity={o} />
        <Draw d={`M ${a.x - 160} ${a.y + R + 118} C ${a.x - 150} ${a.y + R + 60}, ${a.x - R + 10} ${a.y + R - 10}, ${a.x - R + 30} ${a.y + 60}`} p={o} stroke={CREAM(0.5)} w={1.4} />
        <Draw d={`M ${b.x + R + 160} ${b.y - 40} C ${b.x + R + 100} ${b.y - 40}, ${b.x + R + 40} ${b.y - 50}, ${b.x + R - 6} ${b.y - 40}`} p={o} stroke={CREAM(0.5)} w={1.4} />
      </svg>
      <Mono x={a.x - 250} y={a.y + R + 124} o={o}>
        EVERY PART
      </Mono>
      <Mono x={a.x - 250} y={a.y + R + 144} o={o}>
        HOLDS A PIECE
      </Mono>
      <Mono x={b.x + R + 170} y={b.y - 52} o={o}>
        ALL OF IT,
      </Mono>
      <Mono x={b.x + R + 170} y={b.y - 32} o={o}>
        CONNECTED
      </Mono>
    </>
  );
};

/** Bottom right: the drawing-sheet title block. */
const TitleBlock: React.FC<{ f: number; x: number; y: number }> = ({ f, x, y }) => {
  const p = at(f, 160, 220);
  const t = at(f, 185, 235);
  const W = 420;
  const H = 96;
  return (
    <div style={{ position: "absolute", left: x, top: y }}>
      <svg width={W} height={H} style={{ overflow: "visible", position: "absolute" }}>
        <Draw d={`M0 0 H${W} V${H} H0 Z`} p={p} />
        <Draw d={`M0 32 H${W}`} p={p} />
        <Draw d={`M0 64 H${W}`} p={p} />
        <Draw d={`M250 0 V${H}`} p={p} />
      </svg>
      {[
        ["ZENBOARD — THE MARK", 12, 9],
        ["fig. 01", 262, 9],
        ["SCALE 1:20", 12, 41],
        ["REV 2026.09", 262, 41],
        ["LIFE DESIGN STUDIO", 12, 73],
        ["SHEET 1/1", 262, 73],
      ].map(([s, lx, ly]) => (
        <div key={s as string} style={{ position: "absolute", left: lx as number, top: ly as number, fontFamily: MONO, fontSize: 12, letterSpacing: "0.08em", color: CREAM(0.4), opacity: t, whiteSpace: "nowrap" }}>
          {s}
        </div>
      ))}
    </div>
  );
};

export const OutroArt: React.FC<{ f: number }> = ({ f }) => {
  const field = at(f, 0, 80);
  const frame = at(f, 0, 50);
  const guides = at(f, 10, 70);
  const circles = LOBES.map((_, i) => at(f, 30 + i * 8, 90 + i * 8));
  const body = at(f, 50, 140);
  const outline = at(f, 40, 130);
  const trace = at(f, 130, 170);
  const lock = at(f, 200, 250);
  const snap = respond(f, 240);
  const tagline = at(f, 255, 300);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: stage.ink, fontFamily: FONT }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.3 + 0.7 * field }}>
        <MeshGradient t={f / 60 + 3} intensity={0.55} frame={f} />
      </div>
      {/* Settle the mesh down so the background stays quiet. */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(24, 2, 13, 0.18)" }} />

      {/* ——— The quiet layer ——— */}
      <div style={{ position: "absolute", inset: 0, opacity: QUIET }}>
        <svg width={MS} height={MS} viewBox="0 0 32 32" style={{ position: "absolute", left: C.x - MS / 2, top: C.y - MS / 2, overflow: "visible" }}>
          <path d={LOCKUP_MARK} fill={CREAM(0.035)} opacity={body} />
          <path d={LOCKUP_MARK} fill="none" stroke={CREAM(0.3)} strokeWidth={0.05} pathLength={1} strokeDasharray={`${outline} 2`} />
          <path d={LOCKUP_MARK} fill="none" stroke={energy.rose} strokeWidth={0.09} strokeLinecap="round" pathLength={1} strokeDasharray="0.14 0.86" strokeDashoffset={-(f / 420) * 1.6} opacity={trace} style={{ filter: `drop-shadow(0 0 0.3px ${energy.rose})` }} />
        </svg>

        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          {/* Frame brackets and corner markers. */}
          <Draw d="M 250 60 L 170 60 L 170 1020 L 250 1020" p={frame} />
          <Draw d="M 1670 60 L 1750 60 L 1750 1020 L 1670 1020" p={frame} />
          {[60, 1020].flatMap((y) => [170, 1750].map((x) => <rect key={`${x}-${y}`} x={x - 4} y={y - 4} width={8} height={8} fill={CREAM(0.3)} opacity={frame} />))}
          {/* Guides. */}
          {[C.x - MS / 2, C.x + MS / 2].map((x) => (
            <line key={x} x1={x} y1={0} x2={x} y2={1080} stroke={SOFT} opacity={guides} />
          ))}
          {[C.y - MS / 2, C.y + MS / 2].map((y) => (
            <line key={y} x1={0} y1={y} x2={1920} y2={y} stroke={SOFT} strokeDasharray="6 8" opacity={guides} />
          ))}
          <Draw d={`M ${C.x - MS / 2 - 60} ${C.y - MS / 2 - 60} L ${C.x + MS / 2 + 60} ${C.y + MS / 2 + 60}`} p={guides} stroke={SOFT} />
          <Draw d={`M ${C.x + MS / 2 + 60} ${C.y - MS / 2 - 60} L ${C.x - MS / 2 - 60} ${C.y + MS / 2 + 60}`} p={guides} stroke={SOFT} />
          {/* Lobe circles and centres. */}
          {LOBES.map((l, i) => (
            <g key={i}>
              <circle cx={l.x} cy={l.y} r={R} fill="none" stroke={LINE} pathLength={1} strokeDasharray={`${circles[i]} 2`} transform={`rotate(-90 ${l.x} ${l.y})`} />
              <circle cx={l.x} cy={l.y} r={2.5} fill={CREAM(0.4)} opacity={circles[i]} />
            </g>
          ))}
          {/* The accent: a rose tracer running along the mark's outline (the one line of colour). */}
        </svg>

        <Mono x={C.x} y={46} o={at(f, 30, 70)} align="center">
          CONSTRUCTION SHEET 01 — EVERYTHING → ONE
        </Mono>
        <Mono x={206} y={430} o={frame} rotate={90}>
          fig. 01 — the mark
        </Mono>
        <Mono x={1716} y={660} o={frame} rotate={-90}>
          ZENBOARD · 2026
        </Mono>

        <CallOuts f={f} />
        <RingDiagram f={f} x={250} y={130} />
        <Note f={f} t0={132} x={1290} y={112} w={420} index="02 — THE SYSTEM" heading={["One place", "for everything you run"]} body="Tasks, calendar, docs, clients and money share one model. Move a date and the project, the client and the invoice already know." />
        <SpokeDiagram f={f} x={250} y={730} />
        <Note f={f} t0={150} x={1290} y={720} w={420} index="03 — FOR WHO" heading={["Built for people", "who run everything"]} body="Founders, freelancers and small studios who wear every hat, working from one calm surface." />
        <TitleBlock f={f} x={1270} y={912} />
      </div>

      {/* ——— The one lit thing ——— */}
      <div style={{ position: "absolute", left: C.x - 700, top: C.y - 260, width: 1400, height: 520, borderRadius: "50%", background: `radial-gradient(closest-side, rgba(24,2,13,.55), rgba(24,2,13,.25) 60%, transparent)`, opacity: lock }} />
      <div style={{ position: "absolute", left: C.x - 500, top: C.y - 200, width: 1000, height: 400, borderRadius: "50%", background: `radial-gradient(closest-side, ${energy.rose}26, transparent)`, opacity: lock, filter: "blur(20px)" }} />
      <div style={{ position: "absolute", left: C.x, top: C.y, transform: `translate(-50%, -50%) translateY(${(1 - lock) * 24}px)`, opacity: lock, filter: `blur(${(1 - lock) * 8}px)` }}>
        <div style={{ position: "relative", padding: "18px 28px" }}>
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
            <rect x={0.5} y={0.5} width="99.6%" height="99%" fill="none" stroke={CREAM(0.35)} pathLength={1} strokeDasharray={`${at(f, 225, 262)} 2`} />
          </svg>
          <Lockup h={150} ink={stage.inkText} mark={stage.inkText} />
          {[
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
          ].map(([x, y]) => (
            <div key={`${x}${y}`} style={{ position: "absolute", left: x ? "100%" : 0, top: y ? "100%" : 0, width: 8, height: 8, marginLeft: -4, marginTop: -4, background: CREAM(0.8), transform: `scale(${snap})` }} />
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 28, fontFamily: FONT, fontSize: 34, color: CREAM(0.82), letterSpacing: "-0.01em", opacity: tagline, translate: `0 ${(1 - tagline) * 14}px` }}>The single platform to manage work, life, and business.</div>
      </div>
      <Finish grain={0} />
    </div>
  );
};

/** The outro with its sound design (scripts/make-outro-sound.py). */
export const Outro: React.FC = () => (
  <>
    <OutroArt f={useCurrentFrame()} />
    <Audio src={staticFile("audio/outro.wav")} />
  </>
);
export const OutroStyleframe: React.FC = () => <OutroArt f={330} />;

import React from "react";
import { Audio } from "@remotion/media";
import { staticFile, useCurrentFrame } from "remotion";
import { FONT, MONO } from "../brand/fonts";
import { GlyphName } from "../brand/glyphs.generated";
import { LOCKUP_MARK } from "../brand/logo.generated";
import { EASE, clamp } from "../brand/motion";
import { respond } from "../brand/physics";
import { energy, stage } from "../brand/tokens";
import { Icon } from "../components/Glyph";
import { CLIENTS, EVENTS, JOB, PEOPLE, TODAY, money } from "../data/acme";
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

/* ——— The product, quiet: glass cards in cream hairlines, no colour. ——— */

const Card: React.FC<{ f: number; t0: number; x: number; y: number; w: number; drift: number; children: React.ReactNode }> = ({ f, t0, x, y, w, drift, children }) => {
  const o = at(f, t0, t0 + 40);
  const float = Math.sin(f / 70 + drift) * 4;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        opacity: o,
        translate: `0 ${(1 - o) * 18 + float}px`,
        filter: `blur(${(1 - o) * 6}px)`,
        padding: 20,
        borderRadius: 16,
        background: CREAM(0.035),
        border: `1px solid ${CREAM(0.1)}`,
        boxShadow: `inset 0 1px 0 ${CREAM(0.06)}, 0 24px 60px rgba(18, 1, 9, 0.35)`,
        fontFamily: FONT,
        color: CREAM(0.78),
      }}
    >
      {children}
    </div>
  );
};

const Head: React.FC<{ icon: GlyphName; label: string; right?: string }> = ({ icon, label, right }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 13, letterSpacing: "0.08em", color: CREAM(0.45), marginBottom: 14 }}>
    <Icon name={icon} size={16} tint={CREAM(0.45)} />
    <span style={{ flex: 1 }}>{label}</span>
    {right ? <span>{right}</span> : null}
  </div>
);

const Avatar: React.FC<{ initials: string; size?: number; ring?: boolean }> = ({ initials, size = 26, ring }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: 999,
      display: "grid",
      placeItems: "center",
      fontFamily: FONT,
      fontSize: size * 0.38,
      fontWeight: 500,
      color: CREAM(0.75),
      background: CREAM(0.08),
      boxShadow: `0 0 0 1px ${CREAM(ring ? 0.28 : 0.14)}`,
    }}
  >
    {initials}
  </div>
);

const Chip: React.FC<{ children: React.ReactNode; icon?: GlyphName }> = ({ children, icon }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, border: `1px solid ${CREAM(0.12)}`, fontSize: 14, color: CREAM(0.6) }}>
    {icon ? <Icon name={icon} size={14} tint={CREAM(0.55)} /> : null}
    {children}
  </span>
);

/** Top left: the job as a task. */
const TaskCard: React.FC<{ f: number }> = ({ f }) => {
  const done = 4;
  return (
    <Card f={f} t0={130} x={230} y={120} w={420} drift={0}>
      <Head icon="list-checks" label="TASK · ACM-24" right="In progress" />
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ width: 22, height: 22, marginTop: 2, borderRadius: 999, border: `1.5px solid ${CREAM(0.4)}`, flexShrink: 0 }} />
        <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em", color: CREAM(0.88), lineHeight: 1.25 }}>{JOB.title}</div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
        <Chip icon="folder">Acme Studio</Chip>
        <Chip icon="clock">
          {JOB.event.day.slice(0, 3)} {JOB.event.start}
        </Chip>
        <Chip icon="file-text">Proposal</Chip>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 999, background: CREAM(0.1) }}>
          <div style={{ width: `${(done / 6) * 100 * at(f, 170, 230)}%`, height: "100%", borderRadius: 999, background: CREAM(0.55) }} />
        </div>
        <span style={{ fontFamily: MONO, fontSize: 13, color: CREAM(0.5) }}>{done}/6</span>
        <div style={{ display: "flex" }}>
          <Avatar initials={PEOPLE.me.initials} />
          <div style={{ marginLeft: -8 }}>
            <Avatar initials={PEOPLE.mara.initials} />
          </div>
        </div>
      </div>
    </Card>
  );
};

/** Top right: Thursday on the calendar, with the job's block in it. */
const EventCard: React.FC<{ f: number }> = ({ f }) => {
  const H0 = 9;
  const H1 = 13;
  const PX = 38;
  const rows = [
    { title: "Rebrand proposal", start: 10 * 60, end: 12 * 60, main: true },
    ...EVENTS.filter((e) => e.start < H1 * 60).map((e) => ({ title: e.title, start: e.start, end: Math.min(e.end, H1 * 60), main: false })),
  ];
  return (
    <Card f={f} t0={142} x={1270} y={120} w={420} drift={2}>
      <Head icon="calendar-dots" label={`${TODAY.weekday.toUpperCase()} · ${TODAY.date.toUpperCase()}`} />
      <div style={{ position: "relative", height: (H1 - H0) * PX + 4 }}>
        {Array.from({ length: H1 - H0 + 1 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: 0, right: 0, top: i * PX - 8, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: MONO, fontSize: 12, color: CREAM(0.35), width: 40 }}>{`${H0 + i}:00`}</span>
            <div style={{ flex: 1, height: 1, background: CREAM(0.07) }} />
          </div>
        ))}
        {rows.map((e, i) => {
          const o = at(f, 170 + i * 8, 200 + i * 8);
          const top = ((e.start - H0 * 60) / 60) * PX + 2;
          const h = Math.max(((e.end - e.start) / 60) * PX - 4, 24);
          return (
            <div
              key={e.title}
              style={{
                position: "absolute",
                left: 50,
                right: 0,
                top,
                height: h,
                opacity: o,
                borderRadius: 8,
                padding: "3px 12px",
                background: CREAM(e.main ? 0.1 : 0.045),
                borderLeft: `2px solid ${CREAM(e.main ? 0.6 : 0.25)}`,
                fontSize: 15,
                color: CREAM(e.main ? 0.88 : 0.6),
                overflow: "hidden",
              }}
            >
              <div style={{ fontWeight: 500 }}>{e.title}</div>
              {e.main ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 13, color: CREAM(0.55) }}>
                  <span style={{ fontFamily: MONO }}>
                    {JOB.event.start}–{JOB.event.end}
                  </span>
                  <span>· Acme Studio</span>
                  <div style={{ marginLeft: "auto", display: "flex" }}>
                    <Avatar initials={PEOPLE.mara.initials} size={22} />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
};

/** Bottom left: the client map, people and work around one client. */
const ClientMap: React.FC<{ f: number }> = ({ f }) => {
  const acme = CLIENTS[0];
  const W = 380;
  const H = 150;
  const hub = { x: W / 2, y: H / 2 };
  const nodes = [
    { x: 20, y: 20, el: <Avatar initials={PEOPLE.mara.initials} size={34} ring />, label: "Mara · Brand" },
    { x: 20, y: 130, el: <Avatar initials={PEOPLE.me.initials} size={34} ring />, label: "You · Owner" },
    { x: W - 20, y: 20, el: <Icon name="kanban" size={18} tint={CREAM(0.6)} />, label: `${acme.projects} projects` },
    { x: W - 20, y: 130, el: <Icon name="receipt" size={18} tint={CREAM(0.6)} />, label: `${money(acme.unbilled)} unbilled` },
  ];
  const lines = at(f, 185, 240);
  return (
    <Card f={f} t0={154} x={230} y={780} w={420} drift={4}>
      <Head icon="users" label="CLIENT" right={acme.status.toUpperCase()} />
      <div style={{ position: "relative", width: W, height: H }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          {nodes.map((n, i) => (
            <path key={i} d={`M ${hub.x} ${hub.y} C ${(hub.x + n.x) / 2} ${hub.y}, ${(hub.x + n.x) / 2} ${n.y}, ${n.x} ${n.y}`} fill="none" stroke={CREAM(0.2)} pathLength={1} strokeDasharray={`${lines} 2`} />
          ))}
        </svg>
        <div style={{ position: "absolute", left: hub.x, top: hub.y, transform: "translate(-50%, -50%)", padding: "8px 14px", borderRadius: 10, background: CREAM(0.08), border: `1px solid ${CREAM(0.2)}`, fontSize: 16, fontWeight: 500, color: CREAM(0.88), whiteSpace: "nowrap" }}>{acme.name}</div>
        {nodes.map((n, i) => {
          const o = at(f, 200 + i * 6, 230 + i * 6);
          const left = n.x < hub.x;
          return (
            <div key={i} style={{ position: "absolute", left: n.x, top: n.y, transform: "translate(-50%, -50%)", opacity: o }}>
              <div style={{ width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: 999, background: CREAM(0.05) }}>{n.el}</div>
              <div style={{ position: "absolute", top: n.y < hub.y ? 42 : -22, [left ? "left" : "right"]: 0, fontSize: 13, color: CREAM(0.5), whiteSpace: "nowrap" }}>{n.label}</div>
            </div>
          );
        })}
      </div>
    </Card>
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

/** Two orbits around the mark, in hairline cream; a single point of light rides each. */
const ORBITS = [
  { rx: 540, ry: 150, rot: -24, speed: 0.5 },
  { rx: 540, ry: 150, rot: 24, speed: -0.4 },
];
const orbitPoint = (o: (typeof ORBITS)[number], a: number) => {
  const x = Math.cos(a) * o.rx;
  const y = Math.sin(a) * o.ry;
  const t = (o.rot * Math.PI) / 180;
  return { x: C.x + x * Math.cos(t) - y * Math.sin(t), y: C.y + x * Math.sin(t) + y * Math.cos(t) };
};

/** Hairlines from each card's inner edge to the mark: everything → one. */
const LINKS = [
  { from: { x: 650, y: 250 }, to: LOBES[0] },
  { from: { x: 1270, y: 250 }, to: LOBES[1] },
  { from: { x: 650, y: 900 }, to: LOBES[2] },
];

export const OutroArt: React.FC<{ f: number }> = ({ f }) => {
  const field = at(f, 0, 80);
  const frame = at(f, 0, 50);
  const guides = at(f, 10, 70);
  const circles = LOBES.map((_, i) => at(f, 30 + i * 8, 90 + i * 8));
  const body = at(f, 50, 140);
  const outline = at(f, 40, 130);
  const orbitDraw = at(f, 70, 150);
  const links = at(f, 190, 250);
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
          {/* Orbits. */}
          {ORBITS.map((o, i) => (
            <ellipse key={i} cx={C.x} cy={C.y} rx={o.rx} ry={o.ry} transform={`rotate(${o.rot} ${C.x} ${C.y})`} fill="none" stroke={CREAM(0.22)} pathLength={1} strokeDasharray={`${orbitDraw * 0.94} 2`} />
          ))}
          {ORBITS.map((o, i) => {
            const p = orbitPoint(o, (f / 60) * o.speed * 2 + i * 2.2);
            return <circle key={i} cx={p.x} cy={p.y} r={4} fill={CREAM(0.9)} opacity={at(f, 130, 160)} style={{ filter: `drop-shadow(0 0 6px ${CREAM(0.8)})` }} />;
          })}
          {/* Everything → one. */}
          {LINKS.map((l, i) => (
            <Draw key={i} d={`M ${l.from.x} ${l.from.y} L ${l.to.x} ${l.to.y}`} p={links} dash stroke={CREAM(0.22)} />
          ))}
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

        <TaskCard f={f} />
        <EventCard f={f} />
        <ClientMap f={f} />
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

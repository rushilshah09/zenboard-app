import React from "react";
import { useCurrentFrame } from "remotion";
import { FONT } from "../../brand/fonts";
import { GlyphName } from "../../brand/glyphs.generated";
import { EASE, clamp } from "../../brand/motion";
import { CURVE } from "../../brand/physics";
import { colour, stage } from "../../brand/tokens";
import { voAt } from "../../timeline/film";
import { AW, AppWorkspace } from "../../ui/app/AppWorkspace";
import { Ico, LABEL, app, t } from "../../ui/app/kit";
import { Stage } from "../../ui/Stage";

/**
 * Scene 5 · The Orbit (0:46–0:54). Zenboard holds your whole world.
 *   0–60     the network's glow blooms to cream: the Ivory stage
 *   30–140   the workspace at the centre, lit from behind; three rings draw
 *            around it in 3D, carrying real module objects
 *   Work. Life. Business.  each ring lights in its colour as it's named
 *   60–400   the camera orbits ~60° around the system
 *   400–470  the rings align into one plane and spin once
 */
export const ORBIT_FRAMES = 480;
const C = { x: 960, y: 600 };
const D = 2400;

type Chip = { icon: GlyphName; title: string; meta: string };
type Ring = { name: string; vo: string; r: number; tilt: number; rz: number; speed: number; colour: string; chips: Chip[] };
const RINGS: Ring[] = [
  {
    name: "Work.",
    vo: "work",
    r: 640,
    tilt: 16,
    rz: -9,
    speed: 0.0042,
    colour: LABEL.berry.dot,
    chips: [
      { icon: "list-checks", title: "Tasks", meta: "11 today" },
      { icon: "kanban", title: "Acme — Rebrand", meta: "64% · 9 Oct" },
      { icon: "file-text", title: "Rebrand proposal", meta: "Doc · 2 editing" },
      { icon: "notepad", title: "Call notes — Mara", meta: "Note · 12:40" },
    ],
  },
  {
    name: "Life.",
    vo: "life",
    r: 840,
    tilt: 20,
    rz: 7,
    speed: -0.0032,
    colour: LABEL.moss.dot,
    chips: [
      { icon: "flame", title: "Walk, 20 min", meta: "12-day streak" },
      { icon: "timer", title: "Deep work", meta: "90 min focus" },
      { icon: "calendar-dots", title: "Dinner with Sam", meta: "Fri 19:30" },
      { icon: "sun-horizon", title: "Day off", meta: "Saturday" },
    ],
  },
  {
    name: "Business.",
    vo: "business",
    r: 1030,
    tilt: 12,
    rz: -3,
    speed: 0.0026,
    colour: LABEL.ochre.dot,
    chips: [
      { icon: "users", title: "Acme Studio", meta: "Client · active" },
      { icon: "receipt", title: "INV-1042", meta: "$1,875.00 · paid" },
      { icon: "clock", title: "Time", meta: "12.5h this week" },
      { icon: "chart-line-up", title: "Revenue", meta: "+18% vs Aug" },
    ],
  },
];

const rad = (d: number) => (d * Math.PI) / 180;
/** A point on a ring (in its own plane), tilted, rolled and seen from the orbiting camera. */
const pt = (r: number, a: number, tilt: number, rz: number, yaw: number) => {
  let x = r * Math.cos(a);
  let y = 0;
  let z = r * Math.sin(a);
  // Yaw (camera orbit) about Y.
  [x, z] = [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];
  // Tilt toward camera about X.
  [y, z] = [y * Math.cos(tilt) - z * Math.sin(tilt), y * Math.sin(tilt) + z * Math.cos(tilt)];
  // Roll about Z.
  [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
  const s = D / (D + z);
  return { x: C.x + x * s, y: C.y + y * s, z, s };
};

const ChipCard: React.FC<Chip & { lit: number; colour: string }> = ({ icon, title, meta, lit, colour: c }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, height: 64, padding: "0 20px 0 12px", borderRadius: 14, background: app.paper, boxShadow: `inset 0 0 0 1px ${app.hairline2}, 0 14px 36px rgba(40,4,23,.28), 0 0 0 ${2 * lit}px ${c}`, whiteSpace: "nowrap" }}>
    <span style={{ width: 40, height: 40, borderRadius: 10, background: app.paper3, display: "grid", placeItems: "center" }}>
      <Ico name={icon} size={22} tint={lit > 0.5 ? c : app.ink600} />
    </span>
    <span>
      <div style={{ ...t.bodyStrong, fontSize: 17, color: app.ink900 }}>{title}</div>
      <div style={{ ...t.mono, fontSize: 13, color: app.ink500 }}>{meta}</div>
    </span>
  </div>
);

export const Orbit: React.FC = () => {
  const f = useCurrentFrame();
  const bloom = clamp(f, [0, 50], [0, 1], EASE.settle);
  const ink = clamp(f, [20, 64], [1, 0], EASE.settle);
  const ws = clamp(f, [24, 80], [0, 1], EASE.settle);
  const yaw = rad(-28 + 50 * clamp(f, [60, 400], [0, 1], CURVE.glide));
  const align = clamp(f, [392, 440], [0, 1], CURVE.glide);
  const spin = clamp(f, [420, 476], [0, 1], CURVE.glide) * Math.PI * 2;
  const k = 0.44;

  const rings = RINGS.map((r, i) => {
    const draw = clamp(f, [50 + i * 16, 130 + i * 16], [0, 1], EASE.settle);
    const lit = clamp(f, [voAt(r.vo, "orbit") - 4, voAt(r.vo, "orbit") + 14], [0, 1], EASE.settle);
    const tilt = rad(r.tilt + (14 - r.tilt) * align);
    const rz = rad(r.rz * (1 - align));
    const seg = Array.from({ length: 121 }, (_, j) => pt(r.r, (j / 120) * Math.PI * 2, tilt, rz, yaw));
    return { r, i, draw, lit, tilt, rz, seg };
  });
  const chips = rings.flatMap(({ r, i, draw, lit, tilt, rz }) =>
    r.chips.map((c, j) => {
      const a = (j / r.chips.length) * Math.PI * 2 + i * 0.6 + f * r.speed + spin * (i % 2 ? -1 : 1);
      return { c, r, lit, draw, key: `${i}-${j}`, p: pt(r.r, a, tilt, rz, yaw), enter: clamp(f, [80 + i * 16 + j * 5, 120 + i * 16 + j * 5], [0, 1], EASE.settle) };
    }),
  );
  const Ring: React.FC<{ back: boolean }> = ({ back }) => (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      {rings.map(({ r, draw, lit, seg }) => {
        const n = Math.floor(seg.length * draw);
        const parts: string[] = [];
        let cur = "";
        for (let j = 0; j < n; j++) {
          const p = seg[j];
          const isBack = p.z > 0;
          if (isBack === back) cur += `${cur ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
          else if (cur) {
            parts.push(cur);
            cur = "";
          }
        }
        if (cur) parts.push(cur);
        const col = lit > 0.5 ? r.colour : "rgba(40,4,23,.28)";
        return parts.map((d, j) => <path key={`${r.name}-${j}`} d={d} fill="none" stroke={col} strokeWidth={back ? 1.6 : 2.4} opacity={back ? 0.6 : 0.95} style={{ filter: lit > 0.5 ? `drop-shadow(0 0 6px ${r.colour})` : undefined }} />);
      })}
    </svg>
  );
  const chipEl = (x: (typeof chips)[number], back: boolean) => (
    <div key={x.key} style={{ position: "absolute", left: x.p.x, top: x.p.y, transform: `translate(-50%, -50%) scale(${x.p.s * 0.95})`, opacity: x.enter * (back ? 0.75 : 1), filter: back ? `blur(${1.5 + (x.p.z / 1000) * 2}px)` : undefined }}>
      <ChipCard {...x.c} lit={x.lit} colour={x.r.colour} />
    </div>
  );
  return (
    <Stage kind="ivory">
      {/* The energy light behind the workspace. */}
      <div style={{ position: "absolute", left: C.x - 760, top: C.y - 440, width: 1520, height: 880, borderRadius: "50%", background: "radial-gradient(closest-side, rgba(196,28,114,.26), rgba(232,168,197,.26) 40%, rgba(232,184,138,.14) 65%, transparent)", filter: "blur(30px)", opacity: ws }} />
      <Ring back />
      {chips.filter((x) => x.p.z > 0).sort((a, b) => b.p.z - a.p.z).map((x) => chipEl(x, true))}
      <div style={{ position: "absolute", inset: 0, perspective: D, perspectiveOrigin: `${C.x}px ${C.y}px` }}>
        <div style={{ position: "absolute", left: C.x - (AW.w * k) / 2, top: C.y - (AW.h * k) / 2, width: AW.w * k, height: AW.h * k, opacity: ws, transform: `rotateY(${(-yaw * 180) / Math.PI * 0.35}deg) translateY(${(1 - ws) * 30}px)` }}>
          <div style={{ width: AW.w, height: AW.h, transform: `scale(${k})`, transformOrigin: "0 0", borderRadius: 18, boxShadow: `0 -2px 0 ${colour.pink}, 0 40px 90px rgba(40,4,23,.3), 0 0 80px rgba(196,28,114,.25)` }}>
            <AppWorkspace check={1} />
          </div>
        </div>
      </div>
      <Ring back={false} />
      {chips.filter((x) => x.p.z <= 0).sort((a, b) => b.p.z - a.p.z).map((x) => chipEl(x, false))}
      <div style={{ position: "absolute", left: 0, right: 0, top: 70, display: "flex", justifyContent: "center", gap: 36, fontFamily: FONT, fontWeight: 600, fontSize: 104, letterSpacing: "-0.045em", lineHeight: 1 }}>
        {rings.map(({ r, lit }) => (
          <span key={r.name} style={{ color: colour.ink, opacity: lit, translate: `0 ${(1 - lit) * 16}px`, filter: `blur(${(1 - lit) * 8}px)` }}>
            {r.name}
          </span>
        ))}
      </div>
      {/* The bloom that carries us out of the Ink network. */}
      <div style={{ position: "absolute", inset: 0, background: stage.ink, opacity: ink }} />
      <div style={{ position: "absolute", left: C.x - 1400, top: C.y - 1400, width: 2800, height: 2800, borderRadius: "50%", background: `radial-gradient(closest-side, rgba(247,241,232,${1 - bloom * 0.9}), rgba(232,168,197,${0.4 * (1 - bloom)}) 40%, transparent 70%)`, transform: `scale(${0.2 + 0.8 * bloom})`, opacity: ink > 0 ? 1 : 0 }} />
    </Stage>
  );
};

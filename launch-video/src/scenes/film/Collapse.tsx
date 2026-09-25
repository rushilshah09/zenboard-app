import React from "react";
import { useCurrentFrame } from "remotion";
import { FONT } from "../../brand/fonts";
import { EASE, clamp } from "../../brand/motion";
import { CURVE, respond } from "../../brand/physics";
import { energy, stage } from "../../brand/tokens";
import { Orb } from "../../gl/Orb";
import { FRAGMENT_KINDS, Fragment } from "../../ui/Fragments";
import { MarkOnly } from "../../ui/Lockup";
import { Stage } from "../../ui/Stage";
import { voAt } from "../../timeline/film";
import { project, swarmAt } from "./Noise";

/**
 * Scene 2 · The Collapse (0:10–0:16). The release.
 *   0–60     freeze: every fragment stops mid-orbit; only the camera drifts
 *   60       a single point of Zenboard Pink ignites at the centre
 *   70–200   every fragment spirals in, shrinking and glowing as it falls
 *            (outer shell last)
 *   170–250  the orb: the energy gradient, breathing once; the stage warms
 *   250–280  the orb flattens into the mark; "Meet Zenboard." rises
 */
export const COLLAPSE_FRAMES = 360;
const C = { x: 960, y: 500 };
const MARK = 250;

export const Collapse: React.FC = () => {
  const f = useCurrentFrame();
  const drift = 1700 - 60 * clamp(f, [0, 200], [0, 1]);
  const pts = swarmAt(600, 1)
    .map((p) => ({ p, q: project(p, drift) }))
    .filter(({ q }) => q.z > -900)
    .sort((a, b) => b.p.z - a.p.z);
  const point = clamp(f, [60, 90], [0, 1], EASE.settle);
  const orbIn = respond(f, 170);
  const breathe = 1 + 0.04 * Math.sin(clamp(f, [205, 245], [0, Math.PI]));
  const flat = clamp(f, [MARK, MARK + 22], [0, 1], CURVE.settle);
  const warm = clamp(f, [160, 300], [0, 1], EASE.settle);
  const meet = voAt("meet", "collapse");
  const words = clamp(f, [meet - 6, meet + 22], [0, 1], EASE.settle);
  return (
    <Stage kind="ink" haze={1 + warm}>
      {/* The stage warming as the light floods out. */}
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 60% 55% at ${C.x}px ${C.y}px, rgba(169, 74, 114, ${0.28 * warm}), transparent 70%)` }} />
      {/* Rays through the haze once the point is lit. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: point * (1 - flat) * 0.9,
          background: `repeating-conic-gradient(from ${f * 0.08}deg at ${C.x}px ${C.y}px, rgba(232,168,197,0.10) 0deg 2deg, transparent 2deg 11deg)`,
          maskImage: `radial-gradient(circle at ${C.x}px ${C.y}px, black 0%, transparent 55%)`,
          WebkitMaskImage: `radial-gradient(circle at ${C.x}px ${C.y}px, black 0%, transparent 55%)`,
        }}
      />
      {pts.map(({ p, q }) => {
        const rx = q.x - C.x;
        const ry = q.y - C.y;
        const rho = Math.hypot(rx, ry);
        const a0 = Math.atan2(ry, rx);
        // Outer shell arrives last.
        const delay = Math.min(60, rho / 18);
        const u = clamp(f, [70 + delay, 150 + delay], [0, 1], CURVE.glide);
        if (u >= 1) return null;
        const r = rho * (1 - u);
        const a = a0 + u * u * 3.2;
        const x = C.x + Math.cos(a) * r;
        const y = C.y + Math.sin(a) * r * 0.9;
        const fog = Math.max(0.2, Math.min(1, 1.1 - (p.z + 600) / 2200));
        return (
          <div
            key={p.i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: `translate(-50%, -50%) scale(${q.s * 0.9 * (1 - 0.85 * u)}) rotate(${u * 40}deg)`,
              filter: `blur(${Math.min(12, Math.abs(p.z + 150) / 95) * (1 - u) + u * 2}px) brightness(${(0.55 + 0.45 * fog) * (1 + u * 1.4)}) drop-shadow(0 0 ${24 * u}px ${energy.pink})`,
              opacity: (0.3 + 0.7 * fog) * clamp(u, [0.8, 1], [1, 0]),
            }}
          >
            <Fragment kind={FRAGMENT_KINDS[p.i % FRAGMENT_KINDS.length]} i={p.i} light="ink" />
          </div>
        );
      })}
      {/* The point of light, then the orb. */}
      <div style={{ position: "absolute", left: C.x - 14, top: C.y - 14, width: 28, height: 28, borderRadius: "50%", background: "#fff", boxShadow: `0 0 ${30 + 60 * point}px ${12 + 20 * point}px ${energy.pink}`, opacity: point * (1 - orbIn) }} />
      <div style={{ position: "absolute", left: C.x - 400, top: C.y - 400, width: 800, height: 800, opacity: 1 - flat, transform: `scale(${breathe}, ${breathe * (1 - flat * 0.95)})` }}>
        {f >= 165 ? <Orb width={800} height={800} scale={0.62 * Math.max(0.001, orbIn)} glow={0.9 - 0.3 * flat} /> : null}
      </div>
      {/* The mark: the orb flattened. A soft bloom stays under it. */}
      <div style={{ position: "absolute", left: C.x - 300, top: C.y - 300, width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(closest-side, rgba(196,28,114,${0.4 * flat}), rgba(232,168,197,${0.14 * flat}) 50%, transparent)` }} />
      <div style={{ position: "absolute", left: C.x - 130, top: C.y - 130, opacity: flat, transform: `scale(${0.9 + 0.1 * flat})` }}>
        <MarkOnly size={260} fill={stage.inkText} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: C.y + 200, textAlign: "center", fontFamily: FONT, fontWeight: 600, fontSize: 88, letterSpacing: "-0.04em", color: stage.inkText, opacity: words, translate: `0 ${(1 - words) * 20}px`, filter: `blur(${(1 - words) * 8}px)` }}>
        Meet Zenboard.
      </div>
    </Stage>
  );
};

import React from "react";
import { energy } from "../brand/tokens";
import { Orb } from "../gl/Orb";
import { FRAGMENT_KINDS, Fragment } from "../ui/Fragments";
import { Stage } from "../ui/Stage";
import { rnd } from "./shared3";

/**
 * Scene 2 · The Collapse (0:10–0:16). Signature: the swarm implodes into an orb.
 * Styleframe: beat 2b→2c. Every fragment spirals inward, shrinking and glowing
 * brighter as it falls toward the Zenboard Pink light at the centre.
 */
const C = { x: 960, y: 520 };

export const S2Styleframe: React.FC = () => {
  const n = 70;
  const frags = Array.from({ length: n }, (_, i) => {
    // u: how far along its fall this fragment is (outer shell arrives last).
    const u = Math.pow(rnd(`c-u-${i}`), 0.8);
    const a0 = rnd(`c-a-${i}`, 0, Math.PI * 2);
    const r = 980 * Math.pow(1 - u, 1.25) + 90;
    const a = a0 + u * 4.2; // the spiral tightens as it falls
    return { i, u, x: C.x + Math.cos(a) * r, y: C.y + Math.sin(a) * r * 0.62, s: 0.18 + 0.62 * (1 - u), a };
  }).sort((p, q) => p.u - q.u);
  return (
    <Stage kind="ink" haze={1.6}>
      {/* Light rays spilling out from the point through the haze. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `repeating-conic-gradient(from 0deg at ${C.x}px ${C.y}px, rgba(232,168,197,0.10) 0deg 2deg, transparent 2deg 11deg)`,
          maskImage: `radial-gradient(circle at ${C.x}px ${C.y}px, black 0%, transparent 55%)`,
          WebkitMaskImage: `radial-gradient(circle at ${C.x}px ${C.y}px, black 0%, transparent 55%)`,
        }}
      />
      <div style={{ position: "absolute", left: C.x - 520, top: C.y - 520, width: 1040, height: 1040, borderRadius: "50%", background: `radial-gradient(closest-side, rgba(196,28,114,0.45), rgba(232,168,197,0.12) 45%, transparent)` }} />
      {frags.map((f) => (
        <div
          key={f.i}
          style={{
            position: "absolute",
            left: f.x,
            top: f.y,
            transform: `translate(-50%, -50%) scale(${f.s}) rotate(${(f.a * 180) / Math.PI / 14}deg)`,
            // Emission rises as each fragment nears the light.
            filter: `blur(${(1 - f.u) * 3 + f.u * 1.5}px) brightness(${0.6 + f.u * 1.1}) drop-shadow(0 0 ${20 * f.u}px ${energy.pink})`,
            opacity: 0.35 + 0.65 * (1 - Math.abs(f.u - 0.5)),
          }}
        >
          <Fragment kind={FRAGMENT_KINDS[f.i % FRAGMENT_KINDS.length]} i={f.i} light="ink" />
        </div>
      ))}
      <div style={{ position: "absolute", left: C.x - 400, top: C.y - 400, width: 800, height: 800 }}>
        <Orb width={800} height={800} scale={0.5} glow={0.8} />
      </div>
    </Stage>
  );
};

import React from "react";
import { FONT } from "../brand/fonts";
import { stage } from "../brand/tokens";
import { FRAGMENT_KINDS, Fragment } from "../ui/Fragments";
import { Stage } from "../ui/Stage";
import { project, rnd } from "./shared3";

/**
 * Scene 1 · The Noise (0:00–0:10). Signature: decode type → UI swarm → word wall.
 * Styleframe: beat 1d. The swarm at its densest, "Everywhere." slamming in at
 * 380px and cropping off both edges, just before the camera flies through it.
 */
type Frag = { i: number; x: number; y: number; z: number; ry: number; rx: number; badge?: number };

export const swarm = (n: number, seed = "swarm"): Frag[] =>
  Array.from({ length: n }, (_, i) => {
    const th = rnd(`${seed}-th-${i}`, 0, Math.PI * 2);
    const ph = Math.acos(rnd(`${seed}-ph-${i}`, -1, 1));
    const r = rnd(`${seed}-r-${i}`, 520, 1500);
    const x = r * Math.sin(ph) * Math.cos(th);
    const y = r * Math.cos(ph) * 0.6;
    const z = Math.max(-1050, r * Math.sin(ph) * Math.sin(th));
    return { i, x, y, z, ry: (-x / 1500) * 25, rx: (y / 900) * 14, badge: rnd(`${seed}-b-${i}`) < 0.16 ? Math.ceil(rnd(`${seed}-bn-${i}`, 1, 9)) : undefined };
  }).sort((a, b) => b.z - a.z);

/** Depth of field: sharp around the focus plane, soft far away, big bokeh up close. */
export const dof = (z: number, focus = -150) => Math.min(16, Math.abs(z - focus) / 90);

export const SwarmLayer: React.FC<{ frags: Frag[]; filter?: (f: Frag) => boolean }> = ({ frags, filter }) => (
  <>
    {frags.filter((f) => (filter ? filter(f) : true)).map((f) => {
      const p = project(f);
      const kind = FRAGMENT_KINDS[f.i % FRAGMENT_KINDS.length];
      const fog = Math.max(0.25, Math.min(1, 1.1 - (f.z + 600) / 2200));
      return (
        <div
          key={f.i}
          style={{
            position: "absolute",
            left: p.x,
            top: p.y,
            transform: `translate(-50%, -50%) scale(${p.s * 0.9}) perspective(900px) rotateY(${f.ry}deg) rotateX(${f.rx}deg)`,
            filter: `blur(${dof(f.z)}px) brightness(${0.55 + 0.45 * fog})`,
            opacity: 0.35 + 0.65 * fog,
          }}
        >
          <Fragment kind={kind} i={f.i} light="ink" badge={f.badge} />
        </div>
      );
    })}
  </>
);

const FRAGS = swarm(96);
/** Near cards stay out of the word's band so the slam reads: they frame it as bokeh at the edges. */
const clearOfWord = (f: Frag) => {
  const p = project(f);
  return !(p.y > 300 && p.y < 760 && p.x > 120 && p.x < 1800);
};

export const S1Styleframe: React.FC = () => (
  <Stage kind="ink">
    {/* Far half of the swarm, then the word, then the near half flying past camera. */}
    <SwarmLayer frags={FRAGS} filter={(f) => f.z > -250} />
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -54%)",
        fontFamily: FONT,
        fontWeight: 600,
        fontSize: 380,
        letterSpacing: "-0.05em",
        lineHeight: 1,
        color: stage.inkText,
        whiteSpace: "nowrap",
        textShadow: "0 0 80px rgba(196, 28, 114, 0.45)",
      }}
    >
      Everywhere.
    </div>
    <SwarmLayer frags={FRAGS} filter={(f) => f.z <= -250 && clearOfWord(f)} />
  </Stage>
);

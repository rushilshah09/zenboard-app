/**
 * Scene 2 · The resolve (0:10–0:15). Motion language from the Flike / Workspace references, in Zenboard's
 * palette: thick rounded arcs orbit the person with one continuous, eased spin; a Berry stroke sweeps in
 * from the top right, strikes the ring and is absorbed, the ring accelerates and tightens into the mark;
 * the module icons gather around it and the lockup lands. Storyboard 2.1–2.5.
 */
import React from "react";
import { Freeze, useCurrentFrame } from "remotion";
import { LOCKUP_MARK } from "../brand/logo.generated";
import { At, BERRY, CURVE, Frame, Icon, Lockup, PaperStage, blurIn, ease, mix, pop, soft } from "./kit";
import { IconName } from "./icons.generated";
import { Portrait, S1Juggling } from "./S1Juggling";

const CY = 56.25 / 2;
const ARCS = [
  { c: BERRY, len: 58, r: 0, ph: 0 }, { c: "#E07AAE", len: 34, r: 0, ph: 1.3 }, { c: "#E8A06B", len: 46, r: 0, ph: 2.1 },
  { c: "#8C94E0", len: 30, r: 0, ph: 3.4 }, { c: "#6FB3CC", len: 42, r: 0, ph: 4.6 }, { c: "#7FB26B", len: 36, r: 0, ph: 5.5 },
];
const RING: [IconName, string, string][] = [
  ["check-square", "#2F9E6B", "Tasks"], ["envelope-simple", "#E0523F", "Mail"], ["calendar-blank", "#3C6FD8", "Calendar"],
  ["file-text", "#1C5A70", "Docs"], ["kanban", "#C41C72", "Projects"], ["users-three", "#E08A2E", "Clients"],
  ["currency-circle-dollar", "#2F9E6B", "Money"], ["plant", "#C9A21F", "Habits"], ["timer", "#6E63D9", "Focus"], ["lightning", "#C41C72", "Automations"],
];
const POS = [[-1, -1], [0, -1], [1, -1], [1, -0.35], [1, 0.35], [1, 1], [0, 1], [-1, 1], [-1, 0.35], [-1, -0.35]];
const shape = (ic: IconName) => (["file-text", "check-square", "plant"].includes(ic) ? "sheet" : ["timer", "users-three"].includes(ic) ? "circ" : "sq");
const GMark: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <svg viewBox="-1 -1 34 34" style={{ width: `${size}cqw`, height: `${size}cqw`, display: "block", ...style }}><path d={LOCKUP_MARK} fill="url(#zgrad)" /></svg>
);

// the ring lives in a 100×100 box centred on the frame, 40cqw wide (1 unit = 0.4cqw)
const BOX = 40;
const pt = (r: number, deg: number) => [50 + r * Math.cos((deg * Math.PI) / 180), 50 + r * Math.sin((deg * Math.PI) / 180)] as const;
const arcPath = (r: number, a0: number, a1: number) => {
  const [x0, y0] = pt(r, a0), [x1, y1] = pt(r, a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

export const S2Resolve: React.FC = () => {
  const f = useCurrentFrame();
  // one continuous spin: slow drift, a kick when the stroke hits, a long ease into the collapse
  const hit = 118;
  const spin = f * 0.9 + 120 * ease(f, hit - 4, hit + 50, 0, 1, CURVE.settle) + 260 * ease(f, 140, 196, 0, 1, CURVE.glide);
  const grow = ease(f, 6, 60, 0, 1, CURVE.settle); // arcs draw on
  const R = 21 * (1 - 0.1 * ease(f, 60, 120, 0, 1, CURVE.breathe)) * (1 - 0.8 * ease(f, 150, 196, 0, 1, CURVE.glide)) + 0.6 * Math.sin(f / 24);
  const thick = 2.6 * (1 + 0.35 * ease(f, 150, 190, 0, 1));
  const ringOut = 1 - ease(f, 188, 204, 0, 1, CURVE.breathe);
  const pOut = ease(f, 96, 140, 0, 1, CURVE.glide);
  // the Berry stroke: its head runs from off-frame top right to the ring's edge, then its tail follows it in
  const head = ease(f, 84, hit, 0, 1, CURVE.glide);
  const tail = ease(f, 96, hit + 26, 0, 1, CURVE.glide);
  const contactDeg = -38 + spin * 0.0; // where it strikes the ring
  const [hx0, hy0] = [150, -42]; // start (in ring-box units, off frame)
  const [cx1, cy1] = pt(R + 4, contactDeg);
  const P = (t: number) => [hx0 + (cx1 - hx0) * t, hy0 + (cy1 - hy0) * t] as const;
  const [ax, ay] = P(Math.max(0, tail * 1.0 - 0.0)), [bx, by] = P(head);
  const strokeOn = f >= 84 && tail < 0.995;
  // mark, icon ring, lockup
  const mark = soft(f, 190, 150, 20);
  const absorb = ease(f, 242, 266, 0, 1, CURVE.depart);
  const markSize = f < 266 ? 7.2 * (0.85 + 0.15 * mark) * (1 - 0.5 * ease(f, 242, 266, 0, 1, CURVE.glide)) : 0;
  const markSpin = ease(f, 180, 214, -140, 0, CURVE.settle) + ease(f, 242, 270, 0, 360, CURVE.glide);
  const lock = soft(f, 262, 150, 20);
  const slide = ease(f, 284, 330, 0, 1, CURVE.glide);
  const reveal = ease(f, 290, 336, 0, 1, CURVE.glide);
  const sp = 15;
  return (
    <Frame>
      <PaperStage glow={0.35 + 0.25 * (1 - ease(f, 150, 200, 0, 1))} />
      {/* the juggling frame dissolves (blur + fade) */}
      <div className="stage" style={{ opacity: 1 - ease(f, 12, 60, 0, 1, CURVE.breathe), filter: `blur(${ease(f, 2, 44, 0, 0.9, CURVE.breathe)}cqw)`, transform: `scale(${1 + 0.04 * ease(f, 0, 60, 0, 1)})` }}>
        <Freeze frame={599}><S1Juggling /></Freeze>
      </div>
      {/* the orbit */}
      {ringOut > 0.001 ? (
        <At x={50} y={CY} style={{ width: `${BOX}cqw`, height: `${BOX}cqw`, opacity: ringOut }}>
          <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", overflow: "visible" }}>
            {ARCS.map((a, i) => {
              const base = i * 60 + spin * (1 + i * 0.04);
              const breathe = 0.75 + 0.25 * Math.sin(f / 34 + a.ph);
              const L = a.len * breathe * grow * (1 + 0.35 * ease(f, 150, 190, 0, 1));
              const r = R + (i % 2 ? 1.6 : -1.6) * (1 - ease(f, 140, 180, 0, 1));
              return L > 0.5 ? <path key={i} d={arcPath(r, base, base + L)} fill="none" stroke={a.c} strokeWidth={thick} strokeLinecap="round" /> : null;
            })}
            {/* two short satellite dashes on an outer orbit */}
            {[0, 1].map((k) => {
              const o = ease(f, 70 + k * 8, 100 + k * 8, 0, 1) * (1 - ease(f, 150, 176, 0, 1));
              const b = 110 + k * 180 - spin * 0.6;
              return o > 0 ? <path key={k} d={arcPath(R + 11, b, b + 9)} fill="none" stroke={k ? "#7FB26B" : BERRY} strokeWidth={1.3} strokeLinecap="round" opacity={o} /> : null;
            })}
            {strokeOn ? <line x1={ax} y1={ay} x2={bx} y2={by} stroke={BERRY} strokeWidth={3.2} strokeLinecap="round" /> : null}
            {/* the strike: a soft ring pulse where the stroke lands */}
            {f > hit - 2 && f < hit + 30 ? <circle cx={cx1} cy={cy1} r={2 + ease(f, hit - 2, hit + 30, 0, 12)} fill="none" stroke={BERRY} strokeWidth={0.6} opacity={1 - ease(f, hit - 2, hit + 30, 0, 1)} /> : null}
          </svg>
        </At>
      ) : null}
      <Portrait size={15.12 - 2.1 * ease(f, 0, 50, 0, 1, CURVE.glide)} style={{ opacity: 1 - pOut, transform: `scale(${1 - 0.5 * pOut})`, filter: pOut > 0.01 ? `blur(${pOut * 10}px)` : undefined }} />
      {/* the mark, then the module icons gather around it */}
      {f > 150 && f < 266 ? (
        <>
          <At x={50} y={CY} style={{ opacity: ease(f, 196, 220, 0, 1) * (1 - absorb) }}><div className="markhalo" /></At>
          {RING.map(([ic, c, label], i) => {
            const p = pop(f, 204 + i * 3, 220, 16);
            const [u, v] = POS[i];
            const tx = 50 + u * sp * (1 - absorb), ty = CY + v * sp * 0.92 * (1 - absorb);
            return (
              <React.Fragment key={ic + i}>
                <At x={tx} y={ty} style={{ opacity: Math.min(1, p * 1.4) * (1 - absorb), transform: `scale(${(0.6 + 0.4 * p) * (1 - absorb * 0.7)}) rotate(${absorb * 90}deg)` }}>
                  <span className={`ricon ${shape(ic)}`} style={{ ["--c" as string]: c }}><Icon name={ic} weight="fill" size="54%" color="#fff" /></span>
                </At>
                <At x={50 + u * sp} y={CY + v * sp * 0.92 + 3.75} style={{ opacity: ease(f, 216 + i * 2, 228 + i * 2, 0, 1) * (1 - ease(f, 238, 248, 0, 1)) }}><span className="rlab">{label}</span></At>
              </React.Fragment>
            );
          })}
        </>
      ) : null}
      {markSize > 0 ? <At x={50} y={CY} style={{ opacity: Math.min(1, mark * 1.5), filter: mark < 0.98 ? `blur(${(1 - mark) * 8}px)` : undefined }}><GMark size={markSize} style={{ transform: `rotate(${markSpin}deg)` }} /></At> : null}
      {/* lockup, Flike-style: the mark lands centred, then glides left while the wordmark unveils beside it */}
      {f >= 262 ? (
        <>
          <At x={50 + 15.8 * (1 - slide)} y={24.5}>
            <div style={{ position: "relative" }}>
              <div style={{ clipPath: `inset(-10% ${(1 - reveal) * 79}% -10% 0)` }}>
                <Lockup width={40} letters={8} markColor="transparent"
                  letterStyle={(i) => { const q = soft(f, 296 + i * 2.5, 140, 22); return { opacity: q, transform: `translateX(${(1 - q) * -10}px)` }; }} />
              </div>
              <div style={{ position: "absolute", left: 0, top: 0 }}>
                <Lockup width={40} letters={0} markStyle={{ transform: `scale(${0.5 + 0.5 * lock}) rotate(${(1 - lock) * -60}deg)` }} />
              </div>
            </div>
          </At>
          <At x={50} y={33.5} style={mix(blurIn(f, 326, 12))}>
            <span className="withask">with <GMark size={2.6} /> <b>Ask</b></span>
          </At>
        </>
      ) : null}
    </Frame>
  );
};

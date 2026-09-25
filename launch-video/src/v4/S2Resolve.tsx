/**
 * Scene 2 · The resolve (0:10–0:15). Freeze, the rings break into hairline bundles, sweep off, and the
 * Zenboard icon ring collapses into the gradient mark, which springs into the lockup. Storyboard 2.1–2.5.
 */
import React from "react";
import { useCurrentFrame } from "remotion";
import { LOCKUP_MARK } from "../brand/logo.generated";
import { At, BERRY, CURVE, Frame, Icon, Lockup, PaperStage, blurIn, ease, mix, pop, rnd, soft } from "./kit";
import { IconName } from "./icons.generated";
import { KINDS, Portrait, Tile, ringPos } from "./S1Juggling";
import { HairRing, Sweep } from "./lines";

const CY = 56.25 / 2;
const RING: [IconName, string, string][] = [
  ["check-square", "#2F9E6B", "Tasks"], ["envelope-simple", "#E0523F", "Mail"], ["calendar-blank", "#3C6FD8", "Calendar"],
  ["file-text", "#1C5A70", "Docs"], ["kanban", "#C41C72", "Projects"], ["users-three", "#E08A2E", "Clients"],
  ["currency-circle-dollar", "#2F9E6B", "Money"], ["plant", "#C9A21F", "Habits"], ["timer", "#6E63D9", "Focus"], ["lightning", "#C41C72", "Automations"],
];
const POS = [[-1, -1], [0, -1], [1, -1], [1, -0.35], [1, 0.35], [1, 1], [0, 1], [-1, 1], [-1, 0.35], [-1, -0.35]];
const shape = (ic: IconName) => (["file-text", "check-square", "plant"].includes(ic) ? "sheet" : ["timer", "users-three"].includes(ic) ? "circ" : "sq");

const GMark: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <svg viewBox="-1 -1 34 34" style={{ width: `${size}cqw`, height: `${size}cqw`, display: "block", ...style }}>
    <path d={LOCKUP_MARK} fill="url(#zgrad)" />
  </svg>
);

export const S2Resolve: React.FC = () => {
  const f = useCurrentFrame();
  // 2.1 freeze → hairline ring (0–1s)
  const blurTiles = ease(f, 0, 30, 0, 0.9, CURVE.settle);
  const ringIn = soft(f, 6, 140, 22);
  const spin = -20 + f * 1.2 + ease(f, 40, 90, 0, 220, CURVE.glide);
  // 2.2 portrait away + sweep (1–2.4s)
  const pOut = ease(f, 45, 80, 0, 1, CURVE.depart);
  const sweep = ease(f, 60, 110, 0, 1, CURVE.settle);
  const sweepOut = ease(f, 118, 140, 1, 0, CURVE.depart);
  const ringShrink = ease(f, 60, 120, 1, 0.34, CURVE.glide);
  const ringOut = ease(f, 132, 150, 1, 0, CURVE.depart);
  // 2.3 icon ring (2.4–3.4s), 2.4 absorb (3.4–3.9s), 2.5 lockup (3.9s+)
  const absorb = ease(f, 205, 236, 0, 1, CURVE.depart);
  const markSize = f < 236 ? 7 * pop(f, 138, 170, 14) * (1 - 0.54 * ease(f, 205, 236, 0, 1, CURVE.glide)) : 0;
  const markSpin = ease(f, 205, 245, 0, 360, CURVE.glide);
  const lock = pop(f, 240, 170, 15);
  const sp = 15;
  return (
    <Frame>
      <PaperStage glow={0.35 + 0.4 * (1 - ringShrink)} />
      {/* 2.1: the juggling ring freezes and falls out of focus */}
      <div className="stage" style={{ opacity: 1 - ease(f, 20, 60, 0, 1), filter: `blur(${blurTiles}cqw)`, transform: "scale(1.12)" }}>
        {KINDS.map((k, i) => {
          const [x, y] = ringPos(i, 1, 350 * 0.035);
          return <At key={k} x={x} y={y}><Tile kind={k} size={6} /></At>;
        })}
      </div>
      {/* hairline ring around the portrait, then the small ring that becomes the mark */}
      <At x={50} y={CY} style={{ width: `${36 * ringShrink}cqw`, height: `${36 * ringShrink}cqw`, opacity: ringIn * ringOut, transform: `scale(${0.9 + 0.1 * ringIn})` }}>
        <HairRing r0={36} cols={[BERRY, "#E0703F", "#2F86A8", "#3F8F55", "#6E63D9", "#C9A21F"]} spin={spin} />
      </At>
      <Portrait size={13} style={{ opacity: 1 - pOut, transform: `scale(${1 - 0.6 * pOut})`, filter: `blur(${pOut * 8}px)` }} />
      <Sweep draw={sweep} opacity={sweepOut} />
      {/* 2.3 icon ring around the gradient mark */}
      {f > 130 && f < 240 ? (
        <>
          <At x={50} y={CY} style={{ opacity: ease(f, 138, 170, 0, 1) * (1 - absorb) }}><div className="markhalo" /></At>
          {RING.map(([ic, c, label], i) => {
            const p = pop(f, 150 + i * 4, 220, 15);
            const [u, v] = POS[i];
            const tx = 50 + u * sp * (1 - absorb), ty = CY + v * sp * 0.92 * (1 - absorb);
            return (
              <React.Fragment key={ic + i}>
                <At x={tx} y={ty} style={{ opacity: Math.min(1, p * 1.4) * (1 - absorb), transform: `scale(${p * (1 - absorb * 0.8)}) rotate(${absorb * 90}deg)` }}>
                  <span className={`ricon ${shape(ic)}`} style={{ ["--c" as string]: c }}><Icon name={ic} weight="fill" size="54%" color="#fff" /></span>
                </At>
                <At x={50 + u * sp} y={CY + v * sp * 0.92 + 3.75} style={{ opacity: ease(f, 175 + i * 3, 190 + i * 3, 0, 1) * (1 - ease(f, 200, 212, 0, 1)) }}><span className="rlab">{label}</span></At>
              </React.Fragment>
            );
          })}
        </>
      ) : null}
      {markSize > 0 ? <At x={50} y={CY}><GMark size={markSize} style={{ transform: `rotate(${markSpin}deg)` }} /></At> : null}
      {/* 2.5 lockup: mark springs in, wordmark types in, "with ✦ Ask" rises */}
      {f >= 236 ? (
        <>
          <At x={50} y={24.5}>
            <Lockup width={40} letters={8} markStyle={{ transform: `scale(${0.4 + 0.6 * lock})` }}
              letterStyle={(i) => { const q = soft(f, 250 + i * 3, 200, 22); return { opacity: q, transform: `translateY(${(1 - q) * 6}px)` }; }} />
          </At>
          <At x={50} y={33.5} style={mix(blurIn(f, 282, 16))}>
            <span className="withask">with <GMark size={2.6} /> <b>Ask</b></span>
          </At>
        </>
      ) : null}
      {/* sparkle dust during the ring */}
      {f > 150 && f < 236 ? Array.from({ length: 18 }, (_, i) => (
        <At key={i} x={25 + rnd(i) * 50} y={6 + rnd(i + 40) * 44} style={{ width: `${0.2 + rnd(i + 9) * 0.3}cqw`, height: `${0.2 + rnd(i + 9) * 0.3}cqw`, borderRadius: "50%", background: BERRY, opacity: 0.25 * ease(f, 150 + i * 2, 170 + i * 2, 0, 1) * (1 - absorb) }} />
      )) : null}
    </Frame>
  );
};

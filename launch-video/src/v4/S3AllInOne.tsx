/**
 * Scene 3 · All in one (0:15–0:22). The mark leaves the lockup and becomes the hub; every app sends a fan
 * of hairlines that converge on one point (3.1). The camera trucks along the line, colour waves settle into
 * one Berry line, and the panel wipes open onto the full desktop (3.2). Ends in a light-flash whip.
 */
import React from "react";
import { useCurrentFrame } from "remotion";
import { At, CURVE, Frame, Lockup, Mark, PaperStage, Words, blurOut, ease, pop, soft } from "./kit";
import { KINDS, Tile } from "./S1Juggling";
import { Fans, STRAND, Waves } from "./lines";
import { Dashboard } from "./Dashboard";

const CY = 56.25 / 2;
const YS = [9, 16.5, 24, 31.5, 39, 46.5];

export const S3AllInOne: React.FC = () => {
  const f = useCurrentFrame();
  // mark travels from its place in the lockup to the hub
  const travel = ease(f, 8, 58, 0, 1, CURVE.glide);
  const mx = 34.2 + (82 - 34.2) * travel, my = 24.5 + (CY - 24.5) * travel;
  const node = pop(f, 44, 170, 16);
  const fans = ease(f, 70, 185, 0, 1, CURVE.settle);
  const spark = pop(f, 165, 200, 12);
  // camera truck into 3.2
  const truck = ease(f, 222, 290, 0, 1, CURVE.glide);
  const vel = Math.abs(ease(f, 223, 291, 0, 1, CURVE.glide) - truck) * 60;
  const settle = ease(f, 270, 350, 0, 1, CURVE.settle);
  const wipe = ease(f, 300, 350, 0, 1, CURVE.settle);
  const push = ease(f, 330, 420, 1, 1.06, CURVE.depart);
  const srcs: [number, number, string][] = YS.map((y, i) => [12 + (i % 2 ? 2.5 : 0), y, STRAND[i]]);
  return (
    <Frame>
      <PaperStage glow={0.55} />
      {/* lockup letters depart as the mark leaves */}
      {f < 40 ? <At x={50} y={24.5} style={blurOut(f, 0, 22)}><Lockup width={40} markColor="transparent" /></At> : null}
      <div className="stage" style={{ transform: `translateX(${-62 * truck}cqw)`, filter: vel > 0.2 ? `blur(${Math.min(6, vel)}px)` : undefined }}>
        {/* 3.1 fans */}
        <Fans sources={srcs} fx={58} fy={CY} draw={fans} />
        {srcs.map(([x, y], i) => {
          const p = pop(f, 30 + i * 7, 210, 15);
          return <At key={i} x={x - (1 - p) * 8} y={y} style={{ opacity: Math.min(1, p * 1.3) }}><Tile kind={KINDS[i]} size={5.2} /></At>;
        })}
        <At x={58} y={CY} style={{ transform: `scale(${spark * (1 + 0.15 * Math.sin(f / 7))})`, opacity: spark }}><span className="spark" /></At>
        {[4.5, 8.5, 12].map((dx, i) => (
          <At key={i} x={58 + dx} y={CY} style={{ opacity: ease(f, 175 + i * 6, 185 + i * 6, 0, 1) }}>
            <span className={`dot2${Math.floor(f / 12) % 3 === i ? " lit" : ""}`} />
          </At>
        ))}
        <At x={82} y={CY} style={{ transform: `scale(${node})`, opacity: node }}><div className="node" /></At>
        <At x={mx} y={my}><Mark size={8.4 - 0.9 * travel} /></At>
      </div>
      {/* 3.2 enters from the right */}
      <div className="stage" style={{ opacity: ease(f, 222, 250, 0, 1), transform: `translateX(${62 * (1 - truck)}cqw) scale(${push})`, transformOrigin: "76% 52%", filter: vel > 0.2 ? `blur(${Math.min(6, vel)}px)` : undefined }}>
        <Waves settle={settle} phase={f / 9} />
        <At x={46} y={CY}><div className="node sm"><Mark size={4.2} /></div></At>
        <At x={76} y={CY}>
          <div className="wipe desk" style={{ clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0 round 1.8cqw)` }}>
            <div className="wipe-in"><div className="deskfit"><Dashboard rowStyle={(i) => ({ opacity: soft(f, 320 + i * 6, 160, 22) })} /></div></div>
          </div>
        </At>
      </div>
      <At x={50} y={52}><Words f={f} at={112} exitAt={212} text="Everything you juggle." style={{ fontSize: "2.4cqw" }} /></At>
      <At x={50} y={52}><Words f={f} at={338} text="In one place." style={{ fontSize: "2.4cqw" }} /></At>
    </Frame>
  );
};

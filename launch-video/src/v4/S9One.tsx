/**
 * Scene 9 · The one (0:58–1:12). Ring of UI cards around the headline (9.1), light flash into the blueprint
 * outro (9.2), the logo builds itself (9.3), tagline hold (9.4), and the black end screen with the Berry
 * app icon (9.5). Storyboard 9.1–9.5.
 */
import React from "react";
import { staticFile, useCurrentFrame } from "remotion";
import { At, BERRY, CURVE, Frame, Grain, Halftone, Lockup, Mark, PaperStage, Words, blurIn, ease, mix, pop, soft } from "./kit";
import { BLUEPRINT_SVG, RING_CARDS } from "./finale.generated";

const CY = 56.25 / 2;
const html = (h: string) => h.replace(/__(p\d)__/g, (_, k) => staticFile(`v4/${k}.jpg`));
const CARDS = RING_CARDS.filter((c) => c.cls !== "head");
const MX = 33.4; // mark centre inside the 42cqw lockup

export const S9One: React.FC = () => {
  const f = useCurrentFrame();
  // 9.1
  const gather = ease(f, 296, 352, 0, 1, CURVE.depart);
  const pull = 1.06 - 0.06 * ease(f, 0, 300, 0, 1, CURVE.settle);
  // 9.2–9.4
  const bp = f >= 360 && f < 720;
  const draw = ease(f, 362, 450, 0, 1, CURVE.settle);
  const dim = 1 - 0.45 * ease(f, 540, 580, 0, 1, CURVE.breathe);
  const lobes = ease(f, 430, 476, 0, 1, CURVE.glide);
  const fuse = pop(f, 472, 200, 14);
  const turn = ease(f, 478, 520, -90, 0, CURVE.settle) + (1 - soft(f, 478, 200, 12)) * 0;
  const toBlack = ease(f, 696, 720, 0, 1, CURVE.depart);
  // 9.5
  const end = f >= 720;
  const icon = soft(f, 724, 90, 20);
  const endOut = ease(f, 804, 838, 0, 1, CURVE.depart);
  return (
    <Frame>
      {f < 360 ? (
        <>
          <PaperStage glow={0.35} />
          <div className="stage" style={{ transform: `scale(${pull})` }}>
            {CARDS.map((c, i) => {
              const dx = c.x - 50, dy = c.y - CY;
              const inP = soft(f, 4 + i * 4, 110, 20);
              const fl = Math.sin(f / 50 + i) * 0.35;
              const k = (1 - inP) * 0.35 + 1 - gather;
              return (
                <At key={i} x={50 + dx * k} y={CY + dy * k + fl} style={mix(
                  { opacity: Math.min(1, inP * 1.4) * (1 - gather * 0.6), filter: `blur(${(1 - inP) * 10 + gather * 8}px)`, transform: `scale(${(0.94 + 0.06 * inP) * (1 - 0.8 * gather)})` },
                  { width: c.style.match(/width:([\d.]+)cqw/)?.[0].split(":")[1] },
                )}>
                  <div dangerouslySetInnerHTML={{ __html: html(c.html) }} />
                </At>
              );
            })}
            <At x={50} y={25.6} style={{ opacity: 1 - gather }}><Words f={f} at={30} exitAt={292} text="Work, life and business." className="head" style={{ fontSize: "3.4cqw" }} /></At>
            <At x={50} y={29.6} style={{ opacity: 1 - gather }}><Words f={f} at={52} exitAt={296} text="One workspace." className="head" style={{ fontSize: "3.4cqw", color: BERRY }} /></At>
          </div>
        </>
      ) : null}
      {bp ? (
        <>
          <div className="stage bp-field" /><div className="stage bp-cloud" /><div className="stage bp-paper" /><div className="stage bp-fibre" />
          <Grain f={f} opacity={0.28} />
          <div className="bp-ink" style={{ opacity: dim, WebkitMaskImage: `radial-gradient(circle at 50% 50%, #000 ${draw * 90}%, transparent ${draw * 90 + 12}%)`, transform: `scale(${1.02 - 0.02 * draw + 0.02 * ease(f, 440, 700, 0, 1, CURVE.breathe)})` }}
            dangerouslySetInnerHTML={{ __html: BLUEPRINT_SVG }} />
          <div className="stage bp-vignette" />
          {/* 9.3 the logo builds: four lobes gather, the star turns, the wordmark rises */}
          {f < 482 ? [[8, 6, -1, -1], [51, 6, 1, -1], [8, 50, -1, 1], [51, 50, 1, 1]].map(([sx, sy, u, v], i) => {
            const ex = MX + u * 2.2, ey = CY + v * 2.2;
            const t = lobes;
            const bx = sx + (ex - sx) * t + (1 - t) * t * (u < 0 ? 8 : -8);
            return <At key={i} x={bx} y={sy + (ey - sy) * t} style={{ width: `${3.6 + 1.2 * t}cqw`, height: `${3.6 + 1.2 * t}cqw`, borderRadius: "50%", background: "#FBFAF6", opacity: ease(f, 420, 440, 0, 1) * (1 - ease(f, 474, 482, 0, 1)), filter: `blur(${(1 - t) * 3}px)` }} />;
          }) : null}
          {f >= 470 ? (
            <At x={50} y={CY} style={{ filter: "drop-shadow(0 0 2.4cqw rgba(255,255,255,.18))" }}>
              <Lockup width={42} color="#FBFAF6" markColor="#FBFAF6"
                markStyle={{ transform: `scale(${0.85 + 0.15 * fuse}) rotate(${turn}deg)` }}
                letterStyle={(i) => { const q = soft(f, 500 + i * 2, 190, 20); return { opacity: q, transform: `translateY(${(1 - q) * 8}px)` }; }} />
            </At>
          ) : null}
          <At x={50} y={38}><Words f={f} at={560} text="The single platform to manage work, life, and business." style={{ fontSize: "1.7cqw", color: "#FBFAF6", fontWeight: 500, letterSpacing: "-.01em" }} stagger={4} /></At>
          <At x={50} y={43.5} style={blurIn(f, 626, 10)}><span className="avail light">Available today</span></At>
          <div className="stage" style={{ background: "#000", opacity: toBlack }} />
        </>
      ) : null}
      {end ? (
        <>
          <div className="stage" style={{ background: "#000" }} />
          <div className="stage" style={{ opacity: 1 - endOut }}>
            <At x={50} y={CY}><Halftone size={58} color={BERRY} opacity={0.16} reveal={ease(f, 730, 800, 0, 1.4, CURVE.settle)} /></At>
            <At x={50} y={CY} style={{ opacity: icon }}><div className="bglow" /></At>
            <At x={50} y={CY} style={{ opacity: Math.min(1, icon * 1.3), transform: `scale(${1.02 - 0.02 * icon})` }}>
              <div className="bicon brand"><span className="bspec" /><span className="bgrain" /><Mark size={13} color="#FFF7FB" /><span className="bspark" style={{ opacity: ease(f, 760, 780, 0, 1) * (1 - ease(f, 790, 812, 0, 1)) }} /></div>
            </At>
            <At x={50} y={47} style={{ opacity: icon }}><div className="bfloor" /></At>
          </div>
        </>
      ) : null}
    </Frame>
  );
};

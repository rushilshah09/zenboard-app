/**
 * Scene 9 · The one (0:58–1:12). Ring of UI cards around the headline (9.1), light flash into the blueprint
 * outro (9.2), the logo builds itself (9.3), tagline hold (9.4), and the black end screen with the Berry
 * app icon (9.5). Storyboard 9.1–9.5.
 */
import React from "react";
import { staticFile, useCurrentFrame } from "remotion";
import { At, BERRY, CURVE, M, Frame, Grain, Halftone, Lockup, Mark, PaperStage, Words, blurIn, ease, mix, soft } from "./kit";
import { LOCKUP_MARK as MARK_D } from "../brand/logo.generated";
import { BLUEPRINT_SVG, RING_CARDS } from "./finale.generated";

const CY = 56.25 / 2;
const html = (h: string) => h.replace(/__(p\d)__/g, (_, k) => staticFile(`v4/${k}.jpg`));
const CARDS = RING_CARDS.filter((c) => c.cls !== "head");

/* ---- blueprint that draws itself: every shape strokes on in sequence ---- */
const INNER = BLUEPRINT_SVG.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")
  .replace(/<g transform="translate\([^)]*\) scale\([^)]*\)"><path d="M29[^"]*"[^>]*\/><\/g>/, ""); // the big mark is drawn separately
const TOKENS = INNER.match(/<(line|rect|circle|path|text)\b[\s\S]*?(\/>|<\/text>)/g) ?? [];
const drawBlueprint = (f: number, start: number, span: number) =>
  TOKENS.map((t, i) => {
    const at = start + (i / TOKENS.length) * span;
    const p = Math.max(0, Math.min(1, (f - at) / 40));
    const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
    const o = Number(t.match(/ opacity="([\d.]+)"/)?.[1] ?? 1);
    const tag = t.slice(1, t.indexOf(" "));
    const stroked = tag !== "text" && !/stroke-dasharray/.test(t) && /fill="none"/.test(t);
    const attr = stroked ? ` pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="${(1 - e).toFixed(3)}"` : ` style="opacity:${(o * e).toFixed(3)}"`;
    return t.replace(/^<(\w+)/, `<$1${attr}`);
  }).join("");

const MX = 33.42, MS = 42 * 32 / 152 * 34 / 32; // mark centre and size inside the 42cqw lockup (Mark's viewBox is 34 units)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const S9One: React.FC = () => {
  const f = useCurrentFrame();
  // 9.1 ring of cards
  const gather = ease(f, 290, 350, 0, 1, CURVE.depart);
  const pull = 1.06 - 0.06 * ease(f, 0, 300, 0, 1, CURVE.settle);
  // 9.2 the Berry field opens from the centre where the cards gathered; the blueprint draws itself
  const openBP = ease(f, 322, 384, 0, 1, CURVE.glide);
  const outline = ease(f, 380, 470, 0, 1, CURVE.breathe);
  const fill = ease(f, 468, 506, 0, 1, CURVE.breathe);
  const dim = 1 - 0.55 * ease(f, 470, 530, 0, 1, CURVE.breathe);
  // 9.3 the filled mark becomes the lockup
  const toLock = ease(f, 508, 568, 0, 1, CURVE.glide);
  // 9.5 the lockup becomes the app icon on black
  const words = 1 - ease(f, 688, 716, 0, 1, CURVE.depart);
  const toIcon = ease(f, 700, 752, 0, 1, CURVE.glide);
  const black = ease(f, 704, 760, 0, 1, CURVE.breathe);
  const tile = soft(f, 716, 90, 20);
  const endOut = ease(f, 806, 838, 0, 1, CURVE.depart);
  const mx = f < 700 ? lerp(50, MX, toLock) : lerp(MX, 50, toIcon);
  const ms = f < 700 ? lerp(42.5, MS, toLock) : lerp(MS, 13, toIcon);
  return (
    <Frame>
      <PaperStage glow={0.35} />
      <div className="stage" style={{ background: "#FBFAF6", opacity: 1 - ease(f, 0, 40, 0, 1, CURVE.breathe) }} />
      {f < 384 ? (
        <div className="stage" style={{ transform: `scale(${pull})` }}>
          {CARDS.map((c, i) => {
            const dx = c.x - 50, dy = c.y - CY;
            const inP = soft(f, 4 + i * 4, 110, 20);
            const fl = (i % 2 ? -0.5 : 0.5) * ease(f, 0, 290, 0, 1, M.inOut); // a slow parallax drift, not a bob
            const k = (1 - inP) * 0.35 + 1 - gather;
            return (
              <At key={i} x={50 + dx * k} y={CY + dy * k + fl} style={mix(
                { opacity: Math.min(1, inP * 1.4) * (1 - gather), filter: `blur(${(1 - inP) * 10 + gather * 10}px)`, transform: `scale(${(0.94 + 0.06 * inP) * (1 - 0.7 * gather)})` },
                { width: c.style.match(/width:([\d.]+)cqw/)?.[0].split(":")[1] },
              )}>
                <div dangerouslySetInnerHTML={{ __html: html(c.html) }} />
              </At>
            );
          })}
          <At x={50} y={25.6}><Words f={f} at={30} exitAt={286} text="Work, life and business." className="head" style={{ fontSize: "3.4cqw" }} /></At>
          <At x={50} y={29.6}><Words f={f} at={52} exitAt={290} text="One workspace." className="head" style={{ fontSize: "3.4cqw", color: BERRY }} /></At>
        </div>
      ) : null}
      {f >= 322 ? (
        <div className="stage" style={{ clipPath: `circle(${openBP * 120}% at 50% 50%)`, opacity: 1 - black }}>
          <div className="stage bp-field" /><div className="stage bp-cloud" /><div className="stage bp-paper" /><div className="stage bp-fibre" />
          <Grain f={f} opacity={0.28} />
          <div className="bp-ink" style={{ opacity: dim * words }}>
            <svg viewBox="0 0 100 56.25" dangerouslySetInnerHTML={{ __html: drawBlueprint(f, 356, 120) }} />
          </div>
          <div className="stage bp-vignette" />
          {/* the construction outline of the mark draws on, then fills */}
          {f < 512 ? (
            <svg className="stage" viewBox="0 0 100 56.25">
              <g transform={`translate(${50 - 16 * 1.25} ${CY - 16 * 1.25}) scale(1.25)`}>
                <path d={MARK_D} fill="#FBFAF6" fillOpacity={fill} stroke="#FBFAF6" strokeOpacity={0.85} strokeWidth={0.12 / 1.25} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - outline} />
              </g>
            </svg>
          ) : null}
          {/* 9.3–9.4 lockup, tagline */}
          {f >= 512 ? (
            <>
              <At x={50} y={CY} style={{ opacity: words }}>
                <Lockup width={42} color="#FBFAF6" markColor="transparent"
                  letterStyle={(i) => { const q = soft(f, 536 + i * 2.5, 150, 22); return { opacity: q, transform: `translateY(${(1 - q) * 10}px)` }; }} />
              </At>
              <At x={50} y={38} style={{ opacity: words }}><Words f={f} at={580} text="The single platform to manage work, life, and business." style={{ fontSize: "1.7cqw", color: "#FBFAF6", fontWeight: 500, letterSpacing: "-.01em" }} stagger={4} /></At>
              <At x={50} y={43.5} style={mix(blurIn(f, 640, 10), { opacity: words })}><span className="avail light">Available today</span></At>
            </>
          ) : null}
        </div>
      ) : null}
      {/* 9.5 black stage, halftone, the Berry tile grows behind the same mark */}
      {black > 0 ? <div className="stage" style={{ background: "#000", opacity: black }} /> : null}
      {black > 0 ? (
        <div className="stage" style={{ opacity: 1 - endOut }}>
          <At x={50} y={CY}><Halftone size={58} color={BERRY} opacity={0.16} reveal={ease(f, 724, 800, 0, 1.4, CURVE.settle)} /></At>
          <At x={50} y={CY} style={{ opacity: tile }}><div className="bglow" /></At>
          <At x={50} y={CY} style={{ opacity: Math.min(1, tile * 1.3), transform: `scale(${0.55 + 0.45 * tile})` }}>
            <div className="bicon brand"><span className="bspec" /><span className="bgrain" /><span className="bspark" style={{ opacity: ease(f, 770, 788, 0, 1) * (1 - ease(f, 796, 814, 0, 1)) }} /></div>
          </At>
          <At x={50} y={47} style={{ opacity: tile }}><div className="bfloor" /></At>
        </div>
      ) : null}
      {/* the one mark that travels through all of 9.2–9.5 */}
      {f >= 512 ? (
        <At x={mx} y={CY} style={{ opacity: 1 - endOut, filter: toIcon > 0 ? `drop-shadow(0 ${0.3 * toIcon}cqw ${0.3 * toIcon}cqw rgba(60,4,30,${0.45 * toIcon}))` : "drop-shadow(0 0 2.4cqw rgba(255,255,255,.18))" }}>
          <Mark size={ms} color="#FBFAF6" />
        </At>
      ) : null}
    </Frame>
  );
};

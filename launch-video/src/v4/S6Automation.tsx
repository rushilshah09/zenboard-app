/**
 * Scene 6 · Zenboard does the work (0:40–0:46). One continuous camera: the Focus panel collapses into the
 * Zenboard badge, "Effortless automation" builds (6.1), the camera flies into the real Create button
 * (6.2, a true zoom, not a second copy), and pulls back out while the same prompt and steps cards glide
 * into the 6.3 layout and the automation runs.
 */
import React from "react";
import { useCurrentFrame } from "remotion";
import { LOCKUP_MARK } from "../brand/logo.generated";
import { At, CURVE, Frame, Icon, Mark, PaperStage, Words, blurIn, blurOut, ease, mix, pop, soft } from "./kit";
import { IconName } from "./icons.generated";
import { FEATS } from "./S5Features";

const CY = 56.25 / 2;
const STEPS: [IconName, string, string][] = [
  ["lightning", "Trigger", "Invoice is 7 days overdue"], ["envelope-simple", "Step 2", "Draft a friendly reminder"],
  ["sun", "Step 3", "Move the task to Today"], ["users-three", "Step 4", "Post to the client portal"],
];
const GMark: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <svg viewBox="-1 -1 34 34" style={{ width: `${size}cqw`, height: `${size}cqw`, display: "block", ...style }}><path d={LOCKUP_MARK} fill="url(#zgrad)" /></svg>
);

const Steps: React.FC<{ state?: number; spin?: number }> = ({ state, spin = 0 }) => (
  <div className="acard steps">
    <div className="ah"><Icon name="lightning" size="1cqw" /> Overdue invoice follow-up</div>
    {STEPS.map(([ic, k, t], i) => (
      <React.Fragment key={k}>
        <div className={`stp${state !== undefined && i < state ? " done" : ""}`}>
          <span className="sico"><Icon name={ic} size="60%" /></span>
          <span className="stx"><span className="sk">{k}</span>{t}</span>
          {state === undefined ? null : i < state ? <b className="ok"><Icon name="check-circle" size="1.1cqw" color="#2F9E6B" /></b> : i === state ? <b className="run" style={{ transform: `rotate(${spin}deg)` }} /> : <b className="wait" />}
        </div>
        {i === 0 ? <div className="sdiv">Actions</div> : null}
      </React.Fragment>
    ))}
    <div className="addstep">+ Add step</div>
  </div>
);

const TEXT = "When an invoice is 7 days overdue, send a friendly reminder and move it to Today";
/** Prompt card with the Create button at a fixed place, so the camera can fly into it exactly. */
const BTN = { x: 9.3, y: 2.5 }; // button centre relative to the card centre (card units)
const Prompt: React.FC<{ typed: number; press: number; gloss: number; ring: number }> = ({ typed, press, gloss, ring }) => (
  <div className="acard prompt" style={{ position: "relative", height: "9.2cqw", boxSizing: "border-box" }}>
    <small>Describe a task for Zenboard</small>
    <p>{TEXT.slice(0, Math.round(TEXT.length * typed))}<span className="caret" /></p>
    <span className="cbtn" style={{
      position: "absolute", right: "1.2cqw", bottom: "1cqw", width: "7cqw", height: "2.2cqw", padding: 0, justifyContent: "center", boxSizing: "border-box",
      transform: `scale(${1 - 0.05 * press})`,
      background: "radial-gradient(120% 140% at 30% 0%,#E0468F 0%,#C41C72 45%,#A3155E 100%)",
      boxShadow: `inset 0 ${0.12 * gloss}cqw ${0.1 * gloss}cqw rgba(255,255,255,${0.45 * gloss}),inset 0 -${0.16 * gloss}cqw ${0.28 * gloss}cqw rgba(74,10,44,${0.35 * gloss}),0 0 0 ${0.28 + ring * 0.9}cqw rgba(196,28,114,${0.14 * (1 - ring)}),0 .5cqw 1.2cqw rgba(196,28,114,.3)`,
    }}>
      <Icon name="sparkle" size="1em" /> Create
    </span>
  </div>
);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const S6Automation: React.FC = () => {
  const f = useCurrentFrame();
  const collapse = ease(f, 0, 34, 0, 1, CURVE.glide);
  const F = FEATS[7];
  const badge = pop(f, 22, 190, 14);

  // shared cards: 6.1 place → 6.3 place (e = the pull-back progress)
  const e = ease(f, 200, 252, 0, 1, CURVE.glide);
  const G = { x: lerp(21, 25, e), y: lerp(44, 22, e), s: lerp(0.82, 1.15, e) };
  const Sx = lerp(21, 66, e), Sy = lerp(12.5, 25, e), Ss = lerp(0.82, 1.25, e);
  const B = { x: G.x + BTN.x * G.s, y: G.y + BTN.y * G.s };

  // camera: fly into the button, hold on the macro, pull back
  const zin = ease(f, 126, 164, 0, 1, CURVE.glide);
  const z = f < 200 ? lerp(1, 6, zin) : lerp(6, 1, e);
  const k = f < 200 ? zin : 1 - e; // how much the camera is locked on the button
  const cx = lerp(50, B.x, k), cy = lerp(CY, B.y, k);
  const zNext = f < 200 ? lerp(1, 6, ease(f + 1, 126, 164, 0, 1, CURVE.glide)) : lerp(6, 1, ease(f + 1, 200, 252, 0, 1, CURVE.glide));
  const speed = Math.abs(zNext - z) / z; // relative zoom speed per frame → motion blur
  const mblur = Math.min(10, speed * 90);

  const press = f >= 172 && f < 186 ? soft(f, 172, 400, 30) * (1 - soft(f, 180, 400, 30)) : 0;
  const ring = ease(f, 178, 204, 0, 1, CURVE.settle);
  const gloss = ease(f, 140, 166, 0, 1);
  const run = f >= 214;
  const state = f < 262 ? 0 : f < 292 ? 1 : f < 312 ? 2 : 3;
  const intro = 1 - ease(f, 150, 176, 0, 1); // 6.1-only pieces fade once we are inside the button
  const fly = ease(f, 334, 360, 0, 1, CURVE.glide);

  return (
    <Frame>
      <PaperStage glow={0} />
      <div className="stage" style={{ background: "radial-gradient(46% 58% at 50% 50%,rgba(234,185,203,.55),rgba(250,237,244,.35) 45%,transparent 75%)" }} />
      <div className="stage" style={{ transformOrigin: `${cx}cqw ${cy}cqw`, transform: `translate(${50 - cx}cqw, ${CY - cy}cqw) scale(${z})`, filter: mblur > 0.3 ? `blur(${mblur}px)` : undefined }}>
        {/* 6.1-only pieces */}
        <div className="stage" style={{ opacity: intro }}>
          <At x={79} y={12.5} style={mix(blurIn(f, 48, 30), { transform: "scale(.82)" })}>
            <div className="acard doc"><div className="dl" /><div className="dl" /><div className="dl s" /><div className="dl" /><div className="dl s" /></div>
            <div className="chipx"><Icon name="file-text" size="1.1cqw" /> Add to a doc</div>
          </At>
          <At x={79} y={44} style={mix(blurIn(f, 64, 30), { transform: "scale(.82)" })}>
            <div className="acard chart"><small>Q3 revenue</small><div className="semi" /><div className="pct"><b>$18.4k</b><span>paid</span><b>$4.3k</b><span>open</span></div></div>
          </At>
          <At x={7} y={CY} style={{ opacity: 0.85 * ease(f, 60, 90, 0, 1), filter: "blur(.25cqw)", transform: `rotate(${f * 0.3}deg)` }}><GMark size={5} /></At>
          <At x={93} y={CY} style={{ opacity: 0.85 * ease(f, 66, 96, 0, 1), filter: "blur(.25cqw)", transform: `rotate(${45 - f * 0.3}deg)` }}><GMark size={5} /></At>
          <At x={50} y={15} style={{ transform: `scale(${badge})` }}><div className="flogo" style={{ width: "8.5cqw", height: "8.5cqw" }}><Mark size={4.25} color="#fff" /></div></At>
          <At x={50} y={27.3}><Words f={f} at={44} text="Effortless automation" className="head" stagger={6} style={{ fontSize: "5.4cqw", letterSpacing: "-.045em" }} /></At>
          <At x={50} y={34.6}><Words f={f} at={66} text="Describe it once. Zenboard does the work." style={{ fontSize: "2.1cqw", color: "#5E5A52", fontWeight: 400 }} /></At>
        </div>
        {/* shared: the steps card and the prompt card live through the whole scene */}
        <At x={Sx} y={Sy} style={mix(blurIn(f, 40, 30), { transform: `scale(${Ss})` }, run ? blurOut(f, 322, 16) : {})}><Steps state={run ? state : undefined} spin={f * 9} /></At>
        <At x={G.x} y={G.y} style={mix(blurIn(f, 56, 30), { transform: `scale(${G.s})` }, run ? blurOut(f, 318, 16) : {})}>
          <Prompt typed={ease(f, 60, 130, 0.35, 1, CURVE.breathe)} press={press} gloss={gloss * (1 - e)} ring={ring} />
        </At>
      </div>
      {/* the cursor lives in screen space while we are inside the button */}
      {f > 146 && f < 212 ? (
        <div className="cursor zc2" style={{
          left: `${lerp(86, 57, ease(f, 146, 172, 0, 1, CURVE.glide))}%`, top: `${lerp(92, 60, ease(f, 146, 172, 0, 1, CURVE.glide))}%`,
          transform: `rotate(-30deg) scale(${1 - 0.1 * press})`, opacity: ease(f, 146, 156, 0, 1) * (1 - ease(f, 196, 210, 0, 1)),
        }} />
      ) : null}
      {/* 6.3: Zenboard runs it */}
      {run ? (
        <>
          <At x={40} y={45} style={mix(blurIn(f, 262, 24), blurOut(f, 326, 16))}>
            <div className="acard mail"><small>Draft · to Fernwood Hotels</small><b>INV-019 is a week overdue</b><p>Hi Marco, a friendly nudge on INV-019 ($1,500). Happy to resend it if that helps.</p></div>
          </At>
          <At x={8} y={50} style={{ transform: `scale(${0.9 + 0.1 * pop(f, 220, 200, 15)})`, opacity: soft(f, 220), ...blurOut(f, 320, 14) }}><div className="flogo" style={{ width: "4.2cqw", height: "4.2cqw" }}><Mark size={2.1} color="#fff" /></div></At>
          <At x={lerp(84, 50, fly)} y={lerp(49, 28.1, fly)} style={{ opacity: soft(f, 312, 160, 22), transform: `scale(${(0.92 + 0.08 * pop(f, 312, 210, 16)) * lerp(1, 1.5, fly)})` }}>
            <div className="toast"><Icon name="check-circle" size="1.2cqw" color="#6FCF9D" /> Reminder sent to Fernwood Hotels</div>
          </At>
          <At x={50} y={52.5}><Words f={f} at={240} exitAt={320} text="Zenboard does the work." style={{ fontSize: "2.3cqw" }} /></At>
        </>
      ) : null}
      {/* the Focus panel from scene 5 collapsing into the badge */}
      {collapse < 1 ? (
        <div className="stage" style={{ clipPath: `circle(${120 - 115.75 * collapse}% at 50% ${50 - 22.3 * collapse}%)`, background: `radial-gradient(130% 120% at 100% 100%,${F.l} 0%,${F.m} 38%,${F.d} 100%)` }}>
          <div className="stage" style={{ background: "radial-gradient(circle at 35% 30%,#E0468F,#C41C72 55%,#9E1458)", opacity: ease(f, 8, 30, 0, 1) }} />
        </div>
      ) : null}
    </Frame>
  );
};

/**
 * Scene 6 · Zenboard does the work (0:40–0:46). The last feature panel collapses into the Zenboard badge,
 * "Effortless automation" with real pieces floating around (6.1), a 12× zoom-through into Create (6.2),
 * and the automation running by itself (6.3). Ref: Google Workspace "Effortless automation".
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
const Prompt: React.FC<{ typed: number; pressed?: boolean }> = ({ typed, pressed }) => (
  <div className="acard prompt">
    <small>Describe a task for Zenboard</small>
    <p>{TEXT.slice(0, Math.round(TEXT.length * typed))}<span className="caret" /></p>
    <span className={`cbtn${pressed ? " pressed" : ""}`}><Icon name="sparkle" size="1em" /> Create</span>
  </div>
);

export const S6Automation: React.FC = () => {
  const f = useCurrentFrame();
  // hand-off: the Focus panel (full frame) collapses into the badge
  const collapse = ease(f, 0, 34, 0, 1, CURVE.glide);
  const F = FEATS[7];
  const badge = pop(f, 22, 190, 14);
  // 6.2 zoom-through (120–215)
  const zin = ease(f, 118, 150, 0, 1, CURVE.depart);
  const zout = ease(f, 196, 222, 0, 1, CURVE.settle);
  const macro = ease(f, 142, 156, 0, 1) * (1 - ease(f, 196, 208, 0, 1));
  const press = f >= 172 && f < 184;
  const ring = ease(f, 176, 200, 0, 1, CURVE.settle);
  // 6.3 run
  const run = f >= 210;
  const state = f < 232 ? 0 : f < 262 ? 1 : f < 292 ? 2 : 2 + ease(f, 292, 300, 0, 1) > 2.99 ? 3 : 2;
  const sceneScale = 1 + 11 * zin; // zoom into Create
  return (
    <Frame>
      <PaperStage glow={0} />
      <div className="stage" style={{ background: "radial-gradient(46% 58% at 50% 50%,rgba(234,185,203,.55),rgba(250,237,244,.35) 45%,transparent 75%)" }} />
      {/* 6.1 composition */}
      {!run ? (
        <div className="stage" style={{ transform: `scale(${sceneScale})`, transformOrigin: "29.3% 84.5%", filter: zin > 0.05 && zin < 0.98 ? `blur(${zin * 6}px)` : undefined, opacity: 1 - macro }}>
          <At x={21} y={12.5} style={mix(blurIn(f, 40, 30), { transform: "scale(.82)" })}><Steps /></At>
          <At x={79} y={12.5} style={mix(blurIn(f, 48, 30), { transform: "scale(.82)" })}>
            <div className="acard doc"><div className="dl" /><div className="dl" /><div className="dl s" /><div className="dl" /><div className="dl s" /></div>
            <div className="chipx"><Icon name="file-text" size="1.1cqw" /> Add to a doc</div>
          </At>
          <At x={21} y={44} style={mix(blurIn(f, 56, 30), { transform: "scale(.82)" })}><Prompt typed={ease(f, 60, 130, 0.35, 1, CURVE.breathe)} /></At>
          <At x={79} y={44} style={mix(blurIn(f, 64, 30), { transform: "scale(.82)" })}>
            <div className="acard chart"><small>Q3 revenue</small><div className="semi" /><div className="pct"><b>$18.4k</b><span>paid</span><b>$4.3k</b><span>open</span></div></div>
          </At>
          <At x={7} y={CY} style={{ opacity: 0.85 * ease(f, 60, 90, 0, 1), filter: "blur(.25cqw)", transform: `rotate(${f * 0.3}deg)` }}><GMark size={5} /></At>
          <At x={93} y={CY} style={{ opacity: 0.85 * ease(f, 66, 96, 0, 1), filter: "blur(.25cqw)", transform: `rotate(${45 - f * 0.3}deg)` }}><GMark size={5} /></At>
          <At x={50} y={15} style={{ transform: `scale(${badge})` }}><div className="flogo" style={{ width: "8.5cqw", height: "8.5cqw" }}><Mark size={4.25} color="#fff" /></div></At>
          <At x={50} y={27.3}><Words f={f} at={44} text="Effortless automation" className="head" stagger={6} style={{ fontSize: "5.4cqw", letterSpacing: "-.045em" }} /></At>
          <At x={50} y={34.6}><Words f={f} at={66} text="Describe it once. Zenboard does the work." style={{ fontSize: "2.1cqw", color: "#5E5A52", fontWeight: 400 }} /></At>
        </div>
      ) : null}
      {/* 6.2 macro close-up on Create, continuing 6.1 */}
      {macro > 0 ? (
        <div className="stage" style={{ opacity: macro, transform: `scale(${1.25 - 0.25 * ease(f, 142, 176, 0, 1) + 3 * zout})`, filter: zout > 0.02 ? `blur(${zout * 8}px)` : undefined }}>
          <div className="stage paper"><div className="dots" style={{ backgroundSize: "4cqw 4cqw" }} /></div>
          <div className="stage" style={{ background: "radial-gradient(60% 70% at 40% 45%,rgba(234,185,203,.5),transparent 75%)" }} />
          <div className="zcard2"><p>due, send a friendly<br />reminder and move it to Today<span className="caret big" /></p></div>
          <At x={62} y={32} style={{ transform: `scale(${press ? 0.96 : 1})` }}>
            <div className="gbtn berry" style={{ boxShadow: `inset 0 .6cqw .5cqw rgba(255,255,255,.45),inset 0 -.8cqw 1.4cqw rgba(74,10,44,.35),0 0 0 ${1.4 + ring * 4}cqw rgba(196,28,114,${0.14 * (1 - ring)}),0 2.4cqw 5cqw rgba(196,28,114,.35)` }}>
              <span className="gtxt"><Icon name="sparkle" size="1em" /> Create</span>
            </div>
          </At>
          <div className="cursor zc2" style={{ left: `${73 + (1 - ease(f, 150, 172, 0, 1, CURVE.glide)) * 14}%`, top: `${66 + (1 - ease(f, 150, 172, 0, 1, CURVE.glide)) * 18}%`, transform: `rotate(-30deg) scale(${press ? 0.9 : 1})` }} />
        </div>
      ) : null}
      {/* 6.3 Zenboard runs it */}
      {run ? (
        <div className="stage" style={{ opacity: ease(f, 204, 222, 0, 1), transform: `scale(${1.08 - 0.08 * soft(f, 204, 120, 24)})` }}>
          <At x={25} y={22} style={{ transform: "scale(1.15)", ...blurOut(f, 318, 16) }}><Prompt typed={1} pressed /></At>
          <At x={66} y={25} style={mix({ transform: "scale(1.25)" }, blurOut(f, 322, 16))}><Steps state={state} spin={f * 9} /></At>
          <At x={40} y={45} style={mix(blurIn(f, 262, 24), blurOut(f, 326, 16))}>
            <div className="acard mail"><small>Draft · to Fernwood Hotels</small><b>INV-019 is a week overdue</b><p>Hi Marco, a friendly nudge on INV-019 ($1,500). Happy to resend it if that helps.</p></div>
          </At>
          <At x={8} y={50} style={{ transform: `scale(${pop(f, 214, 200, 15)})`, ...blurOut(f, 320, 14) }}><div className="flogo" style={{ width: "4.2cqw", height: "4.2cqw" }}><Mark size={2.1} color="#fff" /></div></At>
          {/* toast: pops, then flies to centre and becomes the first pill of the wall */}
          <At x={84 - 34 * ease(f, 330, 360, 0, 1, CURVE.glide)} y={49 - 21 * ease(f, 330, 360, 0, 1, CURVE.glide)} style={{ transform: `scale(${pop(f, 298, 210, 14) * (1 + 0.5 * ease(f, 330, 360, 0, 1, CURVE.glide))})` }}>
            <div className="toast"><Icon name="check-circle" size="1.2cqw" color="#6FCF9D" /> Reminder sent to Fernwood Hotels</div>
          </At>
          <At x={50} y={52.5}><Words f={f} at={236} exitAt={320} text="Zenboard does the work." style={{ fontSize: "2.3cqw" }} /></At>
        </div>
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

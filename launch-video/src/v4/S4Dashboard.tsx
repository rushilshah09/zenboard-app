/**
 * Scene 4 · Product hero (0:22–0:28). Out of the light flash: the full dashboard floats tilted in 3D over the
 * Berry field (4.1), then a close push along the rows and the "Mark done" click (4.2). The field then shrinks
 * into the right-hand panel of scene 5 while the Done pill flies to the feature list.
 */
import React from "react";
import { useCurrentFrame } from "remotion";
import { At, CURVE, Frame, Halftone, Icon, Lockup, Mark, Words, blurIn, ease, mix, pop, soft } from "./kit";
import { Dashboard } from "./Dashboard";
import { DONE_TARGET, FeatBg } from "./S5Features";

export const BerryField: React.FC<{ style?: React.CSSProperties; drift?: number }> = ({ style, drift = 0 }) => (
  <div className="stage" style={{ overflow: "hidden", ...style }}>
    <div className="stage field" />
    <At x={18 + drift * 2} y={40} style={{ mixBlendMode: "soft-light" }}><Mark size={62} color="#fff" style={{ opacity: 0.07 }} /></At>
    <At x={92 - drift} y={6} style={{ mixBlendMode: "soft-light" }}><Mark size={34} color="#fff" style={{ opacity: 0.06 }} /></At>
    <At x={86 - drift} y={44}><Halftone size={46} color="#fff" opacity={0.09} rot={-8 + drift} /></At>
  </div>
);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const S4Dashboard: React.FC = () => {
  const f = useCurrentFrame();
  const intro = ease(f, 0, 150, 0, 1, CURVE.settle);
  const close = ease(f, 200, 275, 0, 1, CURVE.glide);
  const out = ease(f, 318, 360, 0, 1, CURVE.glide);
  const persp = lerp(80, 50, close), rx = lerp(lerp(26, 12, intro), 16, close), ry = lerp(lerp(-14, -7, intro), -12, close);
  const sc = lerp(lerp(1.22, 1, intro), 1.35, close) * (1 - 0.12 * out);
  const whipOut = 1 - ease(f, 0, 24, 0, 1, CURVE.settle);
  const dx = lerp(49, 46, close), dy = lerp(lerp(33, 29.3, intro), 32, close);
  const click = f >= 290;
  const press = f >= 286 && f < 296 ? 0.94 : 1;
  // cursor path to the Mark done button
  const cur = ease(f, 236, 284, 0, 1, CURVE.glide);
  const fx = lerp(74, 64, close), fy = lerp(13, 30, close);
  // exit: field shrinks into scene 5's right panel (left 38%, top 3%, right 2.2%, bottom 3%)
  const inset = `inset(${3 * out}% ${2.2 * out}% ${3 * out}% ${34 * out}% round ${2 * out}cqw)`;
  const doneFly = ease(f, 318, 356, 0, 1, CURVE.glide);
  return (
    <Frame>
      <div className="stage paper" />
      <BerryField drift={f / 60} style={{ clipPath: inset }} />
      {/* the field turns into scene 5's Tasks field as it shrinks into the panel */}
      <div className="rpanel" style={{ left: `${34 * out}%`, top: `${3 * out}%`, right: `${2.2 * out}%`, bottom: `${3 * out}%`, borderRadius: `${2 * out}cqw`, opacity: ease(f, 312, 356, 0, 1, CURVE.breathe) }}>
        <FeatBg i={0} f={0} />
      </div>
      <div className="stage" style={{ clipPath: inset, opacity: 1 - ease(f, 322, 350, 0, 1), filter: whipOut > 0.01 ? `blur(${whipOut * 12}px)` : undefined }}>
        <At x={50} y={5} style={mix(blurIn(f, 24, 12), { opacity: 1 - close })}><Lockup width={12} color="#fff" markColor="#fff" /></At>
        <At x={dx} y={dy}>
          <div className="frost" style={{ transform: `perspective(${persp}cqw) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${0.6 * (1 - close)}deg) scale(${sc})`, transformOrigin: "50% 60%",
            WebkitMaskImage: close > 0 ? `linear-gradient(100deg,#000 ${lerp(100, 45, close)}%,rgba(0,0,0,${lerp(1, 0.25, close)}))` : undefined }}>
            <Dashboard done={click} rowStyle={(i) => ({ opacity: soft(f, 30 + i * 6, 150, 22) })} />
          </div>
        </At>
        <At x={fx} y={fy} style={{ transform: `scale(${pop(f, 70, 190, 15)})` }}>
          <div className="float">
            <div className="hl-l">Today&apos;s highlight</div>
            <div className="hl-t">{click ? <s>Send invoice for July to TechSpark</s> : "Send invoice for July to TechSpark"}</div>
            <div className="hl-b">
              {!click ? <span className="btn"><Icon name="play" size="1em" /> Start focus</span> : null}
              <span className={`btn g${click ? " on" : ""}`} style={{ transform: `scale(${press})`, opacity: 1 - doneFly }}><Icon name="check" weight="bold" size="1em" /> {click ? "Done" : "Mark done"}</span>
            </div>
          </div>
        </At>
        {cur > 0 && f < 318 ? <div className="cursor" style={{ left: `${lerp(90, 70.5, cur)}%`, top: `${lerp(95, 62, cur)}%`, transform: `rotate(-30deg) scale(${press})` }} /> : null}
      </div>
      {/* the Done pill flies to become the first feature pill of scene 5 */}
      {doneFly > 0 ? (
        <At x={lerp(fx + 1, DONE_TARGET.x, doneFly)} y={lerp(fy + 6, DONE_TARGET.y, doneFly)} style={{ transform: `scale(${lerp(1, DONE_TARGET.scale, doneFly)})` }}>
          <span className="btn g on" style={{ fontSize: "1cqw" }}><Icon name="check" weight="bold" size="1em" /> Done</span>
        </At>
      ) : null}
      <At x={50} y={53.3}><Words f={f} at={96} exitAt={196} text="Your whole day. One view." style={{ fontSize: "2.1cqw", color: "#fff" }} /></At>
    </Frame>
  );
};

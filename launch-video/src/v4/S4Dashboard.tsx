/**
 * Scene 4 · Product hero (0:22–0:28). Out of the light flash: the full dashboard floats tilted in 3D over the
 * Berry field (4.1), then a close push along the rows and the "Mark done" click (4.2). The field then shrinks
 * into the right-hand panel of scene 5 while the Done pill flies to the feature list.
 */
import React from "react";
import { useCurrentFrame } from "remotion";
import { At, CURVE, Cursor, Frame, Halftone, Icon, Lockup, Mark, Words, blurIn, ease, mix, pop, soft } from "./kit";

const CY = 56.25 / 2;
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
  const intro = ease(f, 8, 170, 0, 1, CURVE.glide); // flat (as scene 3 left it) → tilted
  const close = ease(f, 200, 275, 0, 1, CURVE.glide);
  const out = ease(f, 318, 360, 0, 1, CURVE.glide);
  const persp = lerp(80, 50, close), rx = lerp(lerp(0, 12, intro), 16, close), ry = lerp(lerp(0, -7, intro), -12, close);
  const sc = lerp(1, 1.35, close) * (1 - 0.12 * out);
  const dx = lerp(lerp(50, 49, intro), 46, close), dy = lerp(lerp(28.1, 29.3, intro), 32, close);
  const click = f >= 290;
  const press = soft(f, 284, 380, 26) * (1 - soft(f, 292, 300, 26));
  const cur = ease(f, 232, 282, 0, 1, CURVE.glide);
  const fx = lerp(74, 64, close), fy = lerp(13, 30, close);
  // exit: field shrinks into scene 5's right panel (left 38%, top 3%, right 2.2%, bottom 3%)
  const inset = `inset(${3 * out}% ${2.2 * out}% ${3 * out}% ${34 * out}% round ${2 * out}cqw)`;
  const doneFly = ease(f, 318, 356, 0, 1, CURVE.glide);
  const bx = fx + 1.85, by = fy + 3.1; // the Mark done button's centre
  return (
    <Frame>
      <div className="stage paper" />
      <BerryField drift={f / 60} style={{ clipPath: inset }} />
      {/* the field turns into scene 5's Tasks field as it shrinks into the panel */}
      <div className="rpanel" style={{ left: `${34 * out}%`, top: `${3 * out}%`, right: `${2.2 * out}%`, bottom: `${3 * out}%`, borderRadius: `${2 * out}cqw`, opacity: ease(f, 312, 356, 0, 1, CURVE.breathe) }}>
        <FeatBg i={0} f={0} />
      </div>
      <div className="stage" style={{ clipPath: inset, opacity: 1 - ease(f, 322, 350, 0, 1) }}>
        <At x={50} y={5} style={mix(blurIn(f, 24, 12), { opacity: 1 - close })}><Lockup width={12} color="#fff" markColor="#fff" /></At>
        <At x={dx} y={dy}>
          <div className="frost" style={{ transform: `perspective(${persp}cqw) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${0.6 * (1 - close)}deg) scale(${sc})`, transformOrigin: "50% 60%",
            WebkitMaskImage: close > 0 ? `linear-gradient(100deg,#000 ${lerp(100, 45, close)}%,rgba(0,0,0,${lerp(1, 0.25, close)}))` : undefined }}>
            <Dashboard done={click} />
          </div>
        </At>
        {/* scene 3's desktop frame, exactly where scene 3 left it, dissolves into the frosted one */}
        {f < 30 ? (
          <At x={50} y={CY} style={{ transform: "scale(1.565)", opacity: 1 - ease(f, 2, 28, 0, 1, CURVE.breathe) }}>
            <div className="wipe desk"><div className="wipe-in"><div className="deskfit"><Dashboard /></div></div></div>
          </At>
        ) : null}
        <At x={fx} y={fy} style={{ transform: `scale(${pop(f, 70, 190, 15)})` }}>
          <div className="float">
            <div className="hl-l">Today&apos;s highlight</div>
            <div className="hl-t">{click ? <s>Send invoice for July to TechSpark</s> : "Send invoice for July to TechSpark"}</div>
            <div className="hl-b">
              <span className="btn" style={{ opacity: click ? 0.35 : 1 }}><Icon name="play" size="1em" /> Start focus</span>
              <span className={`btn g${click ? " on" : ""}`} style={{ transform: `scale(${1 - 0.06 * press})`, opacity: doneFly > 0 ? 0 : 1 }}><Icon name="check" weight="bold" size="1em" /> {click ? "Done" : "Mark done"}</span>
            </div>
          </div>
        </At>
        {cur > 0 && f < 330 ? <Cursor x={lerp(96, bx + 0.6, cur)} y={lerp(60, by + 0.4, cur)} press={press} opacity={ease(f, 232, 244, 0, 1) * (1 - ease(f, 312, 328, 0, 1))} /> : null}
      </div>
      {/* the Done pill flies to become the first feature pill of scene 5 */}
      {doneFly > 0 ? (
        <At x={lerp(bx, DONE_TARGET.x, doneFly)} y={lerp(by, DONE_TARGET.y, doneFly)} style={{ transform: `scale(${lerp(1, DONE_TARGET.scale, doneFly)})` }}>
          <span className="donepill"><Icon name="check" weight="bold" size="1em" /> Done</span>
        </At>
      ) : null}
      <At x={50} y={53.3}><Words f={f} at={96} exitAt={196} text="Your whole day. One view." style={{ fontSize: "2.1cqw", color: "#fff" }} /></At>
    </Frame>
  );
};

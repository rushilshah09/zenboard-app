/**
 * Scene 8 · Icon carousel (0:51–0:58). Chunky 3D module tiles on a dark stage with a warm Berry glow;
 * the row steps with a spring snap (Tasks → Projects → Money → Habits), the label changes each step.
 * Ends with the glow blooming to Paper for the finale. Ref: Semantical carousel, terminal icon.
 */
import React from "react";
import { useCurrentFrame } from "remotion";
import { At, BERRY, CURVE, FIELD, Frame, Grain, Icon, Lockup, blurIn, ease, rnd, soft } from "./kit";
import { IconName } from "./icons.generated";

const STRIP: [string, string, string, IconName][] = [
  ["Invoices", FIELD.apricot, "#fff", "receipt"], ["Calendar", FIELD.sky, "#fff", "calendar-blank"], ["Tasks", "#F5F1EA", BERRY, "check-square"],
  ["Projects", BERRY, "#fff", "kanban"], ["Money", FIELD.sage, "#fff", "currency-circle-dollar"], ["Habits", "#E07AAE", "#fff", "plant"],
  ["Focus", FIELD.peri, "#fff", "timer"], ["Docs", "#8FC3D6", "#fff", "file-text"],
];
const STEPS = [80, 170, 260]; // frames where the row advances

export const S8Carousel: React.FC = () => {
  const f = useCurrentFrame();
  let pos = 2;
  for (const t of STEPS) pos += soft(f, t, 210, 20);
  const cur = Math.round(pos);
  const bloom = ease(f, 370, 420, 0, 1, CURVE.breathe);
  return (
    <Frame>
      <div className="stage" style={{ background: "#16060F" }} />
      <div className="stage floorglow" style={{ opacity: ease(f, 0, 40, 0.3, 1) }} />
      <div className="stage rays" style={{ transform: `rotate(${Math.sin(f / 80) * 2}deg)` }} />
      {Array.from({ length: 26 }, (_, i) => (
        <At key={i} x={(rnd(i) * 100 + f * (0.01 + rnd(i + 3) * 0.02)) % 100} y={4 + rnd(i + 7) * 30 - f * 0.004 * (1 + rnd(i))}
          style={{ width: `${0.16 + rnd(i + 5) * 0.7}cqw`, height: `${0.16 + rnd(i + 5) * 0.7}cqw`, borderRadius: "50%", background: `rgba(255,220,235,${0.05 + rnd(i + 9) * 0.17})` }} />
      ))}
      <At x={50} y={6.5} style={blurIn(f, 20, 10)}><Lockup width={17} color="#F7F1E8" markColor="#F7F1E8" /></At>
      {STRIP.map(([name, c, g, ic], i) => {
        const rel = i - pos;
        if (Math.abs(rel) > 2.6) return null;
        const a = Math.abs(rel);
        const size = a < 1 ? 18 - 5 * a : 13 - 2 * Math.min(1, a - 1);
        const x = 50 + Math.sign(rel) * (a < 1 ? 26 * a : 26 + 22 * (a - 1));
        const lift = i === 2 && f < 30 ? (1 - soft(f, 0, 140, 22)) * 4 : 0;
        return (
          <React.Fragment key={name}>
            <At x={x} y={25 - (a < 1 ? 1 - a : 0) * 1 + lift} style={{ zIndex: 10 - Math.round(a * 3) }}>
              <div className="i3" style={{ width: `${size}cqw`, height: `${size}cqw`, ["--c" as string]: c, color: g, filter: a > 1.4 ? `blur(${(a - 1.4) * 2}px)` : undefined }}>
                <span className="i3g"><Icon name={ic} size="100%" /></span>
              </div>
            </At>
            {a > 0.5 ? <At x={x} y={25 + size / 2 + 2.4} style={{ opacity: Math.min(1, (a - 0.5) * 2) }}><span className="i3lab">{name}</span></At> : null}
          </React.Fragment>
        );
      })}
      <At x={50} y={40.5}><span className="lbl" key={cur} style={blurIn(f, cur === 2 ? 20 : STEPS[cur - 3] + 6, 8, 8)}>{STRIP[cur][0]}</span></At>
      <At x={50} y={51.5}>
        <span className="cstep">{Array.from({ length: 8 }, (_, k) => <i key={k} className={k === cur - 2 + 0 ? "on" : ""} />)}<em>0{cur - 1} / 08</em></span>
      </At>
      <Grain f={f} opacity={0.12} />
      <div className="stage" style={{ background: "radial-gradient(circle at 50% 100%, #FBFAF6 0%, #FBFAF6 40%, rgba(251,250,246,0) 70%)", opacity: bloom, transform: `scale(${1 + bloom * 1.5})`, transformOrigin: "50% 100%" }} />
      <div className="stage" style={{ background: "#FBFAF6", opacity: ease(f, 395, 420, 0, 1) }} />
    </Frame>
  );
};

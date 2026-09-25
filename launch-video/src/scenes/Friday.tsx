import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Dissolve } from "../components/Dissolve";
import { Headline } from "../components/Headline";
import { Illustration, groundOf } from "../components/Illustration";
import { Sfx } from "../components/Sfx";
import { ease, font, light, radius, tween } from "../theme";

/** 06 · The week races to Friday; all that's left is a knot. */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DAY_AT = [0, 10, 20, 30, 40];

export const Friday: React.FC = () => {
  const frame = useCurrentFrame();
  const day = DAY_AT.filter((d) => d <= frame).length - 1;
  const card = tween(frame, [30, 54], [0, 1], ease.spring);
  return (
    <AbsoluteFill style={{ background: light.bg, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 90, left: 160, display: "flex", gap: 12 }}>
        {DAYS.map((d, i) => {
          const on = i === day;
          const past = i < day;
          return (
            <div
              key={d}
              style={{
                padding: "12px 26px",
                borderRadius: radius.pill,
                fontFamily: font.mono,
                fontSize: 30,
                background: on ? light.text : "transparent",
                color: on ? light.bg : past ? light.muted : light.text,
                border: `2px solid ${on ? light.text : light.faint}`,
                textDecoration: past ? "line-through" : "none",
                scale: String(on ? 1 + Math.max(0, 1 - (frame - DAY_AT[i]) / 8) * 0.12 : 1),
              }}
            >
              {d}
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 160, top: 300, width: 820 }}>
        <Headline text="By Friday, you've spent more time *managing* your work…" at={8} size={84} tint={light.text} align="left" stagger={3} />
        {frame < 140 ? (
          <Headline text="…than *doing* it." at={104} size={84} tint={light.text} align="left" style={{ marginTop: 36 }} />
        ) : (
          <Dissolve text="…than *doing* it." at={146} size={84} tint={light.text} style={{ marginTop: 36, lineHeight: 1.08 }} />
        )}
      </div>
      <div
        style={{
          position: "absolute",
          left: 1100,
          top: 220,
          width: 660,
          height: 660,
          borderRadius: radius.xl * 2,
          background: groundOf("tangled-thread"),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: card,
          scale: String(0.85 + card * 0.15),
          rotate: `${(1 - card) * -5}deg`,
        }}
      >
        <Illustration name="tangled-thread" draw={tween(frame, [36, 150], [0, 1], (x) => x)} size={560} />
      </div>
      {DAY_AT.map((d) => (
        <Sfx key={d} at={d} sound="tick" volume={0.35} />
      ))}
      <Sfx at={34} sound="pop" volume={0.25} />
      <Sfx at={144} sound="whoosh" volume={0.35} />
    </AbsoluteFill>
  );
};

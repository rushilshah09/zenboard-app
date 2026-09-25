import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Headline } from "../components/Headline";
import { Illustration, groundOf } from "../components/Illustration";
import { Sfx } from "../components/Sfx";
import { color, ease, font, light, radius, shadow, tween } from "../theme";

/** 02 · "Then… the work shows up." Work items pop into orbit and speed up. */

const ITEMS = [
  { label: "Proposal", tint: color.labelOchre },
  { label: "Invoice #024", tint: color.labelMoss },
  { label: "Client call · 3pm", tint: color.info500 },
  { label: "Brand review", tint: color.berry500 },
  { label: "Tax receipts", tint: color.labelRust },
  { label: "Inbox (38)", tint: color.info500 },
  { label: "Timesheet", tint: color.labelStone },
  { label: "Newsletter", tint: color.labelOchre },
];

export const WorkArrives: React.FC = () => {
  const frame = useCurrentFrame();
  const card = tween(frame, [0, 20], [0, 1], ease.spring);
  // Orbit angle accelerates: calm at first, frantic by the cut.
  const spin = frame * 0.004 + Math.pow(Math.max(0, frame - 90) / 75, 2.4) * 2.2;
  return (
    <AbsoluteFill style={{ background: light.bg, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 80, width: "100%" }}>
        <Headline text="Then… the work *shows up.*" at={6} size={96} tint={light.text} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 960 - 260,
          top: 600 - 260,
          width: 520,
          height: 520,
          borderRadius: radius.pill,
          background: groundOf("juggling"),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          scale: String(0.7 + card * 0.3),
          opacity: card,
        }}
      >
        <Illustration name="juggling" draw={tween(frame, [4, 50], [0, 1], (x) => x)} size={440} />
      </div>
      {ITEMS.map((it, i) => {
        const at = 34 + i * 9;
        const inT = tween(frame, [at, at + 12], [0, 1], ease.spring);
        const a = (i / ITEMS.length) * Math.PI * 2 + spin;
        const rx = 560;
        const ry = 250;
        const blur = Math.max(0, frame - 130) / 8;
        return (
          <div
            key={it.label}
            style={{
              position: "absolute",
              left: 960 + Math.cos(a) * rx * inT,
              top: 600 + Math.sin(a) * ry * inT,
              translate: "-50% -50%",
              scale: String(inT),
              opacity: inT,
              filter: `blur(${blur}px)`,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 22px",
              borderRadius: radius.pill,
              background: light.surface,
              boxShadow: shadow.float,
              fontFamily: font.sans,
              fontSize: 26,
              fontWeight: 500,
              color: light.text,
              whiteSpace: "nowrap",
              zIndex: Math.sin(a) > 0 ? 2 : 0,
            }}
          >
            <div style={{ width: 12, height: 12, borderRadius: radius.pill, background: it.tint }} />
            {it.label}
          </div>
        );
      })}
      {ITEMS.map((_, i) => (
        <Sfx key={i} at={34 + i * 9} sound="pop" volume={0.22 + i * 0.02} />
      ))}
      <Sfx at={138} sound="whoosh" volume={0.4} />
    </AbsoluteFill>
  );
};

import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Headline } from "../components/Headline";
import { Illustration, groundOf } from "../components/Illustration";
import { ease, light, radius, tween } from "../theme";

/** 15 · The resolution: one desk, one tool, some quiet. */
export const Calm: React.FC = () => {
  const frame = useCurrentFrame();
  const card = tween(frame, [0, 24], [0, 1], ease.out);
  const zoom = tween(frame, [0, 150], [1, 1.05], (x) => x);
  return (
    <AbsoluteFill style={{ background: light.bg, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: 160,
          top: 170,
          width: 740,
          height: 740,
          borderRadius: radius.xl * 2,
          background: groundOf("calm-desk"),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: card,
          scale: String(zoom * (0.94 + card * 0.06)),
        }}
      >
        <Illustration name="calm-desk" draw={tween(frame, [4, 80], [0, 1], (x) => x)} size={620} />
      </div>
      <div style={{ position: "absolute", left: 1010, top: 380, width: 800 }}>
        <Headline text="No more *switching.*" at={6} size={100} tint={light.text} align="left" out={62} />
      </div>
      <div style={{ position: "absolute", left: 1010, top: 380, width: 800 }}>
        <Headline text="Just your work, *in flow.*" at={70} size={100} tint={light.text} align="left" />
      </div>
    </AbsoluteFill>
  );
};

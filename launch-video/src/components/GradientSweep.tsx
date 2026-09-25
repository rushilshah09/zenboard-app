import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { color, ease, ground, tween } from "../theme";

/**
 * Soft, blurred colour field that washes across a cut — used as a
 * TransitionSeries overlay so the scenes underneath swap while it peaks.
 */
export const GradientSweep: React.FC<{ direction?: 1 | -1 }> = ({ direction = 1 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = tween(frame, [0, durationInFrames - 1], [0, 1], ease.inOut);
  const peak = Math.sin(p * Math.PI);
  const blobs = [
    { c: color.berry300, y: 30, s: 900, o: 0 },
    { c: ground.sand, y: 70, s: 1100, o: 0.12 },
    { c: ground.mist, y: 45, s: 800, o: 0.22 },
    { c: color.labelOchre, y: 85, s: 700, o: 0.3 },
    { c: ground.blush, y: 10, s: 900, o: 0.18 },
  ];
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: Math.min(1, peak * 1.6) }}>
      <AbsoluteFill style={{ background: ground.cream, opacity: peak * 0.9 }} />
      {blobs.map((b, i) => {
        const x = (-40 + (p + b.o) * 140) * direction + (direction < 0 ? 100 : 0);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${b.y}%`,
              width: b.s,
              height: b.s * 0.7,
              marginLeft: -b.s / 2,
              marginTop: -b.s * 0.35,
              borderRadius: "50%",
              background: b.c,
              filter: "blur(120px)",
              opacity: 0.9,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

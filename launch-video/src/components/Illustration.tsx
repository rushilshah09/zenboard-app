import React from "react";
import { Img, staticFile } from "remotion";
import { FONT } from "../brand/fonts";
import { Rect } from "../brand/layout";
import { EASE } from "../brand/motion";
import { ART } from "../brand/illustrations.generated";
import { colour, radius, type } from "../brand/tokens";
import { firstFile } from "./media";

/**
 * Line art (§7). Art converted from art-src/ (src/brand/illustrations.generated.ts)
 * builds up path by path as `draw` goes 0 → 1, each shape fading and settling
 * 10 units into place, and `parallax` (px) slides later layers further than
 * earlier ones. Otherwise reads public/img/<code>.svg or .png with a
 * left-to-right wipe; until a file exists a labelled placeholder holds its frame.
 */
export const ILLUSTRATIONS = {
  "IMG-01": "Founder at a small desk, morning",
  "IMG-02": "Blank note card on the desk",
  "IMG-06a": "Deep work",
  "IMG-06b": "A walk",
  "IMG-06c": "Dinner",
  "IMG-06d": "A day off",
  "IMG-07": "Same founder, same desk, evening",
} as const;

export type IllustrationCode = keyof typeof ILLUSTRATIONS;

export const Illustration: React.FC<{
  code: IllustrationCode;
  rect: Rect;
  draw: number;
  fit?: "contain" | "cover";
  parallax?: number;
  style?: React.CSSProperties;
}> = ({ code, rect, draw, fit = "contain", parallax = 0, style }) => {
  const art = ART[code];
  if (art) {
    const n = art.paths.length;
    return (
      <svg
        viewBox={`0 0 ${art.w} ${art.h}`}
        preserveAspectRatio={fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"}
        style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, overflow: fit === "cover" ? "hidden" : "visible", ...style }}
      >
        {art.paths.map((p, i) => {
          const depth = i / Math.max(1, n - 1);
          const s = depth * 0.65;
          const t = EASE.settle(Math.min(1, Math.max(0, (draw - s) / 0.35)));
          return (
            <path
              key={i}
              d={p.d}
              fill={p.fill}
              style={{ opacity: t, translate: `${parallax * (depth - 0.5)}px ${(1 - t) * 10}px` }}
            />
          );
        })}
      </svg>
    );
  }
  const src = firstFile([`img/${code}.svg`, `img/${code}.png`]);
  const box: React.CSSProperties = { position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, ...style };
  if (src) {
    return (
      <div style={box}>
        <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: fit, clipPath: `inset(0 ${(1 - draw) * 100}% 0 0)` }} />
      </div>
    );
  }
  return (
    <div
      style={{
        ...box,
        borderRadius: radius.window,
        border: `2px dashed ${colour.hairline}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        ...type.caption,
        color: colour.stone,
        opacity: Math.min(1, draw * 2),
        textAlign: "center",
      }}
    >
      {code} · {ILLUSTRATIONS[code]}
    </div>
  );
};

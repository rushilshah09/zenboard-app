import React from "react";
import { Img, staticFile } from "remotion";
import { FONT } from "../brand/fonts";
import { Rect } from "../brand/layout";
import { colour, radius, type } from "../brand/tokens";
import { firstFile } from "./media";

/**
 * Generated line art (§7). Reads public/img/<code>.svg or .png; until the
 * file exists a quiet labelled placeholder holds its exact frame. The art
 * reveals with a left-to-right wipe on the Breathe curve (`draw` 0 → 1).
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

export const Illustration: React.FC<{ code: IllustrationCode; rect: Rect; draw: number; fit?: "contain" | "cover"; style?: React.CSSProperties }> = ({
  code,
  rect,
  draw,
  fit = "contain",
  style,
}) => {
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

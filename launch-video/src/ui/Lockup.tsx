import React from "react";
import { LOCKUP_LETTERS, LOCKUP_MARK, LOCKUP_VIEWBOX } from "../brand/logo.generated";
import { colour } from "../brand/tokens";

/** The real Zenboard lockup (from the app's <Logo>): pink mark + wordmark. `h` is the mark height in px. */
export const Lockup: React.FC<{ h: number; ink?: string; mark?: string; style?: React.CSSProperties }> = ({ h, ink = colour.ink, mark = colour.pink, style }) => (
  <svg width={(LOCKUP_VIEWBOX.w / LOCKUP_VIEWBOX.h) * h} height={h} viewBox={`0 0 ${LOCKUP_VIEWBOX.w} ${LOCKUP_VIEWBOX.h}`} style={{ display: "block", overflow: "visible", ...style }}>
    <path d={LOCKUP_MARK} fill={mark} />
    {LOCKUP_LETTERS.map((d, i) => (
      <path key={i} d={d} fill={ink} />
    ))}
  </svg>
);

/** The mark alone on the lockup's 32-unit grid. */
export const MarkOnly: React.FC<{ size: number; fill?: string; style?: React.CSSProperties }> = ({ size, fill = colour.pink, style }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" style={{ display: "block", overflow: "visible", ...style }}>
    <path d={LOCKUP_MARK} fill={fill} />
  </svg>
);

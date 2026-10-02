import React from "react";
import { colour } from "../brand/tokens";

/** Pointer in Ink (there is no black). `pressed` gives the 0.96 press. */
export const Cursor: React.FC<{ x: number; y: number; pressed?: number; opacity?: number }> = ({ x, y, pressed = 0, opacity = 1 }) => (
  <svg
    width={36}
    height={36}
    viewBox="0 0 24 24"
    style={{
      position: "absolute",
      left: x - 5,
      top: y - 3,
      scale: String(1 - pressed * 0.04),
      transformOrigin: "5px 3px",
      opacity,
      zIndex: 50,
      filter: "drop-shadow(0 2px 4px rgba(40, 4, 23, 0.16))",
    }}
  >
    <path d="M5 3l14 8.2-6.3 1.3 3.9 6.9-2.6 1.4-3.9-6.9L5 18.6z" fill={colour.ink} stroke={colour.card} strokeWidth={1.4} strokeLinejoin="round" />
  </svg>
);

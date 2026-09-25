import React from "react";
import { colour } from "../brand/tokens";

/** The pink connecting thread: an SVG path that draws on with `progress`. */
export const Thread: React.FC<{ d: string; progress: number; opacity?: number; width?: number; height?: number }> = ({
  d,
  progress,
  opacity = 1,
  width = 1920,
  height = 1080,
}) => (
  <svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none", opacity }}>
    <path
      d={d}
      fill="none"
      stroke={colour.pink}
      strokeWidth={3}
      strokeLinecap="round"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - progress}
    />
  </svg>
);

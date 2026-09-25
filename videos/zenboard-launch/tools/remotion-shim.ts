// Static stand-in for the few Remotion exports the v4 UI components import, so they render to plain HTML.
import React from "react";
export const AbsoluteFill = (p: any) => React.createElement("div", { ...p, style: { position: "absolute", inset: 0, ...p.style } });
export const Img = (p: any) => React.createElement("img", p);
export const staticFile = (p: string) => `assets/${p}`;
export const Easing = { bezier: () => (t: number) => t };
export const interpolate = (x: number, i: number[], o: number[]) => o[0] + ((o[1] - o[0]) * Math.max(0, Math.min(1, (x - i[0]) / (i[1] - i[0]))));
export const spring = () => 1;
export const useCurrentFrame = () => 0;

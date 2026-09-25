import React from "react";
import { AbsoluteFill, interpolateColors } from "remotion";
import { Look, lookAt } from "../brand/look";
import { aurora, colour, voidColour } from "../brand/tokens";

/**
 * The living background under the whole film (STYLE.md). One layer, driven by
 * the global frame, so it flows continuously across every cut:
 * - light: warm white with large aurora blobs drifting at the edges (Jurni);
 * - dark: a deep plum void with slow indigo and magenta glows (the chaos);
 * - brand: the full-bleed Zenboard gradient, which rises in stepped columns.
 */

type Blob = { c: string; x: number; y: number; r: number; sx: number; sy: number; ph: number };

const LIGHT: Blob[] = [
  { c: aurora.violet, x: 0.08, y: 1.02, r: 0.62, sx: 0.06, sy: 0.05, ph: 0 },
  { c: aurora.pink, x: 0.55, y: 1.12, r: 0.55, sx: 0.08, sy: 0.04, ph: 1.7 },
  { c: aurora.coral, x: 1.02, y: 0.86, r: 0.58, sx: 0.05, sy: 0.07, ph: 3.1 },
  { c: aurora.periwinkle, x: -0.06, y: 0.3, r: 0.42, sx: 0.04, sy: 0.08, ph: 4.4 },
  { c: aurora.peach, x: 0.96, y: 0.05, r: 0.36, sx: 0.05, sy: 0.05, ph: 2.2 },
];
const DARK: Blob[] = [
  { c: "#3A2A9C", x: 0.18, y: 0.85, r: 0.6, sx: 0.07, sy: 0.05, ph: 0.4 },
  { c: "#7A1B55", x: 0.86, y: 0.2, r: 0.5, sx: 0.06, sy: 0.06, ph: 2.6 },
  { c: "#1D3F8F", x: 0.6, y: 1.05, r: 0.55, sx: 0.08, sy: 0.04, ph: 4.1 },
];
const BRAND: Blob[] = [
  { c: aurora.violet, x: 0.1, y: 0.2, r: 0.9, sx: 0.08, sy: 0.06, ph: 0 },
  { c: aurora.pink, x: 0.55, y: 0.6, r: 0.8, sx: 0.07, sy: 0.08, ph: 1.9 },
  { c: aurora.coral, x: 0.95, y: 0.95, r: 0.8, sx: 0.06, sy: 0.05, ph: 3.3 },
  { c: aurora.periwinkle, x: 0.05, y: 1.0, r: 0.6, sx: 0.05, sy: 0.07, ph: 5.0 },
];

const blobs = (list: Blob[], g: number, alpha: number) =>
  list.map((b, i) => {
    const x = (b.x + Math.sin(g / 170 + b.ph) * b.sx) * 1920;
    const y = (b.y + Math.cos(g / 150 + b.ph * 1.3) * b.sy) * 1080;
    const r = b.r * 1920 * (1 + Math.sin(g / 210 + b.ph) * 0.06);
    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left: x - r,
          top: y - r,
          width: r * 2,
          height: r * 2,
          borderRadius: "50%",
          background: `radial-gradient(closest-side, ${b.c}, transparent)`,
          opacity: alpha,
        }}
      />
    );
  });

/** Stepped columns (Jurni): the gradient rises from the bottom, centre columns first. */
const stepMask = (p: number) => {
  const n = 12;
  const pts: string[] = ["0% 100%"];
  for (let i = 0; i < n; i++) {
    const d = Math.abs(i + 0.5 - n / 2) / (n / 2);
    const h = Math.max(0, Math.min(1, p * 1.9 - d * 0.9)) * 100;
    pts.push(`${(i / n) * 100}% ${100 - h}%`, `${((i + 1) / n) * 100}% ${100 - h}%`);
  }
  pts.push("100% 100%");
  return `polygon(${pts.join(", ")})`;
};

export const Aurora: React.FC<{ g: number; look?: Look; rising?: boolean }> = ({ g, look = lookAt(g), rising = true }) => {
  const base = interpolateColors(look.dark, [0, 1], [colour.paper, voidColour]);
  return (
    <AbsoluteFill style={{ background: base, overflow: "hidden" }}>
      {look.dark < 1 ? <AbsoluteFill style={{ opacity: 1 - look.dark }}>{blobs(LIGHT, g, look.aurora)}</AbsoluteFill> : null}
      {look.dark > 0 ? <AbsoluteFill style={{ opacity: look.dark }}>{blobs(DARK, g, 0.75)}</AbsoluteFill> : null}
      {look.brand > 0 ? (
        <AbsoluteFill style={{ background: aurora.violet, clipPath: rising ? stepMask(look.brand) : undefined, opacity: rising ? 1 : look.brand }}>
          {blobs(BRAND, g, 1)}
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

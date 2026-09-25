import React from "react";
import { Img, staticFile } from "remotion";
import { rand } from "../theme";
import { hasFile } from "./Sfx";

/**
 * Hand-drawn illustration slot.
 *
 * If `public/illustrations/<name>.png` exists (see STORY.md for the prompts),
 * it is shown multiplied onto its ground, so a white background disappears.
 * Until then a line-drawn stand-in is drawn on, stroke by stroke.
 */

export type IllustrationName =
  | "founder-idea"
  | "juggling"
  | "tangled-thread"
  | "connected-puzzle"
  | "calm-desk"
  | "habit-plant"
  | "goal-path"
  | "focus-hourglass"
  | "rituals-sun";

const INK = "#161616";

/** Procedural tangled scribble — the knot of a scattered week. */
const scribble = (seed: number) => {
  let d = "M200 200";
  let x = 200;
  let y = 200;
  for (let i = 0; i < 46; i++) {
    const a = rand(seed + i) * Math.PI * 2;
    const r = 40 + rand(seed + i * 3) * 70;
    const nx = 200 + Math.cos(a) * r;
    const ny = 190 + Math.sin(a) * r * 0.9;
    const cx = (x + nx) / 2 + (rand(seed + i * 7) - 0.5) * 120;
    const cy = (y + ny) / 2 + (rand(seed + i * 11) - 0.5) * 120;
    d += ` Q${cx.toFixed(1)} ${cy.toFixed(1)} ${nx.toFixed(1)} ${ny.toFixed(1)}`;
    x = nx;
    y = ny;
  }
  return `${d} C300 230 330 300 390 300`;
};

const DOODLES: Record<IllustrationName, string[]> = {
  "founder-idea": [
    "M110 380 C118 330 130 300 150 286 C170 272 196 270 214 262 C232 254 250 238 262 230",
    "M150 286 C140 268 146 250 164 246 C190 240 214 244 236 236",
    "M214 262 C236 262 262 256 280 246",
    "M160 150 L318 92 L262 214 L236 168 Z",
    "M236 168 L318 92",
    "M150 160 C120 170 96 190 80 214",
    "M70 232 C64 240 60 248 58 258",
  ],
  juggling: [
    "M200 250 m-34 0 a34 34 0 1 0 68 0 a34 34 0 1 0 -68 0",
    "M120 390 C124 330 150 298 200 296 C250 298 276 330 280 390",
    "M140 316 C110 290 90 250 84 210",
    "M260 316 C290 290 310 250 316 210",
    "M70 200 C74 188 94 188 98 200",
    "M302 200 C306 188 326 188 330 200",
  ],
  "tangled-thread": [scribble(3)],
  "connected-puzzle": [
    "M70 150 H150 C150 130 160 118 176 118 C192 118 202 130 202 150 H250 V200 C270 200 282 210 282 226 C282 242 270 252 250 252 V300 H70 Z",
    "M250 200 C270 200 282 210 282 226 C282 242 270 252 250 252 V300 H340 V150 H250 Z",
    "M30 330 C60 300 80 290 100 300",
    "M370 110 C350 130 340 140 320 132",
  ],
  "calm-desk": [
    "M40 300 H360",
    "M120 300 L136 206 H262 L278 300",
    "M150 226 H248 V280 H150 Z",
    "M300 300 V262 H336 V300",
    "M336 272 C350 272 350 290 336 290",
    "M310 250 C306 238 318 230 312 218",
    "M326 250 C322 238 334 230 328 218",
    "M70 300 L78 262 H104 L112 300",
    "M91 262 C88 230 70 214 60 206 M91 262 C96 228 116 212 128 206 M91 250 C90 226 92 204 94 190",
  ],
  "habit-plant": [
    "M150 360 L162 280 H238 L250 360 Z",
    "M200 280 C200 240 198 210 200 170",
    "M200 220 C172 216 150 198 146 176 C170 176 192 190 200 212",
    "M200 196 C226 188 246 166 248 146 C222 148 204 166 200 188",
    "M300 90 C290 104 290 118 300 124 C310 118 310 104 300 90",
    "M330 130 C322 142 322 152 330 158 C338 152 338 142 330 130",
  ],
  "goal-path": [
    "M40 300 H360",
    "M150 390 L196 300",
    "M250 390 L204 300",
    "M200 380 V370 M200 350 V338 M200 322 V314",
    "M200 250 m-40 0 a40 40 0 0 1 80 0",
    "M200 196 V176 M150 210 L138 196 M250 210 L262 196 M120 250 H100 M280 250 H300",
  ],
  "focus-hourglass": [
    "M140 90 H260 M140 330 H260",
    "M150 90 C150 170 196 186 196 210 C196 234 150 250 150 330",
    "M250 90 C250 170 204 186 204 210 C204 234 250 250 250 330",
    "M170 150 C186 170 214 170 230 150",
    "M166 318 C180 290 220 290 234 318",
    "M200 214 V290",
  ],
  "rituals-sun": [
    "M40 280 H360",
    "M200 280 m-70 0 a70 70 0 0 1 140 0",
    "M200 180 V150 M120 212 L100 192 M280 212 L300 192 M96 280 H66 M304 280 H334",
    "M150 340 H250 L240 380 H160 Z",
    "M250 350 C270 350 270 370 250 370",
    "M186 330 C182 318 194 312 190 300 M210 330 C206 318 218 312 214 300",
  ],
};

export const Illustration: React.FC<{
  name: IllustrationName;
  /** 0 → 1 reveal progress. */
  draw: number;
  size: number;
  style?: React.CSSProperties;
}> = ({ name, draw, size, style }) => {
  const file = `illustrations/${name}.png`;
  if (hasFile(file)) {
    return (
      <div style={{ width: size, height: size, ...style }}>
        <Img
          src={staticFile(file)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            mixBlendMode: "multiply",
            clipPath: `inset(${(1 - draw) * 100}% 0 0 0)`,
            scale: String(1.04 - draw * 0.04),
          }}
        />
      </div>
    );
  }
  const paths = DOODLES[name];
  return (
    <svg width={size} height={size} viewBox="0 0 400 400" style={style}>
      {paths.map((d, i) => {
        const span = 1 / paths.length;
        const local = Math.min(1, Math.max(0, (draw - i * span * 0.6) / (span * 1.6)));
        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={INK}
            strokeWidth={name === "tangled-thread" ? 3.2 : 5}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - local}
          />
        );
      })}
    </svg>
  );
};

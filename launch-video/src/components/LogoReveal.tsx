import React from "react";
import { interpolateColors } from "remotion";
import { LOCKUP_LETTERS, LOCKUP_MARK, LOCKUP_VIEWBOX } from "../brand/logo.generated";
import { EASE, clamp } from "../brand/motion";
import { Category, colour, radius, shadow } from "../brand/tokens";
import { Glyph } from "./Glyph";
import { Aura } from "./ZenMark";

/**
 * The logo reveal. Eight app tiles lift off their row onto a turning ring,
 * spiral inward with motion trails, pair up into the mark's four lobes and
 * fuse into the Zenboard mark as the spin settles. Pink sweeps out from the
 * centre with a ripple, a spark burst and the aura; then the real wordmark
 * letters slide out from behind the mark.
 *
 * `frame` is local. Geometry is in screen px.
 */

export const REVEAL = {
  lift: [16, 70] as [number, number],
  spin: [36, 222] as [number, number],
  spiral: [96, 200] as [number, number],
  pair: [126, 200] as [number, number],
  ink: [140, 196] as [number, number],
  fuse: [194, 212] as [number, number],
  pink: [204, 234] as [number, number],
  burst: [204, 262] as [number, number],
  slide: [236, 286] as [number, number],
  letters: 246,
  sheen: [300, 344] as [number, number],
  /** Total turn of the ring in degrees; a multiple of 90 so the mark lands upright. */
  turn: 540,
};

const APPS: Category[] = ["tasks", "calendar", "projects", "money", "docs", "clients", "notes", "life"];
const TILE = 120;
const RING = 330;

export type RevealGeometry = {
  /** Where the tiles sit at frame 0 (e.g. the S08 row), one rect per app. */
  row: { x: number; y: number }[];
  /** Centre of the spin, where the mark forms. */
  spin: { x: number; y: number };
  /** Mark size in the final lockup, px. */
  markSize: number;
  /** Top-left of the full lockup (mark + wordmark) once settled. */
  lockup: { x: number; y: number };
};

const turnAt = (f: number) => REVEAL.turn * clamp(f, REVEAL.spin, [0, 1], EASE.breathe);

/** Position, size and style of tile i at frame f. */
const tileAt = (f: number, i: number, g: RevealGeometry) => {
  const unit = g.markSize / 32;
  const lobeDist = Math.SQRT2 * 8.5 * unit;
  const lobeR = 7.6 * unit;
  const theta = turnAt(f);
  const ringAngle = i * 45 + theta;
  const lobeAngle = 45 + 90 * Math.floor(i / 2) + theta;
  const pair = clamp(f, REVEAL.pair, [0, 1], EASE.settle);
  const angle = ((ringAngle + (lobeAngle - ringAngle) * pair) * Math.PI) / 180;
  const r = RING + (lobeDist - RING) * clamp(f, REVEAL.spiral, [0, 1], EASE.breathe);
  const ringX = g.spin.x + Math.cos(angle) * r;
  const ringY = g.spin.y + Math.sin(angle) * r;
  const lift = clamp(f, [REVEAL.lift[0] + i * 3, REVEAL.lift[1] + i * 3], [0, 1], EASE.settle);
  const row = g.row[i];
  const x = row.x + (ringX - row.x) * lift;
  const y = row.y + (ringY - row.y) * lift;
  const shrink = clamp(f, [REVEAL.spiral[0] + 24, REVEAL.pair[1]], [0, 1], EASE.settle);
  const size = TILE + (lobeR * 2 - TILE) * shrink;
  return { x, y, size, corner: radius.window + (lobeR - radius.window) * shrink };
};

export const LogoReveal: React.FC<{ frame: number; geometry: RevealGeometry; tagline?: React.ReactNode }> = ({ frame, geometry: g, tagline }) => {
  const f = frame;
  const unit = g.markSize / 32;
  const ink = clamp(f, REVEAL.ink, [0, 1], EASE.settle);
  const fuse = clamp(f, REVEAL.fuse, [0, 1], EASE.settle);
  const pink = clamp(f, REVEAL.pink, [0, 1], EASE.settle);
  const slide = clamp(f, REVEAL.slide, [0, 1], EASE.settle);
  const land = 0.94 + 0.06 * clamp(f, [REVEAL.fuse[0], REVEAL.pink[1]], [0, 1], EASE.settle);
  const markSpin = turnAt(f) - REVEAL.turn; // the last of the turn, carried by the fused mark

  const markCentreFinal = { x: g.lockup.x + g.markSize / 2, y: g.lockup.y + g.markSize / 2 };
  const mx = g.spin.x + (markCentreFinal.x - g.spin.x) * slide;
  const my = g.spin.y + (markCentreFinal.y - g.spin.y) * slide;
  const lockupW = LOCKUP_VIEWBOX.w * unit;

  // Angular speed drives the motion trails: only visible while the ring is really moving.
  const speed = Math.abs(turnAt(f) - turnAt(f - 2));
  const trail = clamp(speed, [2, 8], [0, 1]);

  const tile = (fr: number, i: number, ghost = 0) => {
    const t = tileAt(fr, i, g);
    return (
      <div
        key={`${i}-${ghost}`}
        style={{
          position: "absolute",
          left: t.x - t.size / 2,
          top: t.y - t.size / 2,
          width: t.size,
          height: t.size,
          borderRadius: t.corner,
          background: interpolateColors(ink, [0, 1], [colour.card, colour.ink]),
          boxShadow: ghost ? "none" : shadow,
          opacity: (1 - fuse) * (ghost ? (ghost === 1 ? 0.22 : 0.1) * trail : 1),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {!ghost ? (
          <div style={{ opacity: 1 - clamp(f, [REVEAL.ink[0], REVEAL.ink[0] + 30], [0, 1], EASE.settle), scale: String(t.size / TILE) }}>
            <Glyph category={APPS[i]} size={64} />
          </div>
        ) : null}
      </div>
    );
  };

  const sheen = clamp(f, REVEAL.sheen, [0, 114], EASE.breathe);
  const burst = clamp(f, REVEAL.burst, [0, 1], EASE.settle);
  const burstFade = 1 - clamp(f, [REVEAL.burst[0] + 20, REVEAL.burst[1]], [0, 1], EASE.settle);

  return (
    <>
      {/* Aura blooms as the pink arrives, then breathes. */}
      <div
        style={{
          position: "absolute",
          left: mx - 460,
          top: my - 460,
          width: 920,
          height: 920,
          opacity: clamp(f, [REVEAL.pink[0], REVEAL.pink[0] + 50], [0, 1], EASE.breathe),
          scale: String(0.9 + 0.1 * clamp(f, [REVEAL.pink[0], REVEAL.burst[1]], [0, 1], EASE.settle) + Math.sin(f / 24) * 0.015),
        }}
      >
        <Aura size={920} />
      </div>

      {/* The ring of tiles: trails first, then the tiles on top. */}
      {fuse < 1 ? APPS.map((_, i) => [tile(f - 4, i, 2), tile(f - 2, i, 1)]) : null}
      {fuse < 1 ? APPS.map((_, i) => tile(f, i)) : null}

      {/* Ripple rings from the moment the mark forms. */}
      {[0, 10].map((d) => {
        const p = clamp(f, [REVEAL.pink[0] + d, REVEAL.pink[0] + d + 54], [0, 1], EASE.settle);
        return (
          <div
            key={d}
            style={{
              position: "absolute",
              left: mx - g.markSize / 2,
              top: my - g.markSize / 2,
              width: g.markSize,
              height: g.markSize,
              borderRadius: radius.pill,
              border: `2px solid ${colour.pink}`,
              opacity: p > 0 ? (1 - p) * 0.55 : 0,
              scale: String(1 + p * 2.4),
            }}
          />
        );
      })}

      {/* Spark burst: a few soft dots flung outward and fading. */}
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2 + 0.3;
        const dist = (g.markSize * 0.6 + 120 * (0.6 + ((i * 37) % 10) / 25)) * burst;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: mx + Math.cos(a) * dist - 4,
              top: my + Math.sin(a) * dist - 4,
              width: i % 3 === 0 ? 10 : 6,
              height: i % 3 === 0 ? 10 : 6,
              borderRadius: radius.pill,
              background: i % 4 === 0 ? colour.ink : colour.pink,
              opacity: burst > 0 ? burstFade * 0.8 : 0,
            }}
          />
        );
      })}

      {/* The mark: ink as it fuses, then pink sweeps out from the centre. */}
      <svg
        width={g.markSize}
        height={g.markSize}
        viewBox="0 0 32 32"
        style={{
          position: "absolute",
          left: mx - g.markSize / 2,
          top: my - g.markSize / 2,
          opacity: fuse,
          scale: String(land),
          rotate: `${markSpin}deg`,
          overflow: "visible",
        }}
      >
        <path d={LOCKUP_MARK} fill={colour.ink} />
        <path d={LOCKUP_MARK} fill={colour.pink} style={{ clipPath: `circle(${pink * 75}% at 50% 50%)` }} />
      </svg>

      {/* The real wordmark, revealed letter by letter from behind the mark. */}
      <svg
        width={lockupW}
        height={g.markSize}
        viewBox={`0 0 ${LOCKUP_VIEWBOX.w} ${LOCKUP_VIEWBOX.h}`}
        style={{
          position: "absolute",
          left: g.lockup.x,
          top: g.lockup.y,
          overflow: "visible",
          clipPath: `inset(-20% -10% -20% ${(34 / LOCKUP_VIEWBOX.w) * 100}%)`,
        }}
      >
        {LOCKUP_LETTERS.map((d, i) => {
          const t = clamp(f, [REVEAL.letters + i * 3, REVEAL.letters + i * 3 + 34], [0, 1], EASE.settle);
          return (
            <path
              key={i}
              d={d}
              fill={colour.ink}
              style={{
                opacity: clamp(t, [0, 0.5], [0, 1]),
                translate: `${(1 - t) * -14}px 0px`,
                filter: `blur(${(1 - t) * 1.2}px)`,
              }}
            />
          );
        })}
        {/* One soft pink light sweep across the settled wordmark. */}
        <g
          style={{
            clipPath: `inset(0 ${Math.max(0, 100 - sheen)}% 0 ${Math.max(0, sheen - 14)}%)`,
            opacity: f > REVEAL.sheen[0] && f < REVEAL.sheen[1] ? 0.55 : 0,
          }}
        >
          {LOCKUP_LETTERS.map((d, i) => (
            <path key={i} d={d} fill={colour.pink} />
          ))}
        </g>
      </svg>
      {tagline}
    </>
  );
};


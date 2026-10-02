import React, { useMemo } from "react";
import { random } from "remotion";
import { GLYPHS, GlyphName } from "../brand/glyphs.generated";
import { LOCKUP_MARK } from "../brand/logo.generated";
import { colour, energy } from "../brand/tokens";
import { POP } from "../brand/motion";
import { CURVE } from "../brand/physics";

/**
 * Mosaic morph (user reference: tile-mosaic icons). A shape (the Zenboard mark
 * or a product icon) is sampled onto a grid; every filled cell becomes a tile
 * in Zenboard's pinks, and some tiles are tiny Zenboard marks. Between shapes
 * each tile travels on a slight arc to its place in the next shape, in a wave
 * from the centre, so one shape visibly becomes the next.
 *
 * Sampling uses Path2D on a canvas in the render browser: deterministic, and
 * it draws the exact product glyphs and the real mark.
 */
export type MosaicShape = { kind: "mark" } | { kind: "glyph"; name: GlyphName };
type Cell = { x: number; y: number; cov: number };

const G = 30; // grid resolution

const sample = (shape: MosaicShape): Cell[] => {
  const S = 208;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d")!;
  const vb = shape.kind === "mark" ? 32 : 256;
  const pad = shape.kind === "mark" ? 0.04 : 0.06;
  ctx.setTransform((S * (1 - 2 * pad)) / vb, 0, 0, (S * (1 - 2 * pad)) / vb, S * pad, S * pad);
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  if (shape.kind === "mark") ctx.fill(new Path2D(LOCKUP_MARK), "evenodd");
  else {
    // Line weight, thickened, so each icon keeps its inner detail (grid, rows, lines) on the tile grid.
    ctx.lineWidth = 7;
    ctx.lineJoin = "round";
    for (const d of GLYPHS[shape.name].regular) {
      ctx.fill(new Path2D(d), "evenodd");
      ctx.stroke(new Path2D(d));
    }
  }
  const px = ctx.getImageData(0, 0, S, S).data;
  const cs = S / G;
  const cells: Cell[] = [];
  for (let gy = 0; gy < G; gy++)
    for (let gx = 0; gx < G; gx++) {
      let on = 0;
      for (let sy = 0; sy < 4; sy++)
        for (let sx = 0; sx < 4; sx++) {
          const x = Math.floor(gx * cs + (sx + 0.5) * (cs / 4));
          const y = Math.floor(gy * cs + (sy + 0.5) * (cs / 4));
          if (px[(y * S + x) * 4 + 3] > 128) on++;
        }
      if (on / 16 > 0.3) cells.push({ x: gx, y: gy, cov: on / 16 });
    }
  // Order by angle around the centre, then radius, so neighbouring tiles pair with neighbours.
  const m = (G - 1) / 2;
  return cells.sort((a, b) => Math.atan2(a.y - m, a.x - m) - Math.atan2(b.y - m, b.x - m) || Math.hypot(a.x - m, a.y - m) - Math.hypot(b.x - m, b.y - m));
};

const SHADES = [colour.blush, energy.rose, "#E07AAB", colour.pink, "#9E1459"];

const MiniMark: React.FC<{ size: number; fill: string; outline?: boolean }> = ({ size, fill, outline }) => (
  <svg width={size} height={size} viewBox="-2 -2 36 36" style={{ display: "block" }}>
    <path d={LOCKUP_MARK} fill={outline ? "none" : fill} stroke={outline ? fill : "none"} strokeWidth={outline ? 5 : 0} />
  </svg>
);

export const Mosaic: React.FC<{
  frame: number;
  shapes: MosaicShape[];
  /** Frame at which each morph starts: morph i goes from shapes[i] to shapes[i + 1]. */
  morphAt: number[];
  dur?: number;
  size: number;
  /** 0..1: tiles resolve into the solid mark (last shape must be the mark). */
  resolve?: number;
}> = ({ frame, shapes, morphAt, dur = 42, size, resolve = 0 }) => {
  const cells = useMemo(() => shapes.map(sample), [shapes]);
  const N = Math.max(...cells.map((c) => c.length));
  const cs = size / G;
  // Which morph are we in (or holding after)?
  let seg = 0;
  while (seg < morphAt.length && frame >= morphAt[seg] + dur) seg++;
  const inMorph = seg < morphAt.length && frame >= morphAt[seg];
  const A = cells[seg];
  const B = cells[Math.min(seg + 1, cells.length - 1)];
  const t0 = inMorph ? morphAt[seg] : 0;
  const m = (G - 1) / 2;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {Array.from({ length: N }, (_, k) => {
        const a = A[k % A.length];
        const b = B[k % B.length];
        const existsA = k < A.length;
        const existsB = k < B.length;
        // Wave: tiles near the centre leave first.
        const delay = (Math.hypot(a.x - m, a.y - m) / (G * 0.7)) * dur * 0.4;
        const p = inMorph ? CURVE.glide(Math.min(1, Math.max(0, (frame - t0 - delay) / (dur * 0.6)))) : 0;
        const x = a.x + (b.x - a.x) * p;
        const y = a.y + (b.y - a.y) * p;
        // A slight arc perpendicular to travel, so the swarm swirls rather than slides.
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const arc = Math.sin(Math.PI * p) * 0.18;
        const ax = x - dy * arc;
        const ay = y + dx * arc;
        const vis = (existsA ? 1 - p : 0) + (existsB ? p : 0);
        const shade = SHADES[Math.floor(random(`mz-${k}-c`) * SHADES.length)];
        const isMark = random(`mz-${k}-m`) < 0.14;
        // A few accent marks sit larger than the grid, like the reference mosaics.
        const accent = isMark && random(`mz-${k}-a`) < 0.35 ? 1.7 : 1;
        const cov = a.cov + (b.cov - a.cov) * p;
        const base = (0.55 + 0.4 * random(`mz-${k}-s`)) * (0.6 + 0.4 * cov);
        const pop = inMorph ? 1 + 0.35 * Math.sin(Math.PI * p) : 1;
        const s = cs * base * pop * accent * Math.min(1, vis) * (1 - resolve);
        if (s < 0.5) return null;
        return (
          <div key={k} style={{ position: "absolute", left: (ax + 0.5) * cs - s / 2, top: (ay + 0.5) * cs - s / 2, width: s, height: s }}>
            {isMark ? <MiniMark size={s * 1.25} fill={shade === colour.blush ? colour.pink : shade} outline={random(`mz-${k}-o`) < 0.6} /> : <div style={{ width: "100%", height: "100%", background: shade, borderRadius: s * 0.12 }} />}
          </div>
        );
      })}
      {/* Satellites: tiny tiles scattered just off the shape's edge, drifting with it. */}
      {Array.from({ length: 36 }, (_, j) => {
        const cellA = A[Math.floor(random(`sat-${j}`) * A.length)];
        const cellB = B[Math.floor(random(`sat-${j}`) * B.length)];
        const p = inMorph ? CURVE.glide(Math.min(1, Math.max(0, (frame - t0) / dur))) : 0;
        const cx = cellA.x + (cellB.x - cellA.x) * p;
        const cy = cellA.y + (cellB.y - cellA.y) * p;
        const ang = random(`sat-a-${j}`) * Math.PI * 2;
        const r = 1.2 + random(`sat-r-${j}`) * 1.8;
        const s = cs * (0.18 + random(`sat-s-${j}`) * 0.22) * (1 - resolve);
        return (
          <div
            key={`s${j}`}
            style={{
              position: "absolute",
              left: (cx + 0.5 + Math.cos(ang) * r) * cs - s / 2,
              top: (cy + 0.5 + Math.sin(ang) * r) * cs - s / 2,
              width: s,
              height: s,
              borderRadius: s * 0.15,
              background: SHADES[j % 3],
              opacity: 0.55,
            }}
          />
        );
      })}
      {resolve > 0 ? (
        <div style={{ position: "absolute", inset: 0, opacity: resolve, transform: `scale(${0.9 + 0.1 * POP(resolve)})` }}>
          <MiniMark size={size} fill={colour.pink} />
        </div>
      ) : null}
    </div>
  );
};

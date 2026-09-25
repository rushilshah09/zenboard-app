import React from "react";
import { useCurrentFrame } from "remotion";
import { FONT } from "../brand/fonts";
import { colour } from "../brand/tokens";
import { CURVE } from "../brand/physics";
import { Mosaic, MosaicShape } from "../ui/Mosaic";
import { Stage } from "../ui/Stage";

/**
 * Technique test · mosaic morph (user reference). The Zenboard mark, built of
 * tiles, becomes each part of the product (calendar, tasks, invoices, clients)
 * and returns to the mark, which resolves solid. The label swaps as each shape
 * lands. ~7.7s at 60fps.
 */
const SHAPES: MosaicShape[] = [
  { kind: "mark" },
  { kind: "glyph", name: "calendar-dots" },
  { kind: "glyph", name: "list-checks" },
  { kind: "glyph", name: "receipt" },
  { kind: "glyph", name: "users" },
  { kind: "mark" },
];
const LABELS = ["Zenboard", "Calendar", "Tasks", "Invoices", "Clients", "Zenboard"];
export const MORPH_AT = [50, 120, 190, 260, 330];
const DUR = 44;
export const MOSAIC_FRAMES = 470;

export const MosaicMorph: React.FC = () => {
  const f = useCurrentFrame();
  const resolve = CURVE.settle(Math.min(1, Math.max(0, (f - (MORPH_AT[4] + DUR + 6)) / 30)));
  // The label changes as each shape lands (mid-morph), fading through a short blur.
  let idx = 0;
  MORPH_AT.forEach((t, i) => {
    if (f >= t + DUR * 0.55) idx = i + 1;
  });
  const near = Math.min(...MORPH_AT.map((t) => Math.abs(f - (t + DUR * 0.55))));
  const swap = Math.max(0, 1 - near / 10);
  const intro = CURVE.settle(Math.min(1, f / 30));
  return (
    <Stage kind="ivory">
      <div style={{ position: "absolute", left: 960 - 330, top: 470 - 330, opacity: intro, transform: `scale(${0.94 + 0.06 * intro})` }}>
        <Mosaic frame={f} shapes={SHAPES} morphAt={MORPH_AT} dur={DUR} size={660} resolve={resolve} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 860, textAlign: "center", fontFamily: FONT, fontWeight: 600, fontSize: 64, letterSpacing: "-0.04em", color: colour.ink, opacity: (1 - swap * 0.9) * intro, filter: `blur(${swap * 6}px)` }}>
        {LABELS[idx]}
      </div>
    </Stage>
  );
};

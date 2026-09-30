import React from "react";
import { useCurrentFrame } from "remotion";
import { FONT } from "../../brand/fonts";
import { EASE, clamp } from "../../brand/motion";
import { CURVE } from "../../brand/physics";
import { colour } from "../../brand/tokens";
import { Mosaic, MosaicShape } from "../../ui/Mosaic";
import { Stage } from "../../ui/Stage";

/**
 * Scene 6 · The Flow (0:54–1:01). Working in Zenboard is fast: the mark, built
 * of tiles, becomes each thing you do and snaps back. One word per morph, on
 * the beat: Plan. (calendar) Write. (doc) Bill. (invoice) Done. (tasks), and
 * the mark again, resolving solid.
 */
export const FLOW_FRAMES = 420;
const SHAPES: MosaicShape[] = [
  { kind: "mark" },
  { kind: "glyph", name: "calendar-dots" },
  { kind: "glyph", name: "file-text" },
  { kind: "glyph", name: "receipt" },
  { kind: "glyph", name: "list-checks" },
  { kind: "mark" },
];
const WORDS = ["", "Plan.", "Write.", "Bill.", "Done.", ""];
// Each morph lands on a beat (30 frames at 120 BPM).
const MORPH_AT = [36, 96, 156, 216, 276];
const DUR = 40;

export const Flow: React.FC = () => {
  const f = useCurrentFrame();
  const resolve = CURVE.settle(clamp(f, [MORPH_AT[4] + DUR + 4, MORPH_AT[4] + DUR + 34], [0, 1]));
  const intro = clamp(f, [0, 30], [0, 1], EASE.settle);
  const land = (i: number) => MORPH_AT[i - 1] + DUR * 0.6;
  return (
    <Stage kind="ivory">
      <div style={{ position: "absolute", left: 960 - 310, top: 430 - 310, opacity: intro, transform: `scale(${0.94 + 0.06 * intro})` }}>
        <Mosaic frame={f} shapes={SHAPES} morphAt={MORPH_AT} dur={DUR} size={620} resolve={resolve} />
      </div>
      {WORDS.map((w, i) => {
        if (!w) return null;
        const inn = clamp(f, [land(i) - 6, land(i) + 10], [0, 1], EASE.settle);
        const out = i < 4 ? clamp(f, [land(i + 1) - 10, land(i + 1) - 2], [0, 1]) : clamp(f, [MORPH_AT[4] + DUR, MORPH_AT[4] + DUR + 16], [0, 1]);
        return (
          <div key={w} style={{ position: "absolute", left: 0, right: 0, top: 800, textAlign: "center", fontFamily: FONT, fontWeight: 600, fontSize: 150, letterSpacing: "-0.05em", lineHeight: 1, color: colour.ink, opacity: inn * (1 - out), transform: `translateY(${(1 - inn) * 60 - out * 30}px)`, filter: `blur(${(1 - inn) * 10 + out * 8}px)` }}>
            {w}
          </div>
        );
      })}
    </Stage>
  );
};

import React from "react";
import { useCurrentFrame } from "remotion";
import { FONT } from "../../brand/fonts";
import { EASE, clamp } from "../../brand/motion";
import { CURVE } from "../../brand/physics";
import { energy, stage } from "../../brand/tokens";
import { LABEL, Label } from "../../ui/app/kit";
import { Stage } from "../../ui/Stage";
import { rnd } from "../shared3";

/**
 * Scene 7 · The One (1:01–1:05.5), into the outro. The callback: a word wall
 * again, but calm. Module names in their label colours glide slowly on Ivory,
 * then every row slides together into one row, the row into one point of pink
 * light, and the point opens into the construction sheet.
 */
export const ONE_FRAMES = 270;
const MODULES: [string, Label][] = [
  ["Tasks", "berry"],
  ["Projects", "slate"],
  ["Docs", "indigo"],
  ["Notes", "ochre"],
  ["Calendar", "plum"],
  ["Money", "moss"],
  ["Clients", "rust"],
  ["Habits", "teal"],
  ["Goals", "clay"],
];

export const One: React.FC = () => {
  const f = useCurrentFrame();
  const rows = 9;
  const converge = clamp(f, [110, 185], [0, 1], CURVE.glide);
  const squeeze = clamp(f, [170, 214], [0, 1], CURVE.glide);
  const point = clamp(f, [196, 214], [0, 1], EASE.settle);
  const open = clamp(f, [222, 268], [0, 1], CURVE.glide);
  return (
    <Stage kind="ivory">
      {Array.from({ length: rows }, (_, r) => {
        const off = r - (rows - 1) / 2;
        const y = 540 + off * 112 * (1 - converge);
        const dir = r % 2 ? 1 : -1;
        const x = rnd(`one-${r}`, -900, -300) + dir * f * 1.0;
        const centre = off === 0;
        return (
          <div
            key={r}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: `translateY(-50%) scaleX(${1 - squeeze * 0.98})`,
              transformOrigin: `${960 - x}px 50%`,
              whiteSpace: "nowrap",
              fontFamily: FONT,
              fontWeight: 600,
              fontSize: 88,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              opacity: (centre ? 1 : Math.max(0.14, 0.72 - Math.abs(off) * 0.14) * (1 - converge)) * (1 - point),
              maskImage: "linear-gradient(90deg, transparent 0%, black 16%, black 84%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(90deg, transparent 0%, black 16%, black 84%, transparent 100%)",
              width: 3400,
            }}
          >
            {Array.from({ length: 20 }, (_, i) => {
              const [name, c] = MODULES[(i + r * 4) % MODULES.length];
              return (
                <span key={i} style={{ color: LABEL[c].dot, marginRight: 60 }}>
                  {name}
                </span>
              );
            })}
          </div>
        );
      })}
      {/* The one point of light. */}
      <div style={{ position: "absolute", left: 960 - 170, top: 540 - 170, width: 340, height: 340, borderRadius: "50%", opacity: squeeze * (1 - open), background: `radial-gradient(closest-side, #fff, ${energy.rose} 25%, rgba(196,28,114,.35) 50%, transparent)`, transform: `scale(${0.4 + 0.6 * point})` }} />
      <div style={{ position: "absolute", left: 950, top: 530, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: `0 0 24px 8px ${energy.pink}`, opacity: point * (1 - open) }} />
      {/* The point opens: Ink pours out from it, rimmed with pink light. */}
      <div style={{ position: "absolute", left: 960, top: 540, width: 0, height: 0 }}>
        <div style={{ position: "absolute", left: -1200, top: -1200, width: 2400, height: 2400, borderRadius: "50%", background: stage.ink, transform: `scale(${Math.max(0.001, open)})`, boxShadow: `0 0 80px 20px rgba(196,28,114,${0.6 * (1 - open)})` }} />
      </div>
    </Stage>
  );
};

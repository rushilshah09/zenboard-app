import React from "react";
import { FONT } from "../brand/fonts";
import { CATEGORY, Category, energy } from "../brand/tokens";
import { Stage } from "../ui/Stage";
import { rnd } from "./shared3";

/**
 * Scene 7 · The One (0:54–1:04). Signature: a calm module wall that collapses
 * into the logo. Styleframe: beat 7b. The rows of module names, each in its
 * category colour, slide together toward one row, and a point of pink light
 * begins to glow where they meet.
 */
const MODULES: { name: string; category: Category }[] = [
  { name: "Tasks", category: "tasks" },
  { name: "Projects", category: "projects" },
  { name: "Docs", category: "docs" },
  { name: "Notes", category: "notes" },
  { name: "Calendar", category: "calendar" },
  { name: "Money", category: "money" },
  { name: "Clients", category: "clients" },
  { name: "Life", category: "life" },
];

export const S7Styleframe: React.FC = () => {
  const rows = 7;
  const converge = 0.12; // how far the rows have slid together
  return (
    <Stage kind="ivory">
      {Array.from({ length: rows }, (_, r) => {
        const off = r - (rows - 1) / 2;
        const y = 540 + off * 112 * (1 - converge);
        const shift = rnd(`row-${r}`, 0, 600) * (r % 2 ? 1 : -1);
        const centre = Math.abs(off) < 0.5;
        return (
          <div
            key={r}
            style={{
              position: "absolute",
              left: -400 + shift,
              top: y,
              transform: "translateY(-50%)",
              whiteSpace: "nowrap",
              fontFamily: FONT,
              fontWeight: 600,
              fontSize: 88,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              opacity: centre ? 1 : Math.max(0.12, 0.7 - Math.abs(off) * 0.14),
              filter: centre ? undefined : `blur(${Math.abs(off) * 0.8}px)`,
              maskImage: "linear-gradient(90deg, transparent 0%, black 18%, black 82%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(90deg, transparent 0%, black 18%, black 82%, transparent 100%)",
              width: 2800,
            }}
          >
            {Array.from({ length: 16 }, (_, i) => {
              const m = MODULES[(i + r * 3) % MODULES.length];
              return (
                <span key={i} style={{ color: CATEGORY[m.category].dominant, marginRight: 56 }}>
                  {m.name}
                </span>
              );
            })}
          </div>
        );
      })}
      {/* The point where everything meets: one pink light. */}
      <div style={{ position: "absolute", left: 960 - 160, top: 540 - 160, width: 320, height: 320, borderRadius: "50%", background: `radial-gradient(closest-side, #fff, ${energy.rose} 25%, rgba(196,28,114,.35) 50%, transparent)` }} />
      <div style={{ position: "absolute", left: 960 - 10, top: 540 - 10, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: `0 0 20px 6px ${energy.pink}` }} />
    </Stage>
  );
};

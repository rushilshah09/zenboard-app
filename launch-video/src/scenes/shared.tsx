import React from "react";
import { AbsoluteFill } from "remotion";
import { DebugScope } from "../components/DebugZones";
import { FONT } from "../brand/fonts";
import { FRAME, Rect, ZONES, col, span } from "../brand/layout";
import { EASE, clamp } from "../brand/motion";
import { Category, colour } from "../brand/tokens";
import { SceneId, beat, frames, sceneStart } from "../brand/timeline";

/** Every scene sits on the same Paper (§2 rule 1). */
export const Scene: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: colour.paper, fontFamily: FONT, overflow: "hidden" }}>
    <DebugScope>{children}</DebugScope>
  </AbsoluteFill>
);

/** The eight apps of acts 2–3, in grid (row-major) order. */
export const APPS: { category: Category; label: string; short: string }[] = [
  { category: "tasks", label: "Tasks", short: "Tasks" },
  { category: "projects", label: "Projects", short: "Projects" },
  { category: "docs", label: "Docs", short: "Docs" },
  { category: "notes", label: "Notes", short: "Notes" },
  { category: "calendar", label: "Calendar", short: "Calendar" },
  { category: "money", label: "Invoices", short: "Invoices" },
  { category: "clients", label: "Clients", short: "Clients" },
  { category: "life", label: "Personal planner", short: "Planner" },
];

/** S03 4 × 2 grid: 376 × 340 windows, 32px gutters, centred vertically. */
const GW = (span(12) - 3 * 32) / 4;
const GH = 340;
const GY = (FRAME.h - (GH * 2 + 32)) / 2;
export const gridSlot = (i: number): Rect => ({ x: col(1) + (i % 4) * (GW + 32), y: GY + Math.floor(i / 4) * (GH + 32), w: GW, h: GH });

/** S04 tile row and S05 tab strip share x positions. */
const TW = (span(12) - 7 * 32) / 8;
export const TILE_SCALE = TW / GW;
/**
 * Where grid window i lands in the tile row. Interleaved (top row → even,
 * bottom row → odd slots) so every window rises straight up beside its
 * partner and no path crosses another object.
 */
export const tileSlot = (i: number) => (i < 4 ? i * 2 : (i - 4) * 2 + 1);
export const tileRect = (i: number): Rect => ({ x: col(1) + i * (TW + 32), y: 128, w: TW, h: Math.round(GH * TILE_SCALE) });
export const tabRect = (i: number): Rect => ({ x: col(1) + i * (TW + 32), y: ZONES.strip.y, w: TW, h: ZONES.strip.h });
export const pillRect = (i: number): Rect => {
  const t = tileRect(i);
  return { x: t.x + (t.w - 104) / 2, y: t.y + t.h + 24, w: 104, h: 40 };
};

/** Acts 3's big window (right seven columns, under the tab strip) and ⌘-Tab pill. */
export const BIG: Rect = { x: col(7), y: 248, w: span(6), h: 632 };
export const KEYCAP: Rect = { x: 960 - 96, y: 944, w: 192, h: 48 };
export const HEADLINE_LEFT: Rect = { x: col(1), y: 480, w: span(6), h: 176 };

/**
 * The switching schedule of act 3, as scene-local frames. Also yields the
 * running "Switches today" count, which carries across S05 → S07.
 */
export const STOP_S07 = 200;
export const switchesIn = (id: "S05" | "S06" | "S07"): number[] => {
  if (id === "S05") {
    const out = [beat(1), beat(2), beat(3), beat(4)];
    for (let t = beat(4.5); t < frames("S05"); t += beat(0.5)) out.push(t);
    return out;
  }
  if (id === "S06") {
    const out: number[] = [];
    for (let t = 0; t < frames("S06"); t += beat(0.25)) out.push(t);
    return out;
  }
  const out: number[] = [];
  let t = 0;
  let gap = 8;
  while (t < STOP_S07) {
    out.push(Math.round(t));
    t += gap;
    gap = Math.max(2, gap * 0.92);
  }
  return out;
};
const COUNT0 = 212;
export const switchCount = (id: "S05" | "S06" | "S07", frame: number) => {
  const before = id === "S05" ? 0 : id === "S06" ? switchesIn("S05").length : switchesIn("S05").length + switchesIn("S06").length;
  return COUNT0 + before + switchesIn(id).filter((s) => s <= frame).length;
};

/** Frame of this scene expressed in another scene's local time (for carried elements). */
export const localTo = (from: SceneId, to: SceneId, frame: number) => sceneStart(from) + frame - sceneStart(to);

/** Camera drift 1.00 → 1.04 over a global range, on Breathe (§4). */
export const drift = (globalFrame: number, range: [number, number], from = 1, to = 1.04) =>
  clamp(globalFrame, range, [from, to], EASE.breathe);

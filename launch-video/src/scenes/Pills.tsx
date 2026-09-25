import React from "react";
import { FONT } from "../brand/fonts";
import { GlyphName } from "../brand/glyphs.generated";
import { CATEGORY, colour, energy } from "../brand/tokens";
import { Icon } from "../components/Glyph";
import { Stage } from "../ui/Stage";
import { rnd } from "./shared3";

/**
 * Direction A · the pill wall (user reference: flowing tag pills). Every pill
 * is a Zenboard feature, with its product icon, in the brand palette: deep
 * burgundy, Zenboard pink, blush and the category pairings. Rows flow in
 * alternating directions. Styleframe: one frame of the flow.
 */
type Pill = { label: string; icon: GlyphName; bg: string; fg: string };

const INK = { bg: colour.ink, fg: colour.paper };
const PINK = { bg: colour.pink, fg: "#FFFFFF" };
const BLUSH = { bg: colour.blush, fg: colour.ink };
const cat = (c: keyof typeof CATEGORY, dark = false) => ({ bg: dark ? CATEGORY[c].dominant : CATEGORY[c].accent, fg: dark ? "#FFFFFF" : colour.ink });

export const PILLS: Pill[] = [
  { label: "Tasks", icon: "list-checks", ...cat("tasks") },
  { label: "Projects", icon: "kanban", ...INK },
  { label: "Calendar", icon: "calendar-blank", ...PINK },
  { label: "Docs", icon: "file-text", ...cat("docs", true) },
  { label: "Invoices", icon: "receipt", ...cat("money") },
  { label: "Clients", icon: "users", ...cat("clients", true) },
  { label: "Habits", icon: "flame", ...BLUSH },
  { label: "Goals", icon: "target", ...INK },
  { label: "Notes", icon: "notepad", ...cat("notes", true) },
  { label: "Focus", icon: "timer", ...cat("life") },
  { label: "Time tracking", icon: "clock", ...cat("projects", true) },
  { label: "Payments", icon: "credit-card", ...PINK },
  { label: "Life", icon: "sun-horizon", ...cat("life", true) },
  { label: "Messages", icon: "chat-circle", ...cat("tasks", true) },
  { label: "Files", icon: "folder", ...BLUSH },
  { label: "Insights", icon: "chart-line-up", ...INK },
  { label: "Reminders", icon: "bell", ...cat("docs") },
  { label: "Automations", icon: "lightning", ...cat("clients") },
  { label: "Recurring", icon: "repeat", ...cat("projects") },
  { label: "Proposals", icon: "paper-plane-tilt", ...INK },
];

const H = 112;
export const PillChip: React.FC<{ p: Pill; h?: number; style?: React.CSSProperties }> = ({ p, h = H, style }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: h * 0.18,
      height: h,
      padding: `0 ${h * 0.46}px 0 ${h * 0.34}px`,
      borderRadius: h / 2,
      background: p.bg,
      color: p.fg,
      fontFamily: FONT,
      fontWeight: 600,
      fontSize: h * 0.44,
      letterSpacing: "-0.02em",
      whiteSpace: "nowrap",
      flexShrink: 0,
      ...style,
    }}
  >
    <Icon name={p.icon} size={h * 0.42} tint={p.fg} fill />
    {p.label}
  </div>
);

export const PillsStyleframe: React.FC = () => {
  const rows = 9;
  return (
    <Stage kind="ivory">
      {Array.from({ length: rows }, (_, r) => {
        const y = 540 + (r - (rows - 1) / 2) * (H + 18);
        const shift = rnd(`pill-row-${r}`, -900, -100) + (r % 2 ? 180 : -60);
        // Each row is its own seeded shuffle of the features, so no two rows repeat.
        const order = [...PILLS].sort((a, b) => rnd(`${r}-${a.label}`) - rnd(`${r}-${b.label}`));
        return (
          <div key={r} style={{ position: "absolute", left: shift, top: y - H / 2, display: "flex", gap: 18 }}>
            {Array.from({ length: 12 }, (_, i) => {
              const p = order[i % order.length];
              return <PillChip key={i} p={p} />;
            })}
          </div>
        );
      })}
      {/* A soft energy light under the centre keeps the wall from reading flat. */}
      <div style={{ position: "absolute", left: 960 - 700, top: 540 - 300, width: 1400, height: 600, borderRadius: "50%", background: `radial-gradient(closest-side, ${energy.rose}33, transparent)`, mixBlendMode: "multiply", pointerEvents: "none" }} />
    </Stage>
  );
};

import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { color, ease, font, light, radius, shadow, tween } from "../theme";

/** Scene 1 — the problem: a working day scattered across a dozen tools. */

type Chip = {
  x: number;
  y: number;
  w: number;
  label: string;
  meta: string;
  tint: string;
  at: number;
  rot: number;
};

const CHIPS: Chip[] = [
  { x: 150, y: 130, w: 300, label: "Tasks", meta: "47 open · 12 overdue", tint: color.labelRust, at: 4, rot: -4 },
  { x: 1440, y: 170, w: 320, label: "Calendar", meta: "Thu · 6 events", tint: color.info500, at: 10, rot: 3 },
  { x: 260, y: 720, w: 340, label: "Notes — untitled (4)", meta: "edited 3 days ago", tint: color.labelOchre, at: 36, rot: 5 },
  { x: 1320, y: 700, w: 330, label: "Invoice_final_v3.pdf", meta: "Draft · unsent", tint: color.labelMoss, at: 66, rot: -3 },
  { x: 720, y: 90, w: 280, label: "Inbox", meta: "38 unread", tint: color.berry500, at: 44, rot: -2 },
  { x: 90, y: 440, w: 260, label: "Timer", meta: "02:14:09 running", tint: color.labelStone, at: 72, rot: 2 },
  { x: 1560, y: 450, w: 280, label: "Spreadsheet", meta: "Q3 clients.xlsx", tint: color.labelMoss, at: 80, rot: -5 },
  { x: 800, y: 860, w: 320, label: "Client thread", meta: "Re: Re: Fwd: scope?", tint: color.info500, at: 50, rot: 3 },
  { x: 1030, y: 250, w: 250, label: "Habits", meta: "streak lost", tint: color.labelOchre, at: 86, rot: 6 },
  { x: 560, y: 300, w: 240, label: "Goals.doc", meta: "last opened May", tint: color.labelStone, at: 90, rot: -6 },
];

const PHRASES = [
  { text: "Tasks in one app.", from: 4, to: 36 },
  { text: "Notes in another.", from: 36, to: 66 },
  { text: "Invoices somewhere else.", from: 66, to: 100 },
  { text: "Your day, in pieces.", from: 100, to: 999 },
];

const ToolChip: React.FC<{ chip: Chip; frame: number }> = ({ chip, frame }) => {
  const appear = tween(frame, [chip.at, chip.at + 14], [0, 1], ease.spring);
  const scatter = tween(frame, [118, 150], [0, 1], ease.in);
  const cx = chip.x + chip.w / 2 - 960;
  const cy = chip.y + 50 - 540;
  const drift = Math.sin((frame + chip.at * 7) / 40) * 6;
  return (
    <div
      style={{
        position: "absolute",
        left: chip.x,
        top: chip.y,
        width: chip.w,
        opacity: appear * (1 - scatter),
        scale: String(0.6 + appear * 0.4),
        rotate: `${chip.rot * (1 + scatter * 3)}deg`,
        translate: `${cx * scatter * 0.9}px ${cy * scatter * 0.9 + drift}px`,
        background: "#FFFFFF",
        borderRadius: radius.lg,
        boxShadow: shadow.float,
        border: `1px solid ${light.faint}`,
        padding: 16,
        fontFamily: font.sans,
      }}
    >
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: radius.pill, background: light.faint }} />
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: radius.xs, background: chip.tint }} />
        <div style={{ fontSize: 20, fontWeight: 600, color: light.text, letterSpacing: "-0.01em" }}>{chip.label}</div>
      </div>
      <div style={{ fontSize: 16, color: light.muted, marginTop: 4, fontFamily: font.mono }}>{chip.meta}</div>
    </div>
  );
};

export const Scatter: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: light.bg }}>
      {CHIPS.map((c) => (
        <ToolChip key={c.label} chip={c} frame={frame} />
      ))}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        {PHRASES.map((p) => {
          const inT = tween(frame, [p.from, p.from + 10], [0, 1]);
          const outT = tween(frame, [p.to - 6, p.to], [0, 1], ease.in);
          const last = p.to === 999;
          return (
            <div
              key={p.text}
              style={{
                position: "absolute",
                fontFamily: font.sans,
                fontWeight: 600,
                fontSize: last ? 120 : 104,
                letterSpacing: "-0.035em",
                color: light.text,
                opacity: inT * (1 - outT),
                translate: `0 ${(1 - inT) * 28 - outT * 20}px`,
                filter: `blur(${(1 - inT) * 8}px)`,
                padding: "8px 28px",
                background: `rgba(242, 241, 235, ${0.85 * inT})`,
                borderRadius: radius.xl,
              }}
            >
              {p.text}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

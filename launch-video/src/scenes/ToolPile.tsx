import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Sfx } from "../components/Sfx";
import { ToolKind, ToolWindow } from "../components/ToolWindow";
import { ease, font, light, radius, shake, tween } from "../theme";

/** 03 · One app per job. The windows pile up until a sticky note tops it off. */

type Drop = { kind: ToolKind; x: number; y: number; rot: number; at: number; w?: number; from?: "left" | "right" | "top" };

const DROPS: Drop[] = [
  { kind: "tasks", x: 520, y: 470, rot: -4, at: 10 },
  { kind: "notes", x: 1380, y: 420, rot: 3, at: 50 },
  { kind: "invoice", x: 1580, y: 820, rot: -6, at: 96, from: "right" },
  { kind: "calendar", x: 820, y: 700, rot: 5, at: 134 },
  { kind: "clients", x: 1160, y: 640, rot: -3, at: 164 },
  { kind: "email", x: 330, y: 820, rot: 4, at: 186, from: "left" },
  { kind: "sheet", x: 1520, y: 190, rot: -5, at: 194, from: "top" },
  { kind: "timer", x: 380, y: 200, rot: 6, at: 202, from: "top" },
  { kind: "sticky", x: 980, y: 520, rot: -7, at: 224, w: 380 },
];

const CAPTIONS = [
  { text: "Tasks live in one app.", from: 6, to: 46 },
  { text: "Notes, in another.", from: 46, to: 86 },
  { text: "Invoices… somewhere else.", from: 86, to: 128 },
  { text: "Your calendar.", from: 128, to: 158 },
  { text: "Your clients.", from: 158, to: 214 },
  { text: "That one sticky note.", from: 214, to: 999 },
];

export const ToolPile: React.FC = () => {
  const frame = useCurrentFrame();
  const push = tween(frame, [0, 270], [1, 1.12], (x) => x);
  return (
    <AbsoluteFill style={{ background: light.bg, overflow: "hidden" }}>
      <AbsoluteFill style={{ scale: String(push), translate: shake(frame, 226, 14) }}>
        {DROPS.map((d, i) => {
          const land = tween(frame, [d.at, d.at + 12], [0, 1], ease.out);
          const fromX = d.from === "left" ? -900 : d.from === "right" ? 900 : 0;
          const fromY = d.from === "top" ? -700 : 0;
          const lift = 1 - land;
          return (
            <div
              key={d.kind}
              style={{
                position: "absolute",
                left: d.x,
                top: d.y,
                translate: `calc(-50% + ${fromX * lift}px) calc(-50% + ${fromY * lift}px)`,
                rotate: `${d.rot + lift * 8}deg`,
                scale: String(d.from ? 1 : 1.25 - land * 0.25),
                opacity: tween(frame, [d.at, d.at + 4], [0, 1]),
                zIndex: i,
                filter: `drop-shadow(0 ${lift * 40}px ${lift * 40}px rgba(18,18,18,0.18))`,
              }}
            >
              <ToolWindow kind={d.kind} width={d.w ?? 360} />
            </div>
          );
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 90 }}>
        {CAPTIONS.map((c) => {
          const inT = tween(frame, [c.from, c.from + 8], [0, 1]);
          const outT = tween(frame, [c.to - 5, c.to], [0, 1], ease.in);
          return (
            <div
              key={c.text}
              style={{
                position: "absolute",
                bottom: 80,
                padding: "18px 40px",
                borderRadius: radius.pill,
                background: light.text,
                color: light.bg,
                fontFamily: font.sans,
                fontSize: 60,
                fontWeight: 600,
                letterSpacing: "-0.03em",
                opacity: inT * (1 - outT),
                translate: `0 ${(1 - inT) * 30}px`,
                scale: String(0.9 + inT * 0.1),
                zIndex: 50,
              }}
            >
              {c.text}
            </div>
          );
        })}
      </AbsoluteFill>
      {DROPS.map((d) => (
        <Sfx key={d.kind} at={d.at + 8} sound={d.kind === "sticky" ? "thud" : "pop"} volume={d.kind === "sticky" ? 0.55 : 0.3} />
      ))}
      <Sfx at={88} sound="swipe" volume={0.3} />
    </AbsoluteFill>
  );
};

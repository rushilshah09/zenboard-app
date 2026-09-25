import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Headline } from "../components/Headline";
import { Illustration, IllustrationName, groundOf } from "../components/Illustration";
import { Sfx } from "../components/Sfx";
import { color, ease, font, ground, light, radius, shadow, tween } from "../theme";

/** 13 · Room for the rest of life: an editorial wall of illustrated cards. */

type LifeCard = { art: IllustrationName; kind: string; title: string; meta: string };

const CARDS: LifeCard[] = [
  { art: "habit-plant", kind: "Habit", title: "Water the plants", meta: "Daily · 8:00" },
  { art: "goal-path", kind: "Goal", title: "Take August off", meta: "Horizon · 2026" },
  { art: "focus-bubble", kind: "Focus", title: "Deep work, 90 min", meta: "Today · 9:00" },
  { art: "morning-ritual", kind: "Ritual", title: "Morning review", meta: "Weekdays · 7:30" },
  { art: "week-plan", kind: "Week", title: "Plan next week", meta: "Friday · 16:00" },
  { art: "client-portal", kind: "Clients", title: "Acme kickoff", meta: "Mon · 10:00" },
];

const COLS = 5;
const ROWS = 3;
const CW = 380;
const CH = 500;
const GAP = 36;

const WORDS = [
  { text: "Habits.", at: 96 },
  { text: "Goals.", at: 126 },
  { text: "Focus.", at: 156 },
];

export const Life: React.FC = () => {
  const frame = useCurrentFrame();
  const pan = tween(frame, [0, 210], [0, 1], (x) => x);
  const gridW = COLS * CW + (COLS - 1) * GAP;
  return (
    <AbsoluteFill style={{ background: ground.cream, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: (1920 - gridW) / 2,
          top: -220,
          translate: `${-pan * 120}px ${-pan * 260}px`,
        }}
      >
        {Array.from({ length: COLS * ROWS }, (_, i) => {
          const c = i % COLS;
          const r = Math.floor(i / COLS);
          const card = CARDS[(i * 2 + r) % CARDS.length];
          const at = 2 + (c + r) * 4;
          const inT = tween(frame, [at, at + 18], [0, 1], ease.spring);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: c * (CW + GAP),
                top: r * (CH + GAP) + (c % 2 ? CH / 2 : 0),
                width: CW,
                height: CH,
                borderRadius: radius.xl * 1.5,
                overflow: "hidden",
                background: light.surface,
                boxShadow: shadow.float,
                opacity: inT,
                scale: String(0.85 + inT * 0.15),
              }}
            >
              <div style={{ height: CH * 0.6, background: groundOf(card.art), display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Illustration name={card.art} draw={tween(frame, [at + 6, at + 70], [0, 1], (x) => x)} size={260} />
              </div>
              <div style={{ padding: 26, fontFamily: font.sans }}>
                <div style={{ fontSize: 18, color: light.text }}>{card.kind}</div>
                <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", color: light.text, marginTop: 10 }}>{card.title}</div>
                <div style={{ fontSize: 17, color: light.muted, marginTop: 14, fontFamily: font.mono }}>{card.meta}</div>
              </div>
            </div>
          );
        })}
      </div>

      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, rgba(242,241,235,0.92) 0%, rgba(242,241,235,0.6) 34%, transparent 60%)` }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", top: 380, width: 1500 }}>
          <Headline text="Room for the rest of *your life.*" at={6} size={100} tint={light.text} out={86} />
        </div>
        {WORDS.map((w, i) => {
          const inT = tween(frame, [w.at, w.at + 10], [0, 1], ease.spring);
          const outT = i < WORDS.length - 1 ? tween(frame, [WORDS[i + 1].at - 2, WORDS[i + 1].at + 6], [0, 1], ease.in) : 0;
          return (
            <div
              key={w.text}
              style={{
                position: "absolute",
                padding: "20px 56px",
                borderRadius: radius.pill,
                background: color.paper,
                color: color.ink900,
                fontFamily: font.serif,
                fontStyle: "italic",
                fontSize: 120,
                letterSpacing: "-0.02em",
                opacity: inT * (1 - outT),
                scale: String(0.7 + inT * 0.3 - outT * 0.1),
                translate: `0 ${-outT * 40}px`,
                boxShadow: shadow.float,
              }}
            >
              {w.text}
            </div>
          );
        })}
      </AbsoluteFill>
      {WORDS.map((w) => (
        <Sfx key={w.text} at={w.at} sound="pop" volume={0.4} />
      ))}
    </AbsoluteFill>
  );
};

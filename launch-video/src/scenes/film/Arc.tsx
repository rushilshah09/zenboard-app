import React from "react";
import { useCurrentFrame } from "remotion";
import { FONT } from "../../brand/fonts";
import { GlyphName } from "../../brand/glyphs.generated";
import { EASE, clamp } from "../../brand/motion";
import { CURVE } from "../../brand/physics";
import { colour, stage } from "../../brand/tokens";
import { Icon } from "../../components/Glyph";
import { voAt } from "../../timeline/film";
import { ClientCard, DocCard, EventCard, GoalCard, HabitCard, InvoiceCard, NoteCard, TaskCard } from "../../ui/app/Cards";
import { Lockup } from "../../ui/Lockup";
import { Stage } from "../../ui/Stage";

/**
 * The feature arc (added in review; user wireframe + Calendly reference).
 * Zenboard sits at top centre. Below it, the features ride a large dial: the
 * active one is big and dark at the top of the arc, its neighbours grey as
 * they fall away along it. Across the bottom half, the real product object
 * for each feature rides a second arc and comes forward as its name lands.
 * The dial steps on each spoken word: Tasks, Calendar, Docs, Clients, Money.
 */
export const ARC_FRAMES = 360;

const ITEMS: { name: string; icon: GlyphName; card: React.FC }[] = [
  { name: "Habits", icon: "flame", card: HabitCard },
  { name: "Goals", icon: "target", card: GoalCard },
  { name: "Tasks", icon: "list-checks", card: TaskCard },
  { name: "Calendar", icon: "calendar-dots", card: EventCard },
  { name: "Docs", icon: "file-text", card: DocCard },
  { name: "Clients", icon: "users", card: ClientCard },
  { name: "Money", icon: "receipt", card: InvoiceCard },
  { name: "Notes", icon: "notepad", card: NoteCard },
  { name: "Focus", icon: "timer", card: NoteCard },
];
const FIRST = 2;
const STEPS = ["arc-calendar", "arc-docs", "arc-clients", "arc-money"];

const DIAL = { x: 960, y: 1560, r: 1210, step: 15 };
const CARDS = { x: 960, y: 2260, r: 1580, step: 24 };

export const Arc: React.FC = () => {
  const f = useCurrentFrame();
  // The dial position: one step per spoken word, each a short glide.
  const pos = FIRST + STEPS.reduce((acc, id) => acc + clamp(f, [voAt(id, "arc") - 8, voAt(id, "arc") + 16], [0, 1], CURVE.glide), 0);
  const intro = clamp(f, [0, 40], [0, 1], EASE.settle);
  const outro = clamp(f, [330, 360], [0, 1], EASE.settle);
  return (
    <Stage kind="ivory">
      <div style={{ position: "absolute", left: 0, right: 0, top: 84, display: "flex", justifyContent: "center", opacity: intro, translate: `0 ${(1 - intro) * -14}px` }}>
        <Lockup h={54} ink={colour.ink} mark={colour.pink} />
      </div>
      {/* The dial's hairline track. */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: 0.8 * intro }}>
        <circle cx={DIAL.x} cy={DIAL.y} r={DIAL.r + 70} fill="none" stroke="rgba(40,4,23,.08)" strokeWidth={1.5} />
        <circle cx={DIAL.x} cy={DIAL.y} r={DIAL.r - 64} fill="none" stroke="rgba(40,4,23,.05)" strokeWidth={1} strokeDasharray="2 8" />
        <circle cx={DIAL.x} cy={DIAL.y - DIAL.r - 70} r={5} fill={colour.pink} />
      </svg>
      {ITEMS.map((it, i) => {
        const d = i - pos;
        const a = ((-90 + d * DIAL.step) * Math.PI) / 180;
        const x = DIAL.x + Math.cos(a) * DIAL.r;
        const y = DIAL.y + Math.sin(a) * DIAL.r;
        const on = Math.max(0, 1 - Math.abs(d));
        const size = 44 + 36 * on;
        const o = Math.max(0, 1 - Math.abs(d) * 0.28) * intro;
        const col = on > 0.5 ? colour.ink : "rgba(40,4,23,.34)";
        return (
          <div key={it.name} style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) rotate(${d * DIAL.step}deg)`, display: "flex", alignItems: "center", gap: size * 0.25, opacity: o, whiteSpace: "nowrap", fontFamily: FONT, fontWeight: 600, fontSize: size, letterSpacing: "-0.04em", color: col }}>
            <Icon name={it.icon} size={size * 0.8} tint={on > 0.5 ? colour.pink : "rgba(40,4,23,.3)"} fill={on > 0.5} />
            {it.name}
          </div>
        );
      })}
      {/* The product, riding the lower arc; the active object comes forward. */}
      {ITEMS.map((it, i) => {
        const d = i - pos;
        if (Math.abs(d) > 2.2) return null;
        const a = ((-90 + d * CARDS.step) * Math.PI) / 180;
        const x = CARDS.x + Math.cos(a) * CARDS.r;
        const y = CARDS.y + Math.sin(a) * CARDS.r;
        const on = Math.max(0, 1 - Math.abs(d));
        const C = it.card;
        const enter = clamp(f, [10 + Math.abs(d) * 6, 50 + Math.abs(d) * 6], [0, 1], EASE.settle);
        return (
          <div
            key={it.name}
            style={{
              position: "absolute",
              left: x,
              top: y,
              zIndex: Math.round(10 - Math.abs(d) * 3),
              transform: `translate(-50%, -30%) rotate(${d * CARDS.step * 0.6}deg) scale(${(0.95 + 0.45 * on) * (0.94 + 0.06 * enter)})`,
              opacity: enter * (1 - outro) * Math.max(0, 1 - Math.abs(d) * 0.38),
              filter: `blur(${(1 - on) * 2.5}px)`,
              translate: `0 ${(1 - enter) * 60 + outro * 80}px`,
            }}
          >
            <div style={{ borderRadius: 16, boxShadow: `0 ${10 + 20 * on}px ${40 + 40 * on}px rgba(40,4,23,${0.18 + 0.14 * on})` }}>
              <C />
            </div>
          </div>
        );
      })}
      {/* Into the graph: the stage dims to Ink through the last half beat. */}
      <div style={{ position: "absolute", inset: 0, background: stage.ink, opacity: outro }} />
    </Stage>
  );
};

import React from "react";
import { FONT, MONO } from "../brand/fonts";
import { CATEGORY, Category, colour, panelEdge, shadow, type } from "../brand/tokens";
import { Glyph } from "../components/Glyph";
import { Stage } from "../ui/Stage";
import { Workspace, WS } from "../ui/Workspace";

/**
 * Scene 5 · The Orbit (0:40–0:48). Signature: three tilted orbit rings around
 * the workspace, named after the tagline. Styleframe: beat 5b on "Business."
 * All three rings are lit in their category colours.
 */
type Card = { category: Category; title: string; detail: string };
type Ring = { name: string; rx: number; ry: number; rot: number; colour: string; cards: (Card & { a: number })[] };

const RINGS: Ring[] = [
  {
    name: "Work",
    rx: 560,
    ry: 175,
    rot: -6,
    colour: CATEGORY.tasks.dominant,
    cards: [
      { category: "tasks", title: "Tasks", detail: "11 today", a: 200 },
      { category: "projects", title: "Projects", detail: "Acme — Rebrand", a: 340 },
      { category: "docs", title: "Docs", detail: "Rebrand proposal", a: 20 },
      { category: "notes", title: "Notes", detail: "Call notes — Mara", a: 150 },
    ],
  },
  {
    name: "Life",
    rx: 750,
    ry: 240,
    rot: 5,
    colour: CATEGORY.life.dominant,
    cards: [
      { category: "life", title: "Habits", detail: "Walk · 12-day streak", a: 160 },
      { category: "tasks", title: "Focus", detail: "Deep work · 90 min", a: 60 },
      { category: "calendar", title: "Life calendar", detail: "Dinner with Sam · Fri", a: 290 },
      { category: "life", title: "A day off", detail: "Saturday", a: 225 },
    ],
  },
  {
    name: "Business",
    rx: 900,
    ry: 305,
    rot: -2,
    colour: CATEGORY.clients.dominant,
    cards: [
      { category: "clients", title: "Clients", detail: "Acme Studio · active", a: 110 },
      { category: "money", title: "Money", detail: "$1,875.00 paid", a: 35 },
      { category: "money", title: "Invoices", detail: "INV-1042", a: 320 },
      { category: "tasks", title: "Time", detail: "12.5h this week", a: 250 },
    ],
  },
];
const C = { x: 960, y: 610 };

const ModuleCard: React.FC<Card & { back: boolean }> = ({ category, title, detail, back }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "12px 18px 12px 12px",
      borderRadius: 14,
      background: colour.card,
      boxShadow: `${panelEdge}, ${shadow}`,
      fontFamily: FONT,
      whiteSpace: "nowrap",
      filter: back ? "blur(2.5px)" : undefined,
      opacity: back ? 0.75 : 1,
    }}
  >
    <Glyph category={category} size={40} colourProgress={1} />
    <div>
      <div style={{ ...type.uiStrong, fontSize: 18, color: colour.ink }}>{title}</div>
      <div style={{ fontFamily: MONO, fontSize: 13, color: colour.stone }}>{detail}</div>
    </div>
  </div>
);

const onRing = (r: Ring, deg: number) => {
  const a = (deg * Math.PI) / 180;
  const x = Math.cos(a) * r.rx;
  const y = Math.sin(a) * r.ry;
  const t = (r.rot * Math.PI) / 180;
  return { x: C.x + x * Math.cos(t) - y * Math.sin(t), y: C.y + x * Math.sin(t) + y * Math.cos(t), back: Math.sin(a) < 0 };
};

const Rings: React.FC<{ half: "back" | "front" }> = ({ half }) => (
  <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
    {RINGS.map((r) => (
      <ellipse
        key={r.name}
        cx={C.x}
        cy={C.y}
        rx={r.rx}
        ry={r.ry}
        transform={`rotate(${r.rot} ${C.x} ${C.y})`}
        fill="none"
        stroke={r.colour}
        strokeWidth={2}
        opacity={0.8}
        // Draw only the back or the front half so the workspace sits between them. The stroke starts at
        // the rightmost point and runs clockwise, so its first half is the lower (front) half.
        pathLength={2}
        strokeDasharray="1 1"
        strokeDashoffset={half === "front" ? 0 : 1}
        style={{ filter: `drop-shadow(0 0 6px ${r.colour})` }}
      />
    ))}
  </svg>
);

export const S5Styleframe: React.FC = () => {
  const k = 0.44;
  const cards = RINGS.flatMap((r) => r.cards.map((c) => ({ ...c, ...onRing(r, c.a) })));
  return (
    <Stage kind="ivory">
      {/* The energy light behind the workspace. */}
      <div style={{ position: "absolute", left: C.x - 700, top: C.y - 420, width: 1400, height: 840, borderRadius: "50%", background: "radial-gradient(closest-side, rgba(196,28,114,.28), rgba(232,168,197,.26) 40%, rgba(232,184,138,.14) 65%, transparent)", filter: "blur(30px)" }} />
      <Rings half="back" />
      {cards.filter((c) => c.back).map((c) => (
        <div key={c.title + c.detail} style={{ position: "absolute", left: c.x, top: c.y, transform: "translate(-50%, -50%) scale(.9)" }}>
          <ModuleCard {...c} back />
        </div>
      ))}
      <div style={{ position: "absolute", left: C.x - (WS.w * k) / 2, top: C.y - (WS.h * k) / 2, width: WS.w * k, height: WS.h * k, borderRadius: 12, boxShadow: `0 -1.5px 0 ${colour.pink}, 0 30px 70px rgba(40,4,23,.22), 0 0 60px rgba(196,28,114,.25)` }}>
        <div style={{ transform: `scale(${k})`, transformOrigin: "0 0" }}>
          <Workspace />
        </div>
      </div>
      <Rings half="front" />
      {cards.filter((c) => !c.back).map((c) => (
        <div key={c.title + c.detail} style={{ position: "absolute", left: c.x, top: c.y, transform: "translate(-50%, -50%)" }}>
          <ModuleCard {...c} back={false} />
        </div>
      ))}
      <div style={{ position: "absolute", left: 0, right: 0, top: 64, textAlign: "center", fontFamily: FONT, fontWeight: 600, fontSize: 96, letterSpacing: "-0.04em", lineHeight: 1 }}>
        <span style={{ color: CATEGORY.tasks.dominant }}>Work.</span> <span style={{ color: CATEGORY.life.dominant }}>Life.</span> <span style={{ color: colour.ink }}>Business.</span>
      </div>
    </Stage>
  );
};

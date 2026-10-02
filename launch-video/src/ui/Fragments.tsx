import React from "react";
import { FONT, MONO } from "../brand/fonts";
import { CATEGORY, Category, colour, energy, panelEdge, radius, shadow, space, type } from "../brand/tokens";
import { DOCS, EVENTS, INVOICES, MESSAGES, NOTES, PEOPLE, RECEIPTS, TASKS, money } from "../data/acme";
import { Glyph, Icon } from "../components/Glyph";

/**
 * Real fragments of a business (DIRECTION_V3.md §4, scene 1): each is a piece
 * of genuine Zenboard-style UI filled from the Acme dataset. They are lit as
 * objects: on the Ink stage they get an energy-gradient rim on the edge facing
 * the light; on Ivory they carry the three-layer burgundy shadow.
 */

export type Light = "ink" | "ivory";

export const Panel: React.FC<{ w: number; h?: number; light: Light; rim?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ w, h, light, rim = 1, style, children }) => (
  <div
    style={{
      position: "relative",
      width: w,
      height: h,
      borderRadius: radius.card + 4,
      background: light === "ink" ? colour.paper : colour.card,
      boxShadow: light === "ink" ? `inset 0 1px 0 rgba(255,255,255,.8), 0 24px 60px rgba(8, 0, 4, 0.55), 0 0 40px rgba(196, 28, 114, ${0.18 * rim})` : `${panelEdge}, ${shadow}`,
      fontFamily: FONT,
      color: colour.ink,
      padding: space.s2,
      overflow: "hidden",
      ...style,
    }}
  >
    {children}
    {light === "ink" ? (
      // Rim light: a 1.5px energy-gradient edge, strongest on the top-left (the side facing the light).
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          padding: 1.5,
          background: `linear-gradient(135deg, ${energy.pink}, ${energy.rose} 35%, transparent 60%)`,
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          opacity: rim,
          pointerEvents: "none",
        }}
      />
    ) : null}
  </div>
);

const Mono: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <span style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 0, color: colour.stone, ...style }}>{children}</span>
);
const Badge: React.FC<{ n: number }> = ({ n }) => (
  <div style={{ position: "absolute", right: 10, top: 10, minWidth: 22, height: 22, borderRadius: 11, background: energy.pink, color: "#fff", fontFamily: MONO, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px", boxShadow: `0 0 14px ${energy.pink}` }}>
    {n}
  </div>
);
const Check: React.FC<{ done?: boolean }> = ({ done }) => (
  <div style={{ width: 18, height: 18, borderRadius: 9, border: `2px solid ${done ? colour.pink : colour.stone}`, background: done ? colour.pink : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
    {done ? <Icon name="check" size={12} tint="#fff" /> : null}
  </div>
);
const Chip: React.FC<{ c: string; children: React.ReactNode }> = ({ c, children }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 10px", borderRadius: radius.pill, background: "rgba(40,4,23,.06)", ...type.caption, fontSize: 13 }}>
    <span style={{ width: 8, height: 8, borderRadius: 4, background: c }} />
    {children}
  </span>
);

export const TaskFrag: React.FC<{ i: number; light: Light; badge?: number }> = ({ i, light, badge }) => {
  const t = TASKS[i % TASKS.length];
  return (
    <Panel w={340} light={light}>
      <div style={{ display: "flex", alignItems: "center", gap: space.s1 + 4 }}>
        <Check done={t.done} />
        <div style={{ ...type.ui, fontSize: 19, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.t}</div>
        {t.due ? <Mono>{t.due}</Mono> : null}
      </div>
      <div style={{ marginTop: 8, marginLeft: 30 }}>
        <Chip c={CATEGORY[t.category].dominant}>{t.project}</Chip>
      </div>
      {badge ? <Badge n={badge} /> : null}
    </Panel>
  );
};

export const InvoiceFrag: React.FC<{ i: number; light: Light; badge?: number }> = ({ i, light, badge }) => {
  const v = INVOICES[i % INVOICES.length];
  const tone = v.status === "Paid" ? colour.pink : v.status === "Overdue" ? "#B4412F" : colour.stone;
  return (
    <Panel w={300} light={light}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Glyph category="money" size={30} colourProgress={1} />
        <div>
          <div style={{ ...type.uiStrong, fontSize: 18 }}>{v.client}</div>
          <Mono style={{ fontSize: 13 }}>{v.id}</Mono>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 14 }}>
        <span style={{ fontFamily: MONO, fontSize: 26, fontWeight: 500 }}>{money(v.amount)}</span>
        <span style={{ ...type.caption, fontSize: 13, color: tone }}>{v.status}</span>
      </div>
      {badge ? <Badge n={badge} /> : null}
    </Panel>
  );
};

export const EventFrag: React.FC<{ i: number; light: Light; badge?: number }> = ({ i, light, badge }) => {
  const e = EVENTS[i % EVENTS.length];
  const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
  return (
    <Panel w={280} light={light} style={{ padding: 0 }}>
      <div style={{ padding: `${space.s2}px ${space.s2}px ${space.s2}px ${space.s2 + 6}px`, borderLeft: `6px solid ${CATEGORY[e.category].dominant}`, background: CATEGORY[e.category].accent + "55" }}>
        <Mono style={{ fontSize: 13 }}>
          Thu · {hm(e.start)} – {hm(e.end)}
        </Mono>
        <div style={{ ...type.uiStrong, fontSize: 19, marginTop: 4 }}>{e.title}</div>
      </div>
      {badge ? <Badge n={badge} /> : null}
    </Panel>
  );
};

export const MessageFrag: React.FC<{ i: number; light: Light; badge?: number }> = ({ i, light, badge }) => {
  const m = MESSAGES[i % MESSAGES.length];
  const initials = m.from.split(" ").map((w) => w[0]).join("");
  return (
    <Panel w={330} light={light}>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 17, background: colour.blush, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 13, flexShrink: 0 }}>{initials}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span style={{ ...type.uiStrong, fontSize: 16 }}>{m.from}</span>
            <Mono style={{ fontSize: 12 }}>{m.time}</Mono>
          </div>
          <div style={{ ...type.ui, fontSize: 17, lineHeight: "23px", marginTop: 2 }}>{m.text}</div>
        </div>
      </div>
      {badge ? <Badge n={badge} /> : null}
    </Panel>
  );
};

export const NoteFrag: React.FC<{ i: number; light: Light }> = ({ i, light }) => {
  const n = NOTES[i % NOTES.length];
  return (
    <Panel w={250} light={light} style={{ background: light === "ink" ? "#FBF3E4" : "#FFFBF2" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Glyph category="notes" size={26} colourProgress={1} />
        <div style={{ ...type.uiStrong, fontSize: 16 }}>{n.title}</div>
      </div>
      {n.lines.map((l) => (
        <div key={l} style={{ ...type.ui, fontSize: 15, lineHeight: "22px", marginTop: 6, color: colour.stone }}>
          — {l}
        </div>
      ))}
    </Panel>
  );
};

export const ReceiptFrag: React.FC<{ i: number; light: Light }> = ({ i, light }) => {
  const r = RECEIPTS[i % RECEIPTS.length];
  return (
    <Panel w={200} light={light}>
      <Mono style={{ fontSize: 12 }}>RECEIPT · {r.date}</Mono>
      <div style={{ ...type.uiStrong, fontSize: 17, marginTop: 6 }}>{r.vendor}</div>
      <div style={{ borderTop: `1px dashed ${colour.hairline}`, marginTop: 10, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
        <Mono style={{ fontSize: 13 }}>Total</Mono>
        <span style={{ fontFamily: MONO, fontSize: 17, fontWeight: 500 }}>{money(r.amount)}</span>
      </div>
    </Panel>
  );
};

export const DocFrag: React.FC<{ i: number; light: Light }> = ({ i, light }) => {
  const d = DOCS[i % DOCS.length];
  const text = [
    "Phase two carries the new brand into the product:",
    "a type scale, a component kit and the pricing page.",
    "Timeline: two weeks, three reviews, one fixed fee.",
    "Deliverables are shared in the client portal.",
    "Next review: Thursday 10:00 with Mara.",
  ];
  return (
    <Panel w={320} h={210} light={light}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Glyph category="docs" size={26} colourProgress={1} />
        <Mono style={{ fontSize: 12 }}>Docs · {PEOPLE.mara.role.split(",")[1]?.trim() ?? "Acme"}</Mono>
      </div>
      <div style={{ ...type.uiStrong, fontSize: 20, marginTop: 10 }}>{d.title}</div>
      {text.slice(0, d.lines).map((l) => (
        <div key={l} style={{ ...type.ui, fontSize: 14, lineHeight: "20px", color: colour.stone }}>
          {l}
        </div>
      ))}
    </Panel>
  );
};

/** The swarm's vocabulary, in the order the words decode (Tasks, Projects, Invoices, Clients, Notes, Calendar, Docs). */
export const FRAGMENT_KINDS = ["task", "invoice", "event", "message", "note", "receipt", "doc"] as const;
export type FragmentKind = (typeof FRAGMENT_KINDS)[number];
export const Fragment: React.FC<{ kind: FragmentKind; i: number; light: Light; badge?: number }> = ({ kind, i, light, badge }) => {
  switch (kind) {
    case "task":
      return <TaskFrag i={i} light={light} badge={badge} />;
    case "invoice":
      return <InvoiceFrag i={i} light={light} badge={badge} />;
    case "event":
      return <EventFrag i={i} light={light} badge={badge} />;
    case "message":
      return <MessageFrag i={i} light={light} badge={badge} />;
    case "note":
      return <NoteFrag i={i} light={light} />;
    case "receipt":
      return <ReceiptFrag i={i} light={light} />;
    default:
      return <DocFrag i={i} light={light} />;
  }
};

export const categoryOf: Record<FragmentKind, Category> = { task: "tasks", invoice: "money", event: "calendar", message: "clients", note: "notes", receipt: "money", doc: "docs" };

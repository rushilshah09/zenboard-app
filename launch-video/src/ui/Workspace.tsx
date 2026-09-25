import React from "react";
import { FONT, MONO } from "../brand/fonts";
import { CATEGORY, Category, colour, space, type } from "../brand/tokens";
import { EVENTS, JOB, PEOPLE, TASKS, TODAY } from "../data/acme";
import { Glyph, Icon } from "../components/Glyph";
import { Lockup } from "./Lockup";

/**
 * The full Zenboard workspace at film fidelity (DIRECTION_V3.md §2 "real data
 * only"): sidebar with live counts, the Today list, and Thursday's calendar with
 * the Acme job on it. Sized 1600 × 900; scale it with a wrapper.
 */
export const WS = { w: 1600, h: 900, sidebar: 300 } as const;

const NAV: { label: string; category: Category; count?: number }[] = [
  { label: "Today", category: "tasks", count: 11 },
  { label: "Projects", category: "projects", count: 6 },
  { label: "Docs", category: "docs" },
  { label: "Notes", category: "notes" },
  { label: "Calendar", category: "calendar", count: 4 },
  { label: "Money", category: "money", count: 2 },
  { label: "Clients", category: "clients" },
  { label: "Life", category: "life" },
];

const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;

export const Workspace: React.FC<{ active?: number; style?: React.CSSProperties; checkedFirst?: boolean }> = ({ active = 0, style, checkedFirst = false }) => {
  const tasks = [{ t: JOB.title, project: "Acme Studio", category: "clients" as Category, due: "10:00" }, ...TASKS.slice(0, 9)];
  const H0 = 8 * 60;
  return (
    <div style={{ width: WS.w, height: WS.h, borderRadius: 22, background: colour.card, fontFamily: FONT, color: colour.ink, position: "relative", overflow: "hidden", ...style }}>
      {/* Sidebar */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: WS.sidebar, background: "#FBF7F1", borderRight: `1px solid ${colour.hairline}`, padding: `${space.s3}px ${space.s2}px` }}>
        <div style={{ padding: "4px 10px" }}>
          <Lockup h={26} />
        </div>
        <div style={{ margin: "20px 4px 14px", height: 38, borderRadius: 10, background: "rgba(40,4,23,.05)", display: "flex", alignItems: "center", gap: 8, padding: "0 12px" }}>
          <Icon name="command" size={16} tint={colour.stone} />
          <span style={{ ...type.ui, fontSize: 16, color: colour.stone, flex: 1 }}>Search</span>
          <span style={{ fontFamily: MONO, fontSize: 13, color: colour.stone }}>⌘K</span>
        </div>
        {NAV.map((n, i) => (
          <div key={n.label} style={{ display: "flex", alignItems: "center", gap: 12, height: 44, padding: "0 10px", borderRadius: 10, background: i === active ? colour.blush : "transparent", marginBottom: 2 }}>
            <Glyph category={n.category} size={28} colourProgress={1} />
            <span style={{ ...type.ui, fontSize: 18, flex: 1, fontWeight: i === active ? 500 : 400 }}>{n.label}</span>
            {n.count ? <span style={{ fontFamily: MONO, fontSize: 14, color: colour.stone }}>{n.count}</span> : null}
          </div>
        ))}
        <div style={{ ...type.caption, color: colour.stone, margin: "22px 10px 8px", letterSpacing: "0.06em" }}>CLIENTS</div>
        {["Acme Studio", "Lumen Co.", "Northwind"].map((c, i) => (
          <div key={c} style={{ display: "flex", alignItems: "center", gap: 10, height: 36, padding: "0 10px" }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: [CATEGORY.clients.dominant, CATEGORY.projects.dominant, CATEGORY.tasks.dominant][i] }} />
            <span style={{ ...type.ui, fontSize: 16 }}>{c}</span>
          </div>
        ))}
      </div>

      {/* Top bar */}
      <div style={{ position: "absolute", left: WS.sidebar, right: 0, top: 0, height: 72, borderBottom: `1px solid ${colour.hairline}`, display: "flex", alignItems: "center", padding: "0 32px", gap: 14 }}>
        <div style={{ ...type.uiStrong, fontSize: 24 }}>Today</div>
        <div style={{ ...type.ui, fontSize: 17, color: colour.stone }}>
          {TODAY.weekday}, {TODAY.date}
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: MONO, fontSize: 14, color: colour.stone }}>8 of 11 left</span>
        <div style={{ display: "flex" }}>
          {[PEOPLE.me, PEOPLE.mara, PEOPLE.theo].map((p, i) => (
            <div key={p.initials} style={{ width: 32, height: 32, borderRadius: 16, marginLeft: i ? -8 : 0, border: "2px solid #fff", background: [colour.blush, "#E8D8C5", "#C5DCE5"][i], fontFamily: MONO, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {p.initials}
            </div>
          ))}
        </div>
      </div>

      {/* Today list */}
      <div style={{ position: "absolute", left: WS.sidebar + 32, top: 96, width: 620 }}>
        {tasks.map((t, i) => {
          const done = (i === 0 && checkedFirst) || i === 3 || i === 6;
          return (
            <div key={t.t} style={{ display: "flex", alignItems: "center", gap: 14, height: 70, borderBottom: `1px solid ${colour.hairline}`, background: i === 0 ? "rgba(196,28,114,.05)" : "transparent", padding: "0 12px", borderRadius: i === 0 ? 10 : 0 }}>
              <div style={{ width: 22, height: 22, borderRadius: 11, border: `2px solid ${done ? colour.pink : colour.stone}`, background: done ? colour.pink : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {done ? <Icon name="check" size={14} tint="#fff" /> : null}
              </div>
              <span style={{ ...type.ui, fontSize: 19, flex: 1, color: done ? colour.stone : colour.ink, textDecoration: done ? "line-through" : "none", fontWeight: i === 0 ? 500 : 400 }}>{t.t}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, background: "rgba(40,4,23,.05)", fontSize: 14 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: CATEGORY[t.category].dominant }} />
                {t.project}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 14, color: colour.stone, width: 48, textAlign: "right" }}>{t.due ?? ""}</span>
            </div>
          );
        })}
      </div>

      {/* Thursday calendar */}
      <div style={{ position: "absolute", left: WS.sidebar + 700, right: 32, top: 96, bottom: 24 }}>
        <div style={{ ...type.caption, color: colour.stone, letterSpacing: "0.06em" }}>THURSDAY</div>
        {Array.from({ length: 11 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: 0, right: 0, top: 30 + i * 70, borderTop: `1px solid ${colour.hairline}` }}>
            <span style={{ fontFamily: MONO, fontSize: 13, color: colour.stone, position: "relative", top: 4 }}>{8 + i}:00</span>
          </div>
        ))}
        {[{ title: JOB.title, start: 10 * 60, end: 12 * 60, category: "clients" as Category, hero: true }, ...EVENTS.filter((e) => e.start !== 12 * 60).map((e) => ({ ...e, hero: false }))].map((e) => (
          <div
            key={e.title}
            style={{
              position: "absolute",
              left: 64,
              right: 0,
              top: 30 + ((e.start - H0) * 70) / 60 + 3,
              height: ((e.end - e.start) * 70) / 60 - 6,
              borderRadius: 10,
              background: e.hero ? colour.pink : CATEGORY[e.category].accent,
              borderLeft: e.hero ? "none" : `5px solid ${CATEGORY[e.category].dominant}`,
              color: e.hero ? "#fff" : colour.ink,
              padding: "8px 14px",
              boxShadow: e.hero ? `0 10px 30px rgba(196,28,114,.35)` : "none",
            }}
          >
            <div style={{ ...type.uiStrong, fontSize: 17 }}>{e.title}</div>
            <div style={{ fontFamily: MONO, fontSize: 13, opacity: 0.8 }}>
              {hm(e.start)} – {hm(e.end)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

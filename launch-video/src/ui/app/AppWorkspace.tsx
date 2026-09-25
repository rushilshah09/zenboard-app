import React from "react";
import { GlyphName } from "../../brand/glyphs.generated";
import { LOCKUP_MARK } from "../../brand/logo.generated";
import { JOB } from "../../data/acme";
import { Avatar, AvatarStack, Check, Ico, Kbd, LABEL, Label, Priority, Tag, app, t } from "./kit";

/**
 * The Zenboard workspace as the real product looks (dark "Paper" system):
 * sidebar with workspace switcher, search, nav with counts and favourites;
 * a top bar with breadcrumbs, views and actions; the Today list grouped by
 * Overdue / Today / Evening with ids, labels, projects, due times, priority
 * and assignees; and Thursday's day calendar with a live now-line.
 * 1600 × 1000 at 1×. `check` animates the first row's checkbox (0 → 1).
 */
export const AW = { w: 1600, h: 1000, side: 280, top: 64 } as const;
/** Centre of the first row's checkbox, in workspace space (the macro pull-out's origin). */
export const AW_CHECK = { x: 335, y: 251 } as const;

type Row = { id: string; title: string; tags?: [Label, string][]; project: [Label, string]; due?: string; overdue?: boolean; pr: 0 | 1 | 2 | 3 | 4; who: string; done?: boolean };

const GROUPS: { name: string; rows: Row[] }[] = [
  {
    name: "Today",
    rows: [
      { id: "ACM-24", title: JOB.title, tags: [["berry", "Proposal"]], project: ["berry", "Acme — Rebrand"], due: "10:00", pr: 3, who: "RS" },
      { id: "LUM-11", title: "Review Lumen feedback", tags: [["slate", "Feedback"]], project: ["slate", "Lumen deck"], due: "9:30", pr: 2, who: "RS", done: true },
      { id: "FIN-07", title: "Send September invoices", tags: [["moss", "Money"]], project: ["moss", "Finance"], due: "11:00", pr: 3, who: "RS" },
      { id: "ACM-19", title: "Call with Mara", project: ["berry", "Acme — Rebrand"], due: "12:00", pr: 1, who: "MO" },
      { id: "ACM-27", title: "Update pricing page copy", tags: [["indigo", "Copy"]], project: ["berry", "Acme — Rebrand"], pr: 1, who: "RS" },
      { id: "NW-03", title: "Northwind intro deck", tags: [["teal", "Pitch"]], project: ["teal", "Northwind"], due: "14:00", pr: 2, who: "ID" },
      { id: "LUM-14", title: "Reply to Theo", project: ["slate", "Lumen deck"], pr: 0, who: "TL", done: true },
    ],
  },
  {
    name: "Overdue",
    rows: [{ id: "ADM-02", title: "Book accountant", tags: [["ochre", "Admin"]], project: ["stone", "Admin"], due: "Tue", overdue: true, pr: 4, who: "RS" }],
  },
  {
    name: "This evening",
    rows: [
      { id: "LIFE", title: "Walk, 20 min", tags: [["moss", "Habit"]], project: ["moss", "Life"], due: "18:00", pr: 0, who: "RS" },
      { id: "LIFE", title: "Leave at 6", project: ["moss", "Life"], due: "18:00", pr: 0, who: "RS" },
    ],
  },
];

const NAV: { icon: GlyphName; label: string; count?: number }[] = [
  { icon: "bell", label: "Inbox", count: 3 },
  { icon: "sun-horizon", label: "Today", count: 11 },
  { icon: "calendar-dots", label: "Calendar", count: 4 },
  { icon: "kanban", label: "Projects", count: 6 },
  { icon: "file-text", label: "Docs" },
  { icon: "users", label: "Clients", count: 4 },
  { icon: "receipt", label: "Money", count: 2 },
  { icon: "flame", label: "Habits" },
  { icon: "target", label: "Goals" },
];

const Sidebar: React.FC = () => (
  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: AW.side, background: app.canvas, borderRight: `1px solid ${app.hairline}`, padding: "18px 14px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, height: 40, padding: "0 8px" }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, background: app.berry500, display: "grid", placeItems: "center" }}>
        <svg viewBox="0 0 32 32" width={18} height={18}>
          <path d={LOCKUP_MARK} fill="#fff" />
        </svg>
      </span>
      <span style={{ ...t.bodyStrong, color: app.ink900, flex: 1 }}>Life Design Studio</span>
      <Ico name="arrow-right" size={14} tint={app.ink400} />
    </div>
    <div style={{ margin: "14px 0 12px", height: 40, borderRadius: 9, background: app.paper2, boxShadow: `inset 0 0 0 1px ${app.hairline}`, display: "flex", alignItems: "center", gap: 10, padding: "0 12px" }}>
      <Ico name="command" size={16} tint={app.ink500} />
      <span style={{ ...t.small, color: app.ink500, flex: 1 }}>Search or jump to…</span>
      <Kbd>⌘K</Kbd>
    </div>
    {NAV.map((n) => {
      const on = n.label === "Today";
      return (
        <div key={n.label} style={{ display: "flex", alignItems: "center", gap: 12, height: 40, padding: "0 10px", borderRadius: 8, background: on ? app.paper3 : "transparent", marginBottom: 1 }}>
          <Ico name={n.icon} size={19} tint={on ? app.ink900 : app.ink500} />
          <span style={{ ...t.body, fontSize: 17, color: on ? app.ink900 : app.ink700, fontWeight: on ? 500 : 400, flex: 1 }}>{n.label}</span>
          {n.count ? <span style={{ ...t.mono, fontSize: 13, color: on ? app.ink700 : app.ink400 }}>{n.count}</span> : null}
        </div>
      );
    })}
    <div style={{ ...t.label, color: app.ink400, margin: "22px 10px 8px" }}>Favourites</div>
    {(
      [
        ["berry", "Acme — Rebrand"],
        ["slate", "Lumen deck"],
        ["teal", "Northwind pitch"],
        ["moss", "Morning routine"],
      ] as [Label, string][]
    ).map(([c, n]) => (
      <div key={n} style={{ display: "flex", alignItems: "center", gap: 12, height: 36, padding: "0 12px" }}>
        <span style={{ width: 9, height: 9, borderRadius: 3, background: LABEL[c].dot }} />
        <span style={{ ...t.body, fontSize: 16, color: app.ink700 }}>{n}</span>
      </div>
    ))}
    <div style={{ position: "absolute", left: 14, right: 14, bottom: 16, display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderTop: `1px solid ${app.hairline}` }}>
      <Avatar initials="RS" size={30} ring={app.canvas} />
      <div style={{ flex: 1 }}>
        <div style={{ ...t.small, color: app.ink800, fontWeight: 500 }}>Rushil Shah</div>
        <div style={{ ...t.mono, fontSize: 12, color: app.ink400 }}>Pro · 3 seats</div>
      </div>
      <Ico name="sparkle" size={16} tint={app.berry300} />
    </div>
  </div>
);

const TopBar: React.FC = () => (
  <div style={{ position: "absolute", left: AW.side, right: 0, top: 0, height: AW.top, borderBottom: `1px solid ${app.hairline}`, display: "flex", alignItems: "center", gap: 14, padding: "0 24px" }}>
    <span style={{ ...t.body, color: app.ink500 }}>Life Design Studio</span>
    <span style={{ color: app.ink300 }}>/</span>
    <span style={{ ...t.bodyStrong, color: app.ink900 }}>Today</span>
    <div style={{ marginLeft: 18, display: "flex", gap: 2, padding: 3, borderRadius: 9, background: app.paper2, boxShadow: `inset 0 0 0 1px ${app.hairline}` }}>
      {["List", "Board", "Calendar"].map((v, i) => (
        <span key={v} style={{ ...t.small, padding: "5px 14px", borderRadius: 7, background: i === 0 ? app.paper4 : "transparent", color: i === 0 ? app.ink900 : app.ink500 }}>
          {v}
        </span>
      ))}
    </div>
    <div style={{ flex: 1 }} />
    <span style={{ ...t.small, display: "inline-flex", alignItems: "center", gap: 8, color: app.ink600, padding: "6px 12px", borderRadius: 8, boxShadow: `inset 0 0 0 1px ${app.hairline2}` }}>
      <Ico name="list-checks" size={15} /> Filter
    </span>
    <AvatarStack people={["RS", "MO", "TL"]} size={28} ring={app.paper} />
    <span style={{ ...t.small, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 10, color: "#fff", background: app.berry500, padding: "7px 10px 7px 14px", borderRadius: 8 }}>
      New task <span style={{ ...t.mono, fontSize: 12, background: "rgba(255,255,255,.18)", padding: "1px 6px", borderRadius: 4 }}>C</span>
    </span>
  </div>
);

const TaskRow: React.FC<{ r: Row; first?: boolean; check?: number }> = ({ r, first, check = 0 }) => {
  const done = r.done || (first && check >= 1);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, height: 52, padding: "0 12px", borderRadius: 8, background: first ? "rgba(196, 28, 114, 0.09)" : "transparent", boxShadow: first ? `inset 0 0 0 1px rgba(196,28,114,.28)` : undefined }}>
      <Check p={first ? check : r.done ? 1 : 0} size={22} />
      <span style={{ ...t.mono, fontSize: 13, color: app.ink400, width: 62 }}>{r.id}</span>
      <span style={{ ...t.body, flex: 1, color: done ? app.ink400 : app.ink800, textDecoration: done ? "line-through" : "none", fontWeight: first ? 500 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</span>
      {(r.tags ?? []).map(([c, l]) => (
        <Tag key={l} label={c} size="sm">
          {l}
        </Tag>
      ))}
      <span style={{ ...t.small, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7, color: app.ink500, width: 150 }}>
        <span style={{ width: 8, height: 8, borderRadius: 3, background: LABEL[r.project[0]].dot }} />
        {r.project[1]}
      </span>
      <span style={{ ...t.mono, fontSize: 14, width: 48, textAlign: "right", color: r.overdue ? app.danger : app.ink500 }}>{r.due ?? "—"}</span>
      <span style={{ width: 22, display: "grid", placeItems: "center" }}>
        <Priority level={r.pr} />
      </span>
      <Avatar initials={r.who} size={26} ring={first ? "#2A1420" : app.paper} />
    </div>
  );
};

const HOUR = 64;
const H0 = 8;
const Calendar: React.FC = () => {
  const ev: { title: string; s: number; e: number; c: Label; sub?: string; hero?: boolean }[] = [
    { title: "Standup", s: 9, e: 9.5, c: "slate" },
    { title: JOB.title, s: 10, e: 12, c: "berry", sub: "Focus · Acme Studio", hero: true },
    { title: "Call with Mara", s: 12, e: 13, c: "plum", sub: "Google Meet" },
    { title: "Northwind intro", s: 14, e: 15, c: "teal", sub: "Inés Duarte" },
  ];
  const now = 9 + 40 / 60;
  return (
    <div style={{ position: "absolute", left: AW.side + 1000, right: 0, top: AW.top, bottom: 0, borderLeft: `1px solid ${app.hairline}`, padding: "22px 20px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ ...t.h2, color: app.ink900 }}>Thu 25</span>
        <span style={{ ...t.small, color: app.ink500 }}>September</span>
        <div style={{ flex: 1 }} />
        <Kbd>T</Kbd>
      </div>
      <div style={{ marginTop: 12, height: 30, borderRadius: 6, background: LABEL.berry.fill, color: LABEL.berry.text, ...t.small, fontSize: 14, display: "flex", alignItems: "center", gap: 8, padding: "0 10px" }}>
        <Ico name="paper-plane-tilt" size={14} tint={LABEL.berry.text} /> Proposal due to Acme
      </div>
      <div style={{ position: "relative", marginTop: 16 }}>
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: 0, right: 0, top: i * HOUR, borderTop: `1px solid ${app.hairline}` }}>
            <span style={{ ...t.mono, fontSize: 12, color: app.ink400, position: "relative", top: 4 }}>{`${H0 + i}:00`}</span>
          </div>
        ))}
        {ev.map((e) => (
          <div
            key={e.title}
            style={{
              position: "absolute",
              left: 58,
              right: 0,
              top: (e.s - H0) * HOUR + 2,
              height: (e.e - e.s) * HOUR - 4,
              borderRadius: 7,
              background: e.hero ? app.berry600 : LABEL[e.c].fill,
              boxShadow: e.hero ? `0 10px 30px rgba(196,28,114,.35), inset 0 0 0 1px rgba(255,255,255,.12)` : `inset 3px 0 0 ${LABEL[e.c].dot}`,
              padding: e.e - e.s <= 0.5 ? "5px 12px" : "8px 12px",
              color: e.hero ? "#fff" : LABEL[e.c].text,
              overflow: "hidden",
            }}
          >
            <div style={{ ...t.small, fontWeight: 600, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</div>
            {e.sub ? <div style={{ ...t.mono, fontSize: 12, opacity: 0.8, marginTop: 4, whiteSpace: "nowrap" }}>{`${e.s}:00–${e.e}:00`}</div> : null}
            {e.sub && e.e - e.s >= 1 ? <div style={{ ...t.small, fontSize: 13, opacity: 0.75, marginTop: 2, whiteSpace: "nowrap" }}>{e.sub}</div> : null}
          </div>
        ))}
        <div style={{ position: "absolute", left: 50, right: 0, top: (now - H0) * HOUR, height: 2, background: app.danger }}>
          <span style={{ position: "absolute", left: -5, top: -4, width: 10, height: 10, borderRadius: 5, background: app.danger }} />
        </div>
      </div>
    </div>
  );
};

export const AppWorkspace: React.FC<{ check?: number; style?: React.CSSProperties }> = ({ check = 0, style }) => (
  <div style={{ width: AW.w, height: AW.h, borderRadius: 18, background: app.paper, position: "relative", overflow: "hidden", fontFamily: t.body.fontFamily, boxShadow: `inset 0 0 0 1px ${app.hairline2}`, ...style }}>
    <Sidebar />
    <TopBar />
    <div style={{ position: "absolute", left: AW.side + 32, width: 940, top: AW.top + 26 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
        <div>
          <div style={{ ...t.h1, color: app.ink900 }}>Good morning, Rushil</div>
          <div style={{ ...t.body, color: app.ink500, marginTop: 6 }}>Thursday, 25 September · 3h 20m planned</div>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ ...t.mono, color: app.ink500 }}>{`${check >= 1 ? 3 : 2} of 11 done`}</span>
        <div style={{ width: 140, height: 6, borderRadius: 3, background: app.paper3, marginBottom: 5 }}>
          <div style={{ width: `${((check >= 1 ? 3 : 2) / 11) * 100}%`, height: "100%", borderRadius: 3, background: app.berry500 }} />
        </div>
      </div>
      {GROUPS.map((g, gi) => (
        <div key={g.name} style={{ marginTop: gi === 0 ? 26 : 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, height: 36, padding: "0 12px" }}>
            <span style={{ ...t.label, color: g.name === "Overdue" ? app.danger : app.ink500 }}>{g.name}</span>
            <span style={{ ...t.mono, fontSize: 13, color: app.ink400 }}>{g.rows.length}</span>
            <div style={{ flex: 1, height: 1, background: app.hairline }} />
          </div>
          <div style={{ marginTop: 8 }}>
            {g.rows.map((r, i) => (
              <TaskRow key={r.title} r={r} first={gi === 0 && i === 0} check={check} />
            ))}
          </div>
        </div>
      ))}
    </div>
    <Calendar />
  </div>
);

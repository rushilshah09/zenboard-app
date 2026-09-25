import React from "react";
import { color, ease, font, radius, tween, typed } from "../theme";
import { Check, Kbd, Mark } from "./primitives";

/**
 * Zenboard product UI, rebuilt at the app's real sizes (14px body, #121212
 * panels, hairline borders) and scaled up by the scene that hosts it.
 */

export const SHELL_W = 1100;
export const SHELL_H = 640;
export const SIDEBAR_W = 210;
export const NAV = ["Today", "Inbox", "Projects", "Docs", "Clients", "Money", "Habits", "Focus", "Automations"] as const;
export const NAV_Y0 = 78;
export const NAV_H = 34;
const NAV_GLYPH = ["◉", "▤", "◧", "¶", "◎", "$", "✿", "◷", "⟲"];

/** Sidebar pill position for a (possibly fractional) nav index. */
export const navY = (i: number) => NAV_Y0 + i * NAV_H;

export const Sidebar: React.FC<{ active: number }> = ({ active }) => (
  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: SIDEBAR_W, borderRight: `1px solid ${color.line2}` }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 18px" }}>
      <Mark size={22} />
      <div style={{ fontSize: 15, fontWeight: 600, color: color.ink900, letterSpacing: "-0.01em" }}>Zenboard</div>
    </div>
    <div
      style={{
        position: "absolute",
        left: 10,
        right: 10,
        top: navY(active),
        height: NAV_H - 4,
        borderRadius: radius.md,
        background: color.wash,
        border: `1px solid ${color.line2}`,
      }}
    />
    {NAV.map((n, i) => {
      const on = Math.abs(active - i) < 0.5;
      return (
        <div
          key={n}
          style={{
            position: "absolute",
            left: 22,
            top: navY(i),
            height: NAV_H - 4,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 14,
            color: on ? color.ink900 : color.ink600,
          }}
        >
          <span style={{ width: 16, textAlign: "center", color: on ? color.ink900 : color.ink500 }}>{NAV_GLYPH[i]}</span>
          {n}
        </div>
      );
    })}
    <div style={{ position: "absolute", left: 18, bottom: 18, display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: color.ink500 }}>
      <Kbd>⌘K</Kbd> Search everything
    </div>
  </div>
);

const Header: React.FC<{ title: string; meta?: string; right?: React.ReactNode }> = ({ title, meta, right }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 18 }}>
    <div style={{ fontSize: 22, fontWeight: 600, color: color.ink900, letterSpacing: "-0.015em" }}>{title}</div>
    {meta ? <div style={{ fontSize: 13, color: color.ink500 }}>{meta}</div> : null}
    <div style={{ flex: 1 }} />
    {right}
  </div>
);

const Chip: React.FC<{ tint: string; children: React.ReactNode }> = ({ tint, children }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: 12,
      color: color.ink600,
      padding: "2px 8px",
      borderRadius: radius.pill,
      background: color.wash,
      whiteSpace: "nowrap",
    }}
  >
    <div style={{ width: 6, height: 6, borderRadius: radius.pill, background: tint }} />
    {children}
  </div>
);

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: color.ink500, margin: "14px 0 6px" }}>
    {children}
  </div>
);

// ── Today ───────────────────────────────────────────────────────────────────
export const TODAY_ROWS = [
  { title: "Send Acme the revised proposal", tag: "Acme", tint: color.berry500, meta: "Due today", doneAt: 64 },
  { title: "Draft onboarding doc for Lumen", tag: "Lumen", tint: color.info500, meta: "2h" },
  { title: "Review September invoices", tag: "Money", tint: color.labelMoss, meta: "30m", doneAt: 96 },
];
export const TODAY_LATER = [
  { title: "Studio call with Mara", tag: "Call", tint: color.labelOchre, meta: "15:30" },
  { title: "Walk, no phone", tag: "Habit", tint: color.labelStone, meta: "20m" },
];
/** y of a Today row's centre inside the content area (for cursor targets). */
export const todayRowY = (i: number) => 28 + 40 + 32 + i * 46 + 20;

const TaskRow: React.FC<{ title: string; tag: string; tint: string; meta: string; done: number }> = ({ title, tag, tint, meta, done }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, height: 46, borderBottom: `1px solid ${color.line2}` }}>
    <Check done={done} />
    <div
      style={{
        flex: 1,
        fontSize: 14,
        color: done > 0.5 ? color.ink500 : color.ink800,
        textDecoration: done > 0.5 ? "line-through" : "none",
      }}
    >
      {title}
    </div>
    <Chip tint={tint}>{tag}</Chip>
    <div style={{ width: 70, textAlign: "right", fontFamily: font.mono, fontSize: 12, color: color.ink500 }}>{meta}</div>
  </div>
);

export const TodayView: React.FC<{ f: number }> = ({ f }) => {
  const done = TODAY_ROWS.filter((r) => r.doneAt && f >= r.doneAt + 6).length;
  return (
    <div>
      <Header title="Today" meta="Thu, 25 Sep" right={<div style={{ fontFamily: font.mono, fontSize: 12, color: color.ink500 }}>{done}/5 done</div>} />
      <Label>Top 3</Label>
      {TODAY_ROWS.map((r) => (
        <TaskRow key={r.title} {...r} done={r.doneAt ? tween(f, [r.doneAt, r.doneAt + 10], [0, 1]) : 0} />
      ))}
      <Label>Later</Label>
      {TODAY_LATER.map((r) => (
        <TaskRow key={r.title} {...r} done={0} />
      ))}
      <div style={{ marginTop: 18, fontSize: 12, color: color.ink500 }}>{5 - done} left · next deadline Fri · shutdown at 18:00</div>
    </div>
  );
};

// ── Docs ────────────────────────────────────────────────────────────────────
const DOC_TITLE = "Proposal — Acme rebrand, phase two";
const SLASH_ITEMS = ["Heading", "Task", "Table", "Invoice block"];
export const DOC_SLASH_AT = 66;
export const DOC_PICK_AT = 100;

export const DocView: React.FC<{ f: number }> = ({ f }) => {
  const title = typed(f, 18, DOC_TITLE, 40);
  const body = tween(f, [44, 60], [0, 1]);
  const menu = f >= DOC_SLASH_AT && f < DOC_PICK_AT ? tween(f, [DOC_SLASH_AT + 2, DOC_SLASH_AT + 10], [0, 1], ease.spring) : 0;
  const hover = f >= 84 ? 1 : 0;
  const block = tween(f, [DOC_PICK_AT, DOC_PICK_AT + 12], [0, 1], ease.spring);
  return (
    <div style={{ fontFamily: font.serif, color: color.ink800, position: "relative" }}>
      <div style={{ fontFamily: font.sans, fontSize: 12, color: color.ink500, marginBottom: 14 }}>Docs / Acme Studio</div>
      <div style={{ fontSize: 34, fontWeight: 600, color: color.ink900, letterSpacing: "-0.02em", minHeight: 44 }}>{title}</div>
      <div style={{ opacity: body, fontSize: 17, lineHeight: 1.6, marginTop: 14, color: color.ink700, maxWidth: 720 }}>
        Phase two extends the brand system to the product: a type scale, a component kit and the new pricing page. Two
        weeks, three reviews, fixed fee.
      </div>
      <div style={{ opacity: body, fontSize: 20, fontWeight: 600, color: color.ink900, marginTop: 22 }}>Next steps</div>
      <div style={{ position: "relative", marginTop: 10, fontFamily: font.sans, fontSize: 15, minHeight: 44 }}>
        {f >= DOC_SLASH_AT && f < DOC_PICK_AT ? <span style={{ color: color.ink600 }}>/task</span> : null}
        {block > 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              borderRadius: radius.md,
              border: `1px solid ${color.line}`,
              background: color.paper2,
              width: 560,
              scale: String(0.9 + block * 0.1),
              opacity: block,
              transformOrigin: "0 50%",
            }}
          >
            <Check done={0} />
            <div style={{ flex: 1, color: color.ink800 }}>Send proposal to Acme</div>
            <Chip tint={color.berry500}>Acme</Chip>
            <div style={{ fontFamily: font.mono, fontSize: 12, color: color.ink500 }}>Due Fri</div>
          </div>
        ) : null}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 30,
            width: 240,
            padding: 6,
            borderRadius: radius.lg,
            background: color.paper3,
            border: `1px solid ${color.line}`,
            boxShadow: "0 12px 32px -8px rgba(0,0,0,0.6)",
            opacity: menu,
            scale: String(0.94 + menu * 0.06),
            transformOrigin: "0 0",
            zIndex: 5,
          }}
        >
          {SLASH_ITEMS.map((it, i) => (
            <div
              key={it}
              style={{
                padding: "8px 10px",
                borderRadius: radius.md,
                fontSize: 14,
                color: color.ink800,
                background: i === hover ? color.wash : "transparent",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              {it}
              {i === hover ? <Kbd>↵</Kbd> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Money ───────────────────────────────────────────────────────────────────
const ENTRIES = [
  ["Mon 22", "Brand system, round 2", "3.0h"],
  ["Tue 23", "Brand system, round 2", "5.0h"],
  ["Wed 24", "Landing page review", "2.5h"],
  ["Thu 25", "Landing page review", "2.0h"],
];
export const MONEY_CLICK_AT = 70;
/** Cursor target for the "Create invoice" button, in content coords. */
export const MONEY_BUTTON = { x: 780, y: 330 };

export const MoneyView: React.FC<{ f: number }> = ({ f }) => {
  const card = tween(f, [MONEY_CLICK_AT + 4, MONEY_CLICK_AT + 20], [0, 1], ease.spring);
  const amount = Math.round(tween(f, [MONEY_CLICK_AT + 10, MONEY_CLICK_AT + 40], [0, 1875]));
  const press = tween(f, [MONEY_CLICK_AT - 2, MONEY_CLICK_AT], [0, 1]) * (1 - tween(f, [MONEY_CLICK_AT + 1, MONEY_CLICK_AT + 5], [0, 1]));
  return (
    <div style={{ position: "relative" }}>
      <Header title="Money" meta="Acme Studio" />
      <div style={{ display: "flex", gap: 18, fontSize: 13, marginBottom: 10 }}>
        {["Time", "Invoices", "Expenses"].map((t, i) => (
          <div key={t} style={{ color: i === 0 ? color.ink900 : color.ink500, paddingBottom: 6, borderBottom: i === 0 ? `2px solid ${color.ink900}` : "none" }}>
            {t}
          </div>
        ))}
      </div>
      {ENTRIES.map(([d, what, h], i) => (
        <div
          key={d}
          style={{
            display: "flex",
            alignItems: "center",
            height: 42,
            borderBottom: `1px solid ${color.line2}`,
            fontSize: 14,
            opacity: tween(f, [20 + i * 5, 32 + i * 5], [0, 1]),
          }}
        >
          <div style={{ width: 90, fontFamily: font.mono, fontSize: 12, color: color.ink500 }}>{d}</div>
          <div style={{ flex: 1, color: color.ink800 }}>{what}</div>
          <div style={{ fontFamily: font.mono, fontSize: 13, color: color.ink700 }}>{h}</div>
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", marginTop: 22 }}>
        <div style={{ fontSize: 14, color: color.ink600 }}>
          <span style={{ fontFamily: font.mono, color: color.ink900 }}>12.5h</span> unbilled · $150/h
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            padding: "9px 16px",
            borderRadius: radius.md,
            background: color.ink900,
            color: color.paper,
            fontSize: 14,
            fontWeight: 500,
            scale: String(1 - press * 0.06),
          }}
        >
          Create invoice
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          right: -10,
          top: 30,
          width: 420,
          padding: 22,
          borderRadius: radius.xl,
          background: color.paper2,
          border: `1px solid ${color.line}`,
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.7)",
          opacity: card,
          translate: `${(1 - card) * 60}px 0`,
          scale: String(0.94 + card * 0.06),
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ fontFamily: font.mono, fontSize: 12, color: color.ink500 }}>INV-1042</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 12, padding: "2px 8px", borderRadius: radius.pill, background: color.success100, color: color.success600 }}>
            Ready to send
          </div>
        </div>
        <div style={{ marginTop: 14, fontSize: 13, color: color.ink500 }}>Billed to</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: color.ink900 }}>Acme Studio</div>
        <div style={{ height: 1, background: color.line2, margin: "14px 0" }} />
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <span style={{ flex: 1, fontSize: 13, color: color.ink500 }}>12.5h × $150</span>
          <span style={{ fontFamily: font.mono, fontSize: 30, color: color.ink900 }}>${amount.toLocaleString("en-US")}.00</span>
        </div>
      </div>
    </div>
  );
};

// ── Client portal ───────────────────────────────────────────────────────────
export const PORTAL_ACCEPT_AT = 78;
export const PORTAL_BUTTON = { x: 640, y: 420 };

export const PortalView: React.FC<{ f: number }> = ({ f }) => {
  const accepted = tween(f, [PORTAL_ACCEPT_AT, PORTAL_ACCEPT_AT + 12], [0, 1], ease.spring);
  const press = tween(f, [PORTAL_ACCEPT_AT - 2, PORTAL_ACCEPT_AT], [0, 1]) * (1 - tween(f, [PORTAL_ACCEPT_AT + 1, PORTAL_ACCEPT_AT + 5], [0, 1]));
  const phases: [string, number][] = [
    ["Discovery", 1],
    ["Design", 0.64],
    ["Build", 0.2],
  ];
  return (
    <div>
      <Header
        title="Acme Studio"
        meta="Client portal"
        right={<div style={{ fontSize: 12, color: color.ink600, padding: "4px 10px", border: `1px solid ${color.line}`, borderRadius: radius.pill }}>Share link</div>}
      />
      {phases.map(([p, v], i) => (
        <div key={p} style={{ marginTop: i ? 14 : 4 }}>
          <div style={{ display: "flex", fontSize: 14, color: color.ink700 }}>
            <span style={{ flex: 1 }}>{p}</span>
            <span style={{ fontFamily: font.mono, fontSize: 12, color: color.ink500 }}>{Math.round(v * 100)}%</span>
          </div>
          <div style={{ marginTop: 8, height: 6, borderRadius: radius.pill, background: color.wash }}>
            <div style={{ height: 6, width: `${v * tween(f, [16 + i * 6, 46 + i * 6], [0, 100])}%`, borderRadius: radius.pill, background: color.ink900 }} />
          </div>
        </div>
      ))}
      <Label>Requests</Label>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: 16,
          borderRadius: radius.lg,
          border: `1px solid ${accepted > 0.5 ? color.success500 : color.line}`,
          background: accepted > 0.5 ? color.success100 : color.paper2,
          opacity: tween(f, [34, 48], [0, 1]),
          translate: `0 ${tween(f, [34, 48], [16, 0])}px`,
        }}
      >
        <div style={{ width: 34, height: 34, borderRadius: radius.pill, background: color.berry300, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, color: color.paper }}>
          M
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, color: color.ink900 }}>{accepted > 0.5 ? "Added to Acme rebrand" : "Can we add a pricing page?"}</div>
          <div style={{ fontSize: 12, color: accepted > 0.5 ? color.success600 : color.ink500 }}>
            {accepted > 0.5 ? "Task created · Mara notified" : "Mara · requested 2m ago"}
          </div>
        </div>
        {accepted > 0.5 ? (
          <div style={{ scale: String(accepted) }}>
            <Check done={1} size={24} />
          </div>
        ) : (
          <>
            <div style={{ padding: "7px 14px", borderRadius: radius.md, border: `1px solid ${color.line}`, fontSize: 13, color: color.ink700 }}>Discuss</div>
            <div style={{ padding: "7px 14px", borderRadius: radius.md, background: color.ink900, color: color.paper, fontSize: 13, fontWeight: 500, scale: String(1 - press * 0.08) }}>
              Accept
            </div>
          </>
        )}
      </div>
    </div>
  );
};

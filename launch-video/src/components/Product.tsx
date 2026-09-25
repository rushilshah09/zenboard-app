import React from "react";
import { interpolateColors } from "remotion";
import { FONT } from "../brand/fonts";
import { ZONES } from "../brand/layout";
import { DUR, EASE, clamp, leave, rise } from "../brand/motion";
import { CATEGORY, Category, colour, radius, shadow, space, tint, type } from "../brand/tokens";
import { Glyph, Icon } from "./Glyph";
import { Headline } from "./Headline";
import { Illustration, IllustrationCode } from "./Illustration";
import { Mark } from "./ZenMark";

/**
 * Zenboard in light mode, living on the same Paper as the rest of the film.
 * All coordinates below are window-local (the window is ZONES.window).
 */

export const WIN = ZONES.window;
export const SIDEBAR_W = 320;
export const ROW_Y0 = 96;
export const ROW_H = 64;
export const CONTENT = { x: SIDEBAR_W + 48, y: 40, w: WIN.w - SIDEBAR_W - 96, h: WIN.h - 80 };

export const NAV: { label: string; category: Category }[] = [
  { label: "Today", category: "tasks" },
  { label: "Projects", category: "projects" },
  { label: "Docs", category: "docs" },
  { label: "Notes", category: "notes" },
  { label: "Calendar", category: "calendar" },
  { label: "Money", category: "money" },
  { label: "Clients", category: "clients" },
  { label: "Life", category: "life" },
];
export const ROW = { today: 0, projects: 1, docs: 2, notes: 3, calendar: 4, money: 5, clients: 6, life: 7 } as const;

/** Window-local centre of a sidebar row's glyph (thread anchor). */
export const rowGlyph = (i: number) => ({ x: 16 + 16 + 20, y: ROW_Y0 + i * ROW_H + ROW_H / 2 });

export const ProductWindow: React.FC<{
  /** Per-row entrance (0 → 1) and category colour (0 → 1). */
  rows: number[];
  colours: number[];
  /** Selected row index; fractional while the selection slides. */
  selected?: number;
  selectedOpacity?: number;
  /** Per-row light-up (0 → 1) as the thread passes (S16). */
  lit?: number[];
  headerMark?: number;
  frame?: React.CSSProperties;
  content?: React.ReactNode;
  overlay?: React.ReactNode;
}> = ({ rows, colours, selected, selectedOpacity = 1, lit, headerMark = 1, frame, content, overlay }) => (
  <div
    style={{
      position: "absolute",
      left: WIN.x,
      top: WIN.y,
      width: WIN.w,
      height: WIN.h,
      borderRadius: radius.window,
      background: colour.card,
      boxShadow: shadow,
      fontFamily: FONT,
      overflow: "hidden",
      ...frame,
    }}
  >
    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: SIDEBAR_W, borderRight: `1px solid ${colour.hairline}` }}>
      <div style={{ position: "absolute", left: 32, top: 28, display: "flex", alignItems: "center", gap: space.s2, opacity: headerMark }}>
        <Mark size={32} />
        <div style={{ ...type.uiStrong, color: colour.ink }}>Zenboard</div>
      </div>
      {selected !== undefined ? (
        <div
          style={{
            position: "absolute",
            left: 16,
            width: SIDEBAR_W - 32,
            top: ROW_Y0 + 4,
            height: ROW_H - 8,
            borderRadius: radius.card,
            background: colour.blush,
            translate: `0 ${selected * ROW_H}px`,
            opacity: selectedOpacity,
          }}
        />
      ) : null}
      {NAV.map((n, i) => (
        <div
          key={n.label}
          style={{
            position: "absolute",
            left: 16,
            width: SIDEBAR_W - 32,
            top: ROW_Y0 + i * ROW_H + 4,
            height: ROW_H - 8,
            borderRadius: radius.card,
            background: lit ? `rgba(243, 217, 229, ${lit[i]})` : "transparent",
            display: "flex",
            alignItems: "center",
            gap: space.s2,
            paddingLeft: 16,
            opacity: rows[i],
            translate: `0 ${(1 - rows[i]) * 24}px`,
          }}
        >
          <Glyph category={n.category} size={40} colourProgress={colours[i]} />
          <div style={{ ...type.ui, color: colour.ink }}>{n.label}</div>
        </div>
      ))}
    </div>
    <div style={{ position: "absolute", left: CONTENT.x, top: CONTENT.y, width: CONTENT.w, height: CONTENT.h }}>{content}</div>
    {overlay}
  </div>
);

/** Focus pull (§4): the outgoing layer blurs to 8px and drops to 40% while the incoming sharpens. */
export const FocusPull: React.FC<{ frame: number; at: number; out: React.ReactNode; in: React.ReactNode }> = ({ frame, at, out, in: incoming }) => {
  const p = clamp(frame, [at, at + 24], [0, 1], EASE.settle);
  const gone = clamp(frame, [at + 12, at + 30], [0, 1], EASE.leave);
  const come = clamp(frame, [at + 10, at + 10 + DUR.settle], [0, 1], EASE.settle);
  return (
    <>
      {gone < 1 ? (
        <div style={{ position: "absolute", inset: 0, filter: `blur(${p * 8}px)`, opacity: (1 - p * 0.6) * (1 - gone) }}>{out}</div>
      ) : null}
      <div style={{ position: "absolute", inset: 0, opacity: come, translate: `0 ${(1 - come) * 24}px` }}>{incoming}</div>
    </>
  );
};

const Caption: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ ...type.caption, color: colour.stone, whiteSpace: "nowrap", ...style }}>{children}</div>
);

const Dot: React.FC<{ c: string; size?: number }> = ({ c, size = 10 }) => (
  <div style={{ width: size, height: size, borderRadius: radius.pill, background: c, flexShrink: 0 }} />
);

const Chip: React.FC<{ c: string; children: React.ReactNode }> = ({ c, children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: space.s1, padding: "2px 12px", borderRadius: radius.pill, background: tint.ink06, ...type.caption, color: colour.ink }}>
    <Dot c={c} />
    {children}
  </div>
);

const ViewHeader: React.FC<{ title: string; meta: string }> = ({ title, meta }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: space.s2, height: 40 }}>
    <div style={{ ...type.uiStrong, fontSize: 28, color: colour.ink }}>{title}</div>
    <Caption>{meta}</Caption>
  </div>
);

// ── S11 · Today ─────────────────────────────────────────────────────────────
const TASKS = [
  { t: "Draft Acme proposal", chip: "Acme", c: CATEGORY.clients.dominant },
  { t: "Review Lumen feedback", chip: "Lumen", c: CATEGORY.projects.dominant },
  { t: "Send September invoices", chip: "Money", c: CATEGORY.money.dominant },
  { t: "Walk, 20 min", chip: "Life", c: CATEGORY.life.dominant },
];
const TASK_Y = (i: number) => 72 + i * 76;
const CAL_X = 600;
const HOUR_H = 100;
const HOUR_Y = (i: number) => 64 + i * HOUR_H;
const HOURS = ["9:00", "10:00", "11:00", "12:00", "13:00"];
export const TODAY = {
  grabAt: 40,
  dropAt: 96,
  /** Content-local rects of the dragged task row and the 10:00 slot. */
  row: { x: 0, y: TASK_Y(0), w: 520, h: 64 },
  slot: { x: CAL_X + 96, y: HOUR_Y(1) + 4, w: 1184 - CAL_X - 96, h: HOUR_H - 8 },
};

const TaskRow: React.FC<{ t: string; chip: string; c: string; style?: React.CSSProperties }> = ({ t, chip, c, style }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: space.s2,
      height: 64,
      padding: `0 ${space.s2}px`,
      borderRadius: radius.card,
      background: colour.card,
      ...style,
    }}
  >
    <div style={{ width: 22, height: 22, borderRadius: radius.pill, border: `2px solid ${colour.stone}`, flexShrink: 0 }} />
    <div style={{ ...type.ui, color: colour.ink, flex: 1, whiteSpace: "nowrap" }}>{t}</div>
    <Chip c={c}>{chip}</Chip>
  </div>
);

const EventBlock: React.FC<{ title: string; time: string; category: Category; style?: React.CSSProperties }> = ({ title, time, category, style }) => (
  <div
    style={{
      borderRadius: radius.card,
      background: CATEGORY[category].accent,
      borderLeft: `6px solid ${CATEGORY[category].dominant}`,
      padding: `${space.s2}px ${space.s3}px`,
      ...style,
    }}
  >
    <div style={{ ...type.uiStrong, color: colour.ink }}>{title}</div>
    <Caption>{time}</Caption>
  </div>
);

export const TodayView: React.FC<{ f: number }> = ({ f }) => {
  const drag = clamp(f, [TODAY.grabAt + 6, TODAY.dropAt], [0, 1], EASE.settle);
  const lifted = f >= TODAY.grabAt && f < TODAY.dropAt;
  const morph = clamp(f, [TODAY.dropAt, TODAY.dropAt + 10], [0, 1], EASE.settle);
  const closeUp = clamp(f, [TODAY.dropAt + 8, TODAY.dropAt + 8 + DUR.settle], [0, 1], EASE.settle);
  const { row, slot } = TODAY;
  const gx = row.x + (slot.x - row.x) * drag;
  const gy = row.y + (slot.y - row.y) * drag;
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <ViewHeader title="Today" meta="Thursday, 25 September" />
      {TASKS.slice(1).map((task, i) => (
        <div key={task.t} style={{ position: "absolute", left: 0, top: TASK_Y(i + 1), width: row.w, translate: `0 ${-closeUp * 76}px` }}>
          <TaskRow {...task} />
        </div>
      ))}
      <div style={{ position: "absolute", left: CAL_X, top: 16, width: 1184 - CAL_X }}>
        <Caption>Thursday</Caption>
      </div>
      {HOURS.map((h, i) => (
        <div key={h} style={{ position: "absolute", left: CAL_X, top: HOUR_Y(i), width: 1184 - CAL_X, height: HOUR_H, borderTop: `1px solid ${colour.hairline}` }}>
          <Caption style={{ marginTop: 8 }}>{h}</Caption>
        </div>
      ))}
      <EventBlock
        title="Call with Mara"
        time="11:00 – 12:00"
        category="calendar"
        style={{ position: "absolute", left: slot.x, top: HOUR_Y(2) + 4, width: slot.w, height: slot.h }}
      />
      {/* The dragged task: a lifted row that settles into the slot, then becomes an event. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          translate: `${gx}px ${gy}px`,
          width: row.w,
          opacity: 1 - morph,
          filter: `blur(${morph * 2}px)`,
          boxShadow: lifted ? shadow : "none",
          borderRadius: radius.card,
          scale: lifted ? "1.02" : "1",
        }}
      >
        <TaskRow {...TASKS[0]} />
      </div>
      <EventBlock
        title="Draft Acme proposal"
        time="10:00 – 11:00 · Acme"
        category="tasks"
        style={{ position: "absolute", left: slot.x, top: slot.y, width: slot.w, height: slot.h, opacity: morph, filter: `blur(${(1 - morph) * 2}px)` }}
      />
    </div>
  );
};
/** Content-local anchor where the thread leaves the scheduled task. */
export const TODAY_THREAD_FROM = { x: TODAY.slot.x + 40, y: TODAY.slot.y + TODAY.slot.h };

// ── S12 · Docs ──────────────────────────────────────────────────────────────
export const DOC = { lineAt: 84, updateAt: 132 };
export const DocView: React.FC<{ f: number }> = ({ f }) => {
  const upd = clamp(f, [DOC.updateAt, DOC.updateAt + 16], [0, 1], EASE.settle);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Caption>Docs · Acme Studio</Caption>
      <div style={{ ...type.subhead, fontWeight: 500, color: colour.ink, marginTop: space.s2 }}>Rebrand, phase two — proposal</div>
      <div style={{ ...type.ui, color: colour.stone, marginTop: space.s3, maxWidth: 880 }}>
        Phase two carries the new brand into the product: a type scale, a component kit and the pricing page.
      </div>
      <div
        style={{
          marginTop: space.s3,
          display: "inline-flex",
          alignItems: "center",
          gap: space.s2,
          padding: `${space.s1}px ${space.s2}px`,
          borderRadius: radius.pill,
          background: colour.card,
          boxShadow: shadow,
        }}
      >
        <Dot c={colour.pink} />
        <div style={{ ...type.uiStrong, color: colour.ink }}>Draft Acme proposal</div>
        <div style={{ width: 1, height: 20, background: colour.hairline }} />
        <div style={{ position: "relative", minWidth: 150, height: 30 }}>
          <div style={{ position: "absolute", ...type.ui, color: colour.stone, opacity: 1 - upd, filter: `blur(${upd * 2}px)`, whiteSpace: "nowrap" }}>
            Today, 10:00
          </div>
          <div style={{ position: "absolute", ...type.ui, color: colour.pink, opacity: upd, filter: `blur(${(1 - upd) * 2}px)`, whiteSpace: "nowrap" }}>
            Ready for review
          </div>
        </div>
      </div>
      <div style={{ marginTop: space.s6 }}>
        <Headline text="Timeline: two weeks, three reviews, one fixed fee." at={DOC.lineAt} style="ui" tone="ink" />
      </div>
    </div>
  );
};

// ── S13 · Clients ───────────────────────────────────────────────────────────
const CLIENT_ROWS: { category: Category; t: string; meta: string }[] = [
  { category: "docs", t: "Proposal — rebrand, phase two", meta: "Ready for review" },
  { category: "tasks", t: "3 open tasks", meta: "Next: Draft Acme proposal · 10:00" },
  { category: "money", t: "12.5h tracked this week", meta: "$1,875 unbilled" },
];
export const ClientView: React.FC<{ f: number }> = ({ f }) => {
  const fill = clamp(f, [30, 30 + 72], [0, 0.64], EASE.settle);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: space.s2 }}>
        <Glyph category="clients" size={56} colourProgress={1} />
        <div>
          <div style={{ ...type.subhead, fontWeight: 500, color: colour.ink }}>Acme Studio</div>
          <Caption>Client since 2025 · 3 projects</Caption>
        </div>
      </div>
      <div style={{ marginTop: space.s6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", ...type.uiStrong, color: colour.ink }}>
          <span>Rebrand, phase two</span>
          <span style={{ fontVariantNumeric: "tabular-nums", color: colour.stone }}>{Math.round(fill * 100)}%</span>
        </div>
        <div style={{ marginTop: space.s1, height: 12, borderRadius: radius.pill, background: colour.hairline, overflow: "hidden" }}>
          <div style={{ height: "100%", width: "100%", borderRadius: radius.pill, background: colour.pink, transformOrigin: "0 50%", scale: `${fill} 1` }} />
        </div>
      </div>
      <div style={{ marginTop: space.s6, display: "flex", flexDirection: "column", gap: space.s2 }}>
        {CLIENT_ROWS.map((r, i) => (
          <div key={r.t} style={{ display: "flex", alignItems: "center", gap: space.s2, height: 64, padding: `0 ${space.s2}px`, borderRadius: radius.card, background: tint.ink06, ...rise(f, 20 + i * 8, { dist: 24 }) }}>
            <Glyph category={r.category} size={40} colourProgress={1} />
            <div style={{ ...type.uiStrong, color: colour.ink, flex: 1 }}>{r.t}</div>
            <Caption>{r.meta}</Caption>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── S14 · Money ─────────────────────────────────────────────────────────────
const HOURS_ROWS = [
  ["Mon 22", "Brand system, round 2", "3.0h"],
  ["Tue 23", "Brand system, round 2", "5.0h"],
  ["Wed 24", "Pricing page", "2.5h"],
  ["Thu 25", "Pricing page", "2.0h"],
];
export const MONEY = { collapseAt: 36, cardAt: 58, sendAt: 118, paidAt: 172 };
export const MONEY_SEND = { x: 1184 - 24 - 60, y: 64 + 330 - 24 - 24 }; // content-local centre of Send

export const MoneyView: React.FC<{ f: number }> = ({ f }) => {
  const press = clamp(f, [MONEY.sendAt - 4, MONEY.sendAt], [0, 1], EASE.snap) * (1 - clamp(f, [MONEY.sendAt + 2, MONEY.sendAt + 10], [0, 1], EASE.settle));
  const sent = f >= MONEY.sendAt + 4;
  const paid = clamp(f, [MONEY.paidAt, MONEY.paidAt + 18], [0, 1], EASE.settle);
  const amount = Math.round(clamp(f, [MONEY.cardAt + 10, MONEY.cardAt + 60], [0, 1875], EASE.settle));
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <ViewHeader title="Money" meta="Acme Studio · tracked time" />
      {HOURS_ROWS.map(([d, what, h], i) => (
        <div
          key={d}
          style={{
            position: "absolute",
            left: 0,
            top: 64 + i * 64,
            width: 1184,
            height: 56,
            display: "flex",
            alignItems: "center",
            gap: space.s3,
            borderBottom: `1px solid ${colour.hairline}`,
            ...leave(f, MONEY.collapseAt + i * 3, { dist: 24 }),
          }}
        >
          <Caption style={{ width: 90 }}>{d}</Caption>
          <div style={{ ...type.ui, color: colour.ink, flex: 1 }}>{what}</div>
          <div style={{ ...type.uiStrong, color: colour.ink, fontVariantNumeric: "tabular-nums" }}>{h}</div>
        </div>
      ))}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 64,
          width: 1184,
          height: 330,
          borderRadius: radius.card,
          background: colour.paper,
          padding: space.s3,
          display: "flex",
          flexDirection: "column",
          ...rise(f, MONEY.cardAt, { scale: true }),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: space.s2 }}>
          <Glyph category="money" size={40} colourProgress={1} />
          <div style={{ ...type.uiStrong, color: colour.ink }}>Invoice INV-1042</div>
          <Caption>Acme Studio</Caption>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", marginTop: space.s4 }}>
          <div style={{ ...type.ui, color: colour.stone, flex: 1 }}>12.5h × $150 · Brand system, pricing page</div>
          <div style={{ ...type.subhead, fontWeight: 500, color: colour.ink, fontVariantNumeric: "tabular-nums" }}>${amount.toLocaleString("en-US")}.00</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ position: "relative", height: 36, minWidth: 140 }}>
            {sent ? (
              <div
                style={{
                  position: "absolute",
                  display: "flex",
                  alignItems: "center",
                  gap: space.s1,
                  padding: "3px 14px",
                  borderRadius: radius.pill,
                  background: interpolateColors(paid, [0, 1], [tint.ink06, colour.blush]),
                  ...type.uiStrong,
                  color: interpolateColors(paid, [0, 1], [colour.stone, colour.pink]),
                }}
              >
                <div style={{ width: 20, height: 20, position: "relative" }}>
                  <Icon name="paper-plane-tilt" size={20} tint={colour.stone} style={{ position: "absolute", opacity: 1 - paid, scale: String(1 - paid * 0.75), filter: `blur(${paid * 4}px)` }} />
                  <Icon name="check" size={20} tint={colour.pink} style={{ position: "absolute", opacity: paid, scale: String(0.25 + paid * 0.75), filter: `blur(${(1 - paid) * 4}px)` }} />
                </div>
                <span>{paid > 0.5 ? "Paid" : "Sent"}</span>
              </div>
            ) : null}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: space.s1,
              padding: "10px 20px 10px 22px",
              borderRadius: radius.pill,
              background: colour.ink,
              color: colour.paper,
              ...type.uiStrong,
              scale: String(1 - press * 0.04),
            }}
          >
            Send
            <Icon name="arrow-right" size={20} tint={colour.paper} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ── S15 · Life ──────────────────────────────────────────────────────────────
const LIFE: { code: IllustrationCode; t: string; meta: string; category: Category }[] = [
  { code: "IMG-06a", t: "Deep work", meta: "Tue · 9:00 – 11:00", category: "tasks" },
  { code: "IMG-06b", t: "A walk", meta: "Every day · 18:00", category: "life" },
  { code: "IMG-06c", t: "Dinner with Sam", meta: "Fri · 19:30", category: "clients" },
  { code: "IMG-06d", t: "A day off", meta: "Saturday", category: "money" },
];
export const LifeView: React.FC<{ f: number }> = ({ f }) => {
  const cw = (1184 - 32) / 2;
  const ch = (CONTENT.h - 64 - 32) / 2;
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <ViewHeader title="This week" meta="Life" />
      {LIFE.map((c, i) => {
        const x = (i % 2) * (cw + 32);
        const y = 64 + Math.floor(i / 2) * (ch + 32);
        const at = 16 + i * 10;
        return (
          <div
            key={c.code}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: cw,
              height: ch,
              borderRadius: radius.card,
              background: colour.paper,
              display: "flex",
              alignItems: "center",
              gap: space.s3,
              padding: space.s3,
              ...rise(f, at, { scale: true }),
            }}
          >
            <div style={{ position: "relative", width: ch - 48, height: ch - 48, borderRadius: radius.inner, background: CATEGORY[c.category].accent, flexShrink: 0 }}>
              <Illustration
                code={c.code}
                rect={{ x: space.s1, y: space.s1, w: ch - 48 - 2 * space.s1, h: ch - 48 - 2 * space.s1 }}
                draw={clamp(f, [at + 6, at + 70], [0, 1], EASE.settle)}
                parallax={clamp(f, [at, at + 220], [0, 18], EASE.breathe)}
              />
            </div>
            <div>
              <div style={{ ...type.uiStrong, color: colour.ink }}>{c.t}</div>
              <Caption style={{ marginTop: 4 }}>{c.meta}</Caption>
            </div>
          </div>
        );
      })}
    </div>
  );
};

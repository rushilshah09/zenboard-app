import React from "react";
import { color, font, ground, light, radius, shadow } from "../theme";

/**
 * A generic, *other* tool's window — deliberately plain white OS chrome, so
 * the problem act reads as "many different apps", never as Zenboard.
 */

export type ToolKind = "tasks" | "notes" | "invoice" | "calendar" | "clients" | "sticky" | "email" | "sheet" | "timer";

export const TOOL_META: Record<ToolKind, { title: string; tint: string }> = {
  tasks: { title: "Tasks", tint: color.labelRust },
  notes: { title: "Notes", tint: color.labelOchre },
  invoice: { title: "Invoices", tint: color.labelMoss },
  calendar: { title: "Calendar", tint: color.info500 },
  clients: { title: "Clients", tint: color.berry500 },
  sticky: { title: "", tint: color.labelOchre },
  email: { title: "Inbox — 38 unread", tint: color.info500 },
  sheet: { title: "Q3 clients.xlsx", tint: color.labelMoss },
  timer: { title: "Time tracker", tint: color.labelStone },
};

const Line: React.FC<{ w: string; strong?: boolean }> = ({ w, strong }) => (
  <div style={{ height: 10, width: w, borderRadius: radius.pill, background: strong ? "rgba(18,18,18,0.22)" : light.faint, marginTop: 12 }} />
);

const Body: React.FC<{ kind: ToolKind }> = ({ kind }) => {
  switch (kind) {
    case "tasks":
      return (
        <div style={{ fontSize: 17, color: light.text }}>
          {["Send proposal", "Fix logo files", "Call accountant", "Reply to Dan"].map((t, i) => (
            <div key={t} style={{ display: "flex", gap: 10, alignItems: "center", marginTop: i ? 12 : 0 }}>
              <div style={{ width: 16, height: 16, borderRadius: radius.xs, border: "2px solid rgba(18,18,18,0.3)" }} />
              {t}
              {i === 0 ? <span style={{ marginLeft: "auto", fontSize: 13, color: color.labelRust }}>overdue</span> : null}
            </div>
          ))}
        </div>
      );
    case "notes":
      return (
        <div style={{ fontFamily: font.serif, fontSize: 22, color: light.text }}>
          Meeting notes (3)
          <Line w="92%" />
          <Line w="80%" />
          <Line w="86%" />
          <Line w="40%" />
        </div>
      );
    case "invoice":
      return (
        <div style={{ color: light.text }}>
          <div style={{ fontFamily: font.mono, fontSize: 15, color: light.muted }}>invoice_final_v3.pdf</div>
          <div style={{ fontFamily: font.mono, fontSize: 38, marginTop: 8 }}>$1,875</div>
          <div style={{ fontSize: 14, color: color.labelRust, marginTop: 4 }}>Unsent · 12 days</div>
        </div>
      );
    case "calendar":
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
          {Array.from({ length: 15 }, (_, i) => (
            <div
              key={i}
              style={{
                height: 26,
                borderRadius: radius.xs,
                background: [1, 4, 6, 7, 11, 13].includes(i) ? color.info500 : light.faint,
                opacity: [1, 4, 6, 7, 11, 13].includes(i) ? 0.8 : 1,
              }}
            />
          ))}
        </div>
      );
    case "clients":
      return (
        <div style={{ fontSize: 17, color: light.text }}>
          {["Acme Studio", "Lumen Co.", "Northwind"].map((c, i) => (
            <div key={c} style={{ display: "flex", gap: 10, alignItems: "center", marginTop: i ? 12 : 0 }}>
              <div style={{ width: 26, height: 26, borderRadius: radius.pill, background: [color.berry300, color.info600, color.labelOchre][i] }} />
              {c}
            </div>
          ))}
        </div>
      );
    case "sticky":
      return (
        <div style={{ fontFamily: font.serif, fontStyle: "italic", fontSize: 30, color: light.text, lineHeight: 1.2 }}>
          don't forget
          <br />
          to invoice Acme!!
        </div>
      );
    case "email":
      return (
        <div style={{ fontSize: 16, color: light.text }}>
          {["Re: Re: Fwd: scope?", "Invoice question", "Can we move Thursday?"].map((t, i) => (
            <div key={t} style={{ marginTop: i ? 12 : 0, fontWeight: i === 0 ? 600 : 400 }}>
              {t}
            </div>
          ))}
        </div>
      );
    case "sheet":
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
          {Array.from({ length: 16 }, (_, i) => (
            <div key={i} style={{ height: 22, background: i < 4 ? "rgba(85,168,124,0.25)" : light.faint }} />
          ))}
        </div>
      );
    case "timer":
      return <div style={{ fontFamily: font.mono, fontSize: 44, color: light.text }}>02:14:09</div>;
  }
};

export const ToolWindow: React.FC<{ kind: ToolKind; title?: string; width?: number; style?: React.CSSProperties }> = ({
  kind,
  title,
  width = 340,
  style,
}) => {
  const meta = TOOL_META[kind];
  const sticky = kind === "sticky";
  return (
    <div
      style={{
        width,
        background: sticky ? ground.sticky : light.surface,
        borderRadius: sticky ? radius.xs : radius.lg,
        boxShadow: shadow.float,
        border: sticky ? "none" : `1px solid ${light.faint}`,
        fontFamily: font.sans,
        overflow: "hidden",
        ...style,
      }}
    >
      {sticky ? null : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: `1px solid ${light.faint}` }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: radius.pill, background: "rgba(18,18,18,0.12)" }} />
          ))}
          <div style={{ width: 10, height: 10, borderRadius: radius.xs, background: meta.tint, marginLeft: 8 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: light.text }}>{title ?? meta.title}</div>
        </div>
      )}
      <div style={{ padding: sticky ? 28 : 18 }}>
        <Body kind={kind} />
      </div>
    </div>
  );
};

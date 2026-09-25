import React from "react";
import { MONO } from "../brand/fonts";
import { CATEGORY, colour, space, type } from "../brand/tokens";
import { BOARD, JOB, PEOPLE, money } from "../data/acme";
import { Glyph, Icon } from "../components/Glyph";
import { Light, Panel } from "./Fragments";

/**
 * The nodes of the graph (DIRECTION_V3.md §4, scene 4): one real card per thing
 * the Acme task touches. Same component kit as the rest of the film.
 */
const Head: React.FC<{ category: keyof typeof CATEGORY; title: string; meta?: string }> = ({ category, title, meta }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <Glyph category={category} size={30} colourProgress={1} />
    <div style={{ ...type.uiStrong, fontSize: 19, flex: 1 }}>{title}</div>
    {meta ? <span style={{ fontFamily: MONO, fontSize: 13, color: colour.stone }}>{meta}</span> : null}
  </div>
);

export const TaskCard: React.FC<{ light: Light; done?: boolean }> = ({ light, done }) => (
  <Panel w={400} light={light} style={{ padding: space.s3 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 24, height: 24, borderRadius: 12, border: `2px solid ${colour.pink}`, background: done ? colour.pink : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {done ? <Icon name="check" size={15} tint="#fff" /> : null}
      </div>
      <div style={{ ...type.uiStrong, fontSize: 22 }}>Rebrand proposal · Acme</div>
    </div>
    <div style={{ display: "flex", gap: 10, marginTop: 12, marginLeft: 38 }}>
      <span style={{ fontFamily: MONO, fontSize: 14, color: colour.stone }}>Thu 10:00</span>
      <span style={{ fontFamily: MONO, fontSize: 14, color: colour.stone }}>· #acme</span>
    </div>
  </Panel>
);

export const ProjectCard: React.FC<{ light: Light }> = ({ light }) => (
  <Panel w={470} light={light} style={{ padding: space.s3 }}>
    <Head category="projects" title={JOB.project} meta="6 open" />
    <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
      {(["todo", "doing", "review"] as const).map((col) => (
        <div key={col} style={{ flex: 1, background: "rgba(40,4,23,.04)", borderRadius: 10, padding: 8 }}>
          <div style={{ ...type.caption, fontSize: 12, color: colour.stone, marginBottom: 6 }}>{col === "todo" ? "To do" : col === "doing" ? "In progress" : "Review"}</div>
          {(col === "doing" ? ["Rebrand proposal", ...BOARD.doing] : BOARD[col]).slice(0, 3).map((c, i) => (
            <div key={c} style={{ background: "#fff", borderRadius: 7, padding: "6px 8px", fontSize: 13, marginBottom: 5, boxShadow: col === "doing" && i === 0 ? `0 0 0 1.5px ${colour.pink}` : "0 1px 2px rgba(40,4,23,.08)" }}>
              {c}
            </div>
          ))}
        </div>
      ))}
    </div>
  </Panel>
);

export const EventCard: React.FC<{ light: Light }> = ({ light }) => (
  <Panel w={380} light={light} style={{ padding: space.s3 }}>
    <Head category="calendar" title="Thursday" meta="25 Sep" />
    <div style={{ position: "relative", marginTop: 12, height: 110 }}>
      {["9:00", "10:00", "11:00", "12:00"].map((h, i) => (
        <div key={h} style={{ position: "absolute", left: 0, right: 0, top: i * 34, borderTop: `1px solid ${colour.hairline}` }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: colour.stone }}>{h}</span>
        </div>
      ))}
      <div style={{ position: "absolute", left: 48, right: 0, top: 36, height: 64, borderRadius: 8, background: colour.pink, color: "#fff", padding: "6px 10px", boxShadow: "0 8px 20px rgba(196,28,114,.35)" }}>
        <div style={{ ...type.uiStrong, fontSize: 15 }}>{JOB.title}</div>
        <div style={{ fontFamily: MONO, fontSize: 12, opacity: 0.85 }}>10:00 – 12:00</div>
      </div>
    </div>
  </Panel>
);

export const DocCard: React.FC<{ light: Light }> = ({ light }) => (
  <Panel w={440} light={light} style={{ padding: space.s3 }}>
    <Head category="docs" title={JOB.doc} meta="edited now" />
    <div style={{ ...type.ui, fontSize: 15, lineHeight: "22px", color: colour.stone, marginTop: 12 }}>
      Phase two carries the new brand into the product: a type scale, a component kit and the pricing page.
    </div>
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 12, padding: "4px 12px", borderRadius: 999, background: colour.blush, fontSize: 14 }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: colour.pink }} />
      Rebrand proposal · <span style={{ fontFamily: MONO, fontSize: 13 }}>Thu 10:00</span>
    </div>
    <div style={{ ...type.ui, fontSize: 15, marginTop: 10 }}>
      Review with <span style={{ color: colour.pink, fontWeight: 500 }}>@Mara</span>
      <span style={{ display: "inline-block", width: 2, height: 16, background: colour.pink, marginLeft: 2, verticalAlign: "middle" }} />
    </div>
  </Panel>
);

export const ClientCard: React.FC<{ light: Light }> = ({ light }) => (
  <Panel w={420} light={light} style={{ padding: space.s3 }}>
    <Head category="clients" title="Acme Studio" meta="portal" />
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 15 }}>
      <span>Rebrand, phase two</span>
      <span style={{ fontFamily: MONO }}>64%</span>
    </div>
    <div style={{ height: 8, borderRadius: 4, background: colour.hairline, marginTop: 6 }}>
      <div style={{ width: "64%", height: "100%", borderRadius: 4, background: colour.pink }} />
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
      <div style={{ width: 30, height: 30, borderRadius: 15, background: colour.blush, fontFamily: MONO, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{PEOPLE.mara.initials}</div>
      <span style={{ fontSize: 15 }}>Approved — go ahead with phase two.</span>
    </div>
  </Panel>
);

export const InvoiceCard: React.FC<{ light: Light; paid?: boolean }> = ({ light, paid }) => (
  <Panel w={380} light={light} style={{ padding: space.s3 }}>
    <Head category="money" title={JOB.invoice.id} meta="Acme Studio" />
    <div style={{ fontFamily: MONO, fontSize: 34, fontWeight: 500, marginTop: 12 }}>{money(JOB.invoice.amount)}</div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
      <span style={{ fontFamily: MONO, fontSize: 13, color: colour.stone }}>12.5h × $150</span>
      <span style={{ padding: "3px 12px", borderRadius: 999, background: paid ? colour.blush : "rgba(40,4,23,.06)", color: paid ? colour.pink : colour.stone, fontWeight: 500, fontSize: 14 }}>{paid ? "Paid" : "Sent"}</span>
    </div>
  </Panel>
);

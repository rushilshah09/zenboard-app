import React from "react";
import { BOARD, JOB, PEOPLE, money } from "../../data/acme";
import { Avatar, AvatarStack, Check, Divider, Ico, Kbd, LABEL, Priority, Surface, Tag, app, t } from "./kit";

/**
 * Product cards for the graph, the orbit and the feature arc: each is a real
 * Zenboard object (task, project board, event, doc, client, invoice) at
 * production density, built only from the kit. One job threads through them
 * all: "Rebrand proposal for Acme".
 */
const W = 460;

const Head: React.FC<{ kind: string; id?: string; right?: React.ReactNode }> = ({ kind, id, right }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, height: 44, padding: "0 18px", borderBottom: `1px solid ${app.hairline}` }}>
    <span style={{ ...t.label, color: app.ink500 }}>{kind}</span>
    {id ? <span style={{ ...t.mono, fontSize: 13, color: app.ink400 }}>{id}</span> : null}
    <div style={{ flex: 1 }} />
    {right}
  </div>
);

const Meta: React.FC<{ k: string; children: React.ReactNode }> = ({ k, children }) => (
  <div style={{ display: "flex", alignItems: "center", height: 34 }}>
    <span style={{ ...t.small, fontSize: 14, color: app.ink500, width: 96 }}>{k}</span>
    <span style={{ ...t.small, color: app.ink800, display: "inline-flex", alignItems: "center", gap: 8 }}>{children}</span>
  </div>
);

export const TaskCard: React.FC<{ check?: number }> = ({ check = 0 }) => (
  <Surface w={W}>
    <Head kind="Task" id="ACM-24" right={<Tag label="berry" size="sm">In progress</Tag>} />
    <div style={{ padding: "16px 18px 18px" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span style={{ marginTop: 3 }}>
          <Check p={check} size={22} />
        </span>
        <div style={{ ...t.h2, color: app.ink900 }}>{JOB.title}</div>
      </div>
      <div style={{ marginTop: 14 }}>
        <Meta k="Project">
          <span style={{ width: 8, height: 8, borderRadius: 3, background: LABEL.berry.dot }} /> Acme — Rebrand
        </Meta>
        <Meta k="Due">
          Thu 25 Sep · <span style={{ ...t.mono }}>10:00</span>
        </Meta>
        <Meta k="Priority">
          <Priority level={3} /> High
        </Meta>
        <Meta k="Assignee">
          <Avatar initials="RS" size={22} /> Rushil
        </Meta>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
        <div style={{ flex: 1, height: 5, borderRadius: 3, background: app.paper3 }}>
          <div style={{ width: "66%", height: "100%", borderRadius: 3, background: app.berry500 }} />
        </div>
        <span style={{ ...t.mono, fontSize: 13, color: app.ink500 }}>4/6 subtasks</span>
      </div>
    </div>
  </Surface>
);

export const ProjectCard: React.FC = () => {
  const cols: [string, string[], string][] = [
    ["To do", BOARD.todo.slice(0, 2), app.ink400],
    ["Doing", [JOB.title.replace(" for Acme", ""), BOARD.doing[0]], LABEL.ochre.dot],
    ["Done", BOARD.done.slice(0, 2), LABEL.moss.dot],
  ];
  return (
    <Surface w={560}>
      <Head kind="Project" right={<AvatarStack people={["RS", "MO"]} size={24} />} />
      <div style={{ padding: "14px 18px 6px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 12, height: 12, borderRadius: 4, background: LABEL.berry.dot }} />
        <span style={{ ...t.h2, color: app.ink900 }}>Acme — Rebrand</span>
        <div style={{ flex: 1 }} />
        <span style={{ ...t.mono, fontSize: 13, color: app.ink500 }}>64% · due 9 Oct</span>
      </div>
      <div style={{ display: "flex", gap: 10, padding: "10px 14px 16px" }}>
        {cols.map(([name, items, dot]) => (
          <div key={name} style={{ flex: 1, borderRadius: 10, background: app.paper2, padding: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, ...t.small, fontSize: 13, color: app.ink600, marginBottom: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: 4, background: dot }} />
              {name}
              <span style={{ ...t.mono, fontSize: 12, color: app.ink400 }}>{items.length + (name === "Done" ? 1 : 0)}</span>
            </div>
            {items.map((it, i) => {
              const hero = name === "Doing" && i === 0;
              return (
                <div key={it} style={{ borderRadius: 7, background: hero ? "rgba(196,28,114,.14)" : app.paper3, boxShadow: hero ? `inset 0 0 0 1px ${app.berry500}` : `inset 0 0 0 1px ${app.hairline}`, padding: "8px 10px", marginBottom: 6, ...t.small, fontSize: 14, color: hero ? app.ink900 : app.ink700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {it}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Surface>
  );
};

export const EventCard: React.FC = () => (
  <Surface w={420}>
    <Head kind="Event" right={<Kbd>T</Kbd>} />
    <div style={{ padding: "16px 18px" }}>
      <div style={{ display: "flex", gap: 14 }}>
        <div style={{ width: 58, borderRadius: 10, background: app.paper2, textAlign: "center", padding: "6px 0" }}>
          <div style={{ ...t.label, fontSize: 11, color: app.berry300 }}>Thu</div>
          <div style={{ ...t.h1, fontSize: 28, color: app.ink900 }}>25</div>
        </div>
        <div>
          <div style={{ ...t.h2, fontSize: 20, color: app.ink900 }}>Rebrand proposal</div>
          <div style={{ ...t.mono, color: app.ink500, marginTop: 4 }}>10:00 – 12:00 · 2h focus</div>
        </div>
      </div>
      <div style={{ marginTop: 14, borderRadius: 8, height: 34, background: app.berry600, boxShadow: `0 8px 24px rgba(196,28,114,.35)`, display: "flex", alignItems: "center", padding: "0 12px", ...t.small, fontSize: 14, color: "#fff", fontWeight: 500 }}>
        Rebrand proposal for Acme
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, ...t.small, fontSize: 14, color: app.ink500 }}>
        <Ico name="bell" size={15} /> 10 min before
        <div style={{ flex: 1 }} />
        <Tag label="berry" size="sm">Acme Studio</Tag>
      </div>
    </div>
  </Surface>
);

export const DocCard: React.FC = () => (
  <Surface w={500}>
    <Head kind="Doc" right={<span style={{ ...t.mono, fontSize: 12, color: app.ink400 }}>Edited 2m ago</span>} />
    <div style={{ padding: "18px 22px 20px" }}>
      <div style={{ ...t.h1, fontSize: 26, color: app.ink900 }}>Acme: rebrand proposal</div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Tag label="berry" size="sm">Acme — Rebrand</Tag>
        <Tag label="indigo" size="sm">Proposal</Tag>
      </div>
      <div style={{ ...t.bodyStrong, fontSize: 16, color: app.ink800, marginTop: 16 }}>1. Where Acme is today</div>
      <div style={{ ...t.small, color: app.ink600, marginTop: 6, lineHeight: 1.5 }}>A warmer palette, the wordmark kept, and a type system that scales from packaging to product.</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, padding: "8px 10px", borderRadius: 8, background: app.paper2, boxShadow: `inset 0 0 0 1px ${app.hairline}` }}>
        <Check p={0} size={18} />
        <span style={{ ...t.small, fontSize: 14, color: app.ink800, flex: 1 }}>{JOB.title}</span>
        <span style={{ ...t.mono, fontSize: 12, color: app.ink400 }}>ACM-24</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, ...t.small, fontSize: 13, color: app.ink500 }}>
        <AvatarStack people={["RS", "MO"]} size={20} /> 2 editing
      </div>
    </div>
  </Surface>
);

export const ClientCard: React.FC<{ approved?: number }> = ({ approved = 1 }) => (
  <Surface w={460}>
    <Head kind="Client portal" right={<Tag label="moss" size="sm">Active</Tag>} />
    <div style={{ padding: "16px 18px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 40, height: 40, borderRadius: 10, background: "#2A1420", display: "grid", placeItems: "center", ...t.bodyStrong, color: LABEL.berry.text }}>A</span>
        <div style={{ flex: 1 }}>
          <div style={{ ...t.h2, fontSize: 20, color: app.ink900 }}>Acme Studio</div>
          <div style={{ ...t.small, fontSize: 14, color: app.ink500 }}>{PEOPLE.mara.name} · Head of Brand</div>
        </div>
      </div>
      <Divider style={{ margin: "14px 0" }} />
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Avatar initials="MO" size={30} />
        <div style={{ flex: 1 }}>
          <div style={{ ...t.small, fontSize: 14, color: app.ink500 }}>
            <span style={{ color: app.ink800, fontWeight: 500 }}>Mara</span> · 11:48
          </div>
          <div style={{ ...t.small, color: app.ink800, marginTop: 2 }}>Approved — go ahead with phase two.</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, opacity: approved }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 30, padding: "0 12px", borderRadius: 8, background: LABEL.moss.fill, color: LABEL.moss.text, ...t.small, fontSize: 14, fontWeight: 500 }}>
          <Ico name="check" size={14} tint={LABEL.moss.text} /> Proposal approved
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ ...t.mono, fontSize: 13, color: app.ink500 }}>3 projects</span>
      </div>
    </div>
  </Surface>
);

export const InvoiceCard: React.FC<{ paid?: number }> = ({ paid = 0 }) => (
  <Surface w={480}>
    <Head
      kind="Invoice"
      id={JOB.invoice.id}
      right={
        <span style={{ position: "relative", display: "inline-grid" }}>
          <span style={{ gridArea: "1/1", opacity: 1 - paid }}>
            <Tag label="ochre" size="sm">Sent</Tag>
          </span>
          <span style={{ gridArea: "1/1", opacity: paid, transform: `scale(${0.8 + 0.2 * paid})` }}>
            <Tag label="moss" size="sm">Paid</Tag>
          </span>
        </span>
      }
    />
    <div style={{ padding: "12px 18px 18px" }}>
      {JOB.hours.map((h) => (
        <div key={h.day} style={{ display: "flex", alignItems: "center", gap: 12, height: 36, borderBottom: `1px solid ${app.hairline}` }}>
          <span style={{ ...t.mono, fontSize: 13, color: app.ink500, width: 60 }}>{h.day}</span>
          <span style={{ ...t.small, color: app.ink800, flex: 1 }}>{h.what}</span>
          <span style={{ ...t.mono, fontSize: 14, color: app.ink700 }}>{h.h.toFixed(1)}h</span>
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "flex-end", marginTop: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ ...t.mono, fontSize: 13, color: app.ink500 }}>12.5h × $150 · Acme Studio</div>
          <div style={{ fontFamily: t.mono.fontFamily, fontSize: 34, fontWeight: 500, color: app.ink900, marginTop: 4 }}>{money(JOB.invoice.amount)}</div>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 38, padding: "0 16px", borderRadius: 9, background: paid > 0.5 ? LABEL.moss.fill : app.berry500, color: paid > 0.5 ? LABEL.moss.text : "#fff", ...t.small, fontWeight: 600 }}>
          {paid > 0.5 ? "Paid · 25 Sep" : "Send invoice"}
        </span>
      </div>
    </div>
  </Surface>
);

export const GoalCard: React.FC = () => (
  <Surface w={440}>
    <Head kind="Goal" id="Q4" right={<Tag label="indigo" size="sm">On track</Tag>} />
    <div style={{ padding: "16px 18px 18px" }}>
      <div style={{ ...t.h2, color: app.ink900 }}>Sign three retainer clients</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 14 }}>
        <span style={{ fontFamily: t.mono.fontFamily, fontSize: 40, color: app.ink900 }}>2</span>
        <span style={{ ...t.mono, color: app.ink500 }}>of 3 · due 31 Dec</span>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        {[1, 1, 0].map((on, i) => (
          <div key={i} style={{ flex: 1, height: 8, borderRadius: 4, background: on ? LABEL.indigo.dot : app.paper3 }} />
        ))}
      </div>
      <div style={{ ...t.small, fontSize: 14, color: app.ink500, marginTop: 12 }}>Linked: Acme Studio · Lumen Co.</div>
    </div>
  </Surface>
);

export const HabitCard: React.FC = () => (
  <Surface w={420}>
    <Head kind="Habit" right={<span style={{ ...t.mono, fontSize: 13, color: LABEL.moss.text }}>12-day streak</span>} />
    <div style={{ padding: "16px 18px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Ico name="flame" size={22} tint={LABEL.rust.dot} />
        <span style={{ ...t.h2, color: app.ink900 }}>Walk, 20 min</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(14, 1fr)", gap: 5, marginTop: 16 }}>
        {Array.from({ length: 28 }, (_, i) => (
          <div key={i} style={{ aspectRatio: "1", borderRadius: 4, background: i > 15 || i % 5 !== 2 ? LABEL.moss.dot : app.paper3, opacity: i > 15 ? 1 : 0.55 }} />
        ))}
      </div>
      <div style={{ ...t.small, fontSize: 14, color: app.ink500, marginTop: 12 }}>Every day · 18:00</div>
    </div>
  </Surface>
);

export const NoteCard: React.FC = () => (
  <Surface w={420}>
    <Head kind="Note" right={<span style={{ ...t.mono, fontSize: 12, color: app.ink400 }}>Today 12:40</span>} />
    <div style={{ padding: "16px 18px 18px" }}>
      <div style={{ ...t.h2, color: app.ink900 }}>Call notes — Mara</div>
      {["Warmer palette, keep the wordmark", "Budget approved for phase two", "Send proposal by Thursday"].map((l) => (
        <div key={l} style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, ...t.small, color: app.ink700 }}>
          <span style={{ width: 5, height: 5, borderRadius: 3, background: app.ink500 }} /> {l}
        </div>
      ))}
    </div>
  </Surface>
);

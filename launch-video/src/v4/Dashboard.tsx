/** The full Zenboard desktop dashboard (dark design system), ported from the storyboard's dashboard(). */
import React from "react";
import { BERRY, Face, Icon, Lockup } from "./kit";
import { IconName } from "./icons.generated";

const NAV: [IconName, string, string?][] = [
  ["sun", "Today"], ["tray", "Inbox", "3"], ["check-square", "Tasks", "12"], ["kanban", "Projects"], ["file-text", "Docs"],
  ["calendar-blank", "Calendar"], ["users-three", "Clients"], ["currency-circle-dollar", "Money"], ["plant", "Habits"],
  ["timer", "Focus"], ["clipboard-text", "Forms"], ["lightning", "Automations"],
];

/** `done` strikes the highlight (4.2 click), `rows` 0..1 reveals the plan rows in sequence. */
export const Dashboard: React.FC<{ done?: boolean; rowStyle?: (i: number) => React.CSSProperties }> = ({ done, rowStyle }) => (
  <div className="dash">
    <aside className="ds">
      <div className="dlogo"><Lockup width={7.4} color="#EDE9E1" /></div>
      <div className="dsearch"><Icon name="magnifying-glass" weight="regular" size=".9cqw" />Search<kbd>⌘K</kbd></div>
      {NAV.map(([ic, t, n], i) => (
        <div key={t} className={`dn${i === 0 ? " on" : ""}`}><Icon name={ic} weight="regular" size="1.05cqw" /><span>{t}</span>{n ? <em>{n}</em> : null}</div>
      ))}
      <div className="dsec">Projects</div>
      <div className="dn"><i style={{ background: BERRY }} /><span>Brand identity</span></div>
      <div className="dn"><i style={{ background: "#3C6FD8" }} /><span>Website rebuild</span></div>
      <div className="dn"><i style={{ background: "#3F8F55" }} /><span>Life</span></div>
    </aside>
    <section className="dm">
      <div className="dg">Good evening, Darshil.</div>
      <div className="dsub">You&apos;ve committed to <b>2 tasks</b>. Highlight: <b>Send invoice for July to TechSpark</b>.</div>
      <div className="dhl" style={rowStyle?.(0)}>
        <small><Icon name="star" weight="fill" size=".8cqw" /> Today&apos;s highlight</small>
        <b style={done ? { textDecoration: "line-through", opacity: 0.6 } : undefined}>Send invoice for July to TechSpark</b>
        <div className="drw"><span className="dtag">TechSpark</span><span className="dtag r">High</span><span className="dbtn2"><Icon name="play" weight="fill" size=".8cqw" /> Start focus</span></div>
      </div>
      <div className="dsec2">Today&apos;s plan · 3</div>
      <div className="dr" style={rowStyle?.(1)}><i className={done ? "on" : ""} />Send invoice for July to TechSpark<em className="dtag r">High</em></div>
      <div className="dr" style={rowStyle?.(2)}><i />Prepare weekly report<em className="dtag y">Medium</em></div>
      <div className="dr" style={rowStyle?.(3)}><i />Send the Q3 retainer proposal<em className="dtag">Meridian</em></div>
      <div className="dr dn2" style={rowStyle?.(4)}><i className="on" />Review design feedback</div>
    </section>
    <section className="dx">
      <div className="dw" style={rowStyle?.(1)}><div className="dwh">Schedule</div>
        <div className="de"><s style={{ background: "#3C6FD8" }} />Standup<em>9:00</em></div>
        <div className="de"><s style={{ background: "#E08A2E" }} />Coffee with Mira<em>15:00</em></div>
        <div className="de"><s style={{ background: BERRY }} />Design review<em>16:00</em></div></div>
      <div className="dw" style={rowStyle?.(2)}><div className="dwh">Money</div><div className="dms"><div><small>Outstanding</small><b>$4,300</b></div><div><small>Paid</small><b>$6,000</b></div></div></div>
      <div className="dw" style={rowStyle?.(3)}><div className="dwh">Habits <em>1/3</em></div>
        <div className="dh2"><i className="on" />Morning walk<em>12</em></div><div className="dh2"><i />Inbox to zero<em>4</em></div><div className="dh2"><i />Read 20 minutes<em>0</em></div></div>
      <div className="dw" style={rowStyle?.(4)}><div className="dwh">Clients</div>
        <div className="dcl"><Face k="p3" className="dface2" />Meridian Studio<em className="dtag g">Active</em></div>
        <div className="dcl"><Face k="p5" className="dface2" />Fernwood Hotels<em className="dtag r">Overdue</em></div></div>
    </section>
  </div>
);

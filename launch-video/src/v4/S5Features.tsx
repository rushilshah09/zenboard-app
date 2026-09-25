/**
 * Scene 5 · Features (0:28–0:40). Equator-style split: the feature list steps on the left (active pill in
 * Berry), and on the right each feature gets its own dark-to-light field, a frosted tinted card with real
 * content and a white card floating over its corner. 8 features × 1.5s. Storyboard 5.1–5.8.
 */
import React from "react";
import { useCurrentFrame } from "remotion";
import { At, BERRY, CURVE, Face, Frame, Icon, Mark, Lockup, INK, PAPER, blurIn, ease, mix, pop, soft } from "./kit";
import { IconName } from "./icons.generated";

type Feat = { name: string; icon: IconName; bg: string; fg: string; d: string; m: string; l: string; tone: string };
export const FEATS: Feat[] = [
  { name: "Tasks", icon: "check-square", bg: "#E3EEDD", fg: "#2F5A27", d: "#3E0825", m: "#9E1458", l: "#E48AB7", tone: "#4A0A2C" },
  { name: "Projects", icon: "kanban", bg: "#E3EEDD", fg: "#2F5A27", d: "#16300F", m: "#3C6A2E", l: "#9DC08A", tone: "#1C3A14" },
  { name: "Docs", icon: "file-text", bg: "#DDEFF5", fg: "#1C5A70", d: "#171A4A", m: "#3F48A0", l: "#AEB3EE", tone: "#1E2257" },
  { name: "Calendar", icon: "calendar-blank", bg: "#F5EFD2", fg: "#6B5A12", d: "#0B3140", m: "#23708A", l: "#9BD0E1", tone: "#0F3A4A" },
  { name: "Clients", icon: "users-three", bg: "#F6E1EA", fg: "#8A2E57", d: "#40190A", m: "#A0542A", l: "#EDBB93", tone: "#4A220C" },
  { name: "Money", icon: "currency-circle-dollar", bg: "#E3EEDD", fg: "#2F5A27", d: "#2E2806", m: "#7E6F1A", l: "#E0CF84", tone: "#3A3208" },
  { name: "Habits", icon: "plant", bg: "#F6E1EA", fg: "#8A2E57", d: "#3F1128", m: "#96406B", l: "#E6ADC6", tone: "#4A1530" },
  { name: "Focus", icon: "timer", bg: "#E7EAEC", fg: "#46505A", d: "#15181C", m: "#46505A", l: "#BCC3CA", tone: "#1B1E22" },
];
const STEP = 90;

const Chip: React.FC<{ c?: string; children: React.ReactNode }> = ({ c = "", children }) => <span className={`fchip ${c}`}>{children}</span>;
const FF: React.FC<{ k: "p1" | "p2" | "p3" | "p4" | "p5" }> = ({ k }) => <Face k={k} className="fface" />;
const Hd: React.FC<{ t: string; children?: React.ReactNode }> = ({ t, children }) => <div className="fh2"><h4>{t}</h4>{children}</div>;
const Row: React.FC<{ on?: boolean; dn?: boolean; children: React.ReactNode }> = ({ on, dn, children }) => <div className={`fl${dn ? " dn" : ""}`}><i className={on ? "on" : ""} />{children}</div>;
const Avc: React.FC<{ k: "p2" | "p3" | "p4"; bg: string; big?: boolean }> = ({ k, bg, big }) => <span className="avc face" style={{ background: bg, ...(big ? {} : {}) }}><Face k={k} /></span>;

/** The frosted card and the white floating card for one feature. */
const FeatUI: React.FC<{ i: number }> = ({ i }) => {
  const t = FEATS[i].tone, l = FEATS[i].l;
  switch (FEATS[i].name) {
    case "Tasks":
      return (<>
        <Hd t="Today's plan"><Chip>Fri, Sep 25</Chip></Hd>
        <div className="ftabs"><b>Today 3</b><span>Upcoming 8</span><span>Done 1</span></div>
        <Row>Send invoice for July to TechSpark<Chip>TechSpark</Chip><em className="hi">High</em><code>5h</code></Row>
        <Row>Prepare weekly report<Chip>Ops</Chip><em>Medium</em><code>1h</code></Row>
        <Row>Send the Q3 retainer proposal<Chip>Meridian</Chip><em>Medium</em><code>45m</code></Row>
        <Row on dn>Review design feedback<code>30m</code></Row>
        <div className="bars"><span>3 planned</span><span>6h focus</span><span>2h45 meetings</span></div><div className="track"><b style={{ width: "62%" }} /></div>
      </>);
    case "Projects":
      return (<>
        <Hd t="Brand identity"><span className="fstack"><FF k="p3" /><FF k="p4" /><FF k="p2" /></span></Hd>
        <p><Chip>Acme Studio</Chip> <Chip>Due Oct 2</Chip> 5 open · 12 done</p>
        <div className="cols"><span>In progress 3</span><span>In review 2</span><span>Revisions 1</span><span>Done 12</span></div>
        <div className="segs"><b style={{ background: l }} /><b style={{ background: t, opacity: 0.55 }} /><b className="knob" style={{ background: t }} /><b style={{ background: "#fff" }} /></div>
        <Row on dn>Moodboard and references<code>Sep 12</code></Row>
        <Row>Logo routes · three directions<Chip>In review</Chip><code>Sep 29</code></Row>
        <Row>Brand guidelines v1<code>Oct 2</code></Row>
        <div className="bars"><span>Progress</span><span>71%</span></div><div className="track"><b style={{ width: "71%" }} /></div>
      </>);
    case "Docs":
      return (<>
        <div className="crumb">Acme Studio / Proposals</div><Hd t="Rebrand proposal · Acme" />
        <div className="fmeta"><FF k="p4" /> Mara Okafor · edited 2m ago · 6 min read</div>
        <div className="sub">Scope</div>
        <p className="dtext">Acme wants a calmer, warmer identity that works from shop window to invoice.</p>
        <ul className="blt"><li>Route one · quiet serif-free wordmark</li><li>Route two · warm burgundy and cream system</li><li>Route three · playful mark with motion</li></ul>
        <div className="lnk"><Icon name="check-square" size="1em" /> Send the proposal <span>Task · Thu</span></div>
        <div className="chips"><Chip>Proposal</Chip><Chip>Client: Acme</Chip><Chip>Due Thu</Chip><span className="cm2"><Icon name="chat-circle" size="1em" /> 3</span></div>
      </>);
    case "Calendar": {
      const days: [string, number][] = [["Mon", 21], ["Tue", 22], ["Wed", 23], ["Thu", 24], ["Fri", 25], ["Sat", 26], ["Sun", 27]];
      const ev = (c: string, b: string, sm: React.ReactNode, e: string) => <div className="evr"><s style={{ background: c }} /><div><b>{b}</b><small>{sm}</small></div><em>{e}</em></div>;
      return (<>
        <Hd t="Friday, Sep 25"><Chip>Week 39</Chip></Hd>
        <div className="wkstrip">{days.map(([d, n]) => <span key={d} className={d === "Fri" ? "on" : ""}><small>{d}</small>{n}{d === "Tue" || d === "Fri" ? <i /> : null}</span>)}</div>
        {ev(t, "Standup", "Team · Zoom", "9:00–9:30")}
        {ev(l, "Focus block · proposal", "Zenboard Focus", "10:00–12:00")}
        {ev(l, "Coffee with Mira", "Fieldhouse café", "15:00–15:45")}
        {ev(t, "Design review", <><FF k="p3" /><FF k="p4" /> Meridian Studio</>, "16:00–18:00")}
      </>);
    }
    case "Clients":
      return (<>
        <div className="fh2"><span className="clogo">MS</span><h4>Meridian Studio</h4><Chip c="ok">Active</Chip><Chip c="ok">Healthy</Chip></div>
        <div className="fmeta"><FF k="p3" /> Sarah Chen · Head of Brand · sarah@meridian.co</div>
        <div className="st3"><div><span>Billed</span><b>$7,000</b></div><div><span>Outstanding</span><b>$2,800</b></div><div><span>Client since</span><b>Mar 2025</b></div></div>
        <div className="sub">Projects</div>
        <div className="prj"><i style={{ background: BERRY }} />Brand identity<span className="pbar"><b style={{ width: "71%" }} /></span><code>5 open</code></div>
        <div className="prj"><i style={{ background: "#3C6FD8" }} />Website rebuild<span className="pbar"><b style={{ width: "38%" }} /></span><code>3 open</code></div>
        <div className="nstep"><span>Next step · Send the Q3 retainer proposal</span><span className="btn g">Make it a task</span></div>
      </>);
    case "Money":
      return (<>
        <Hd t="Money"><Chip>Sep 2026</Chip></Hd>
        <div className="st3"><div><span>Unbilled</span><b>$650</b></div><div><span>Outstanding</span><b>$4,300</b></div><div><span>Paid</span><b>$6,000</b></div></div>
        <div className="mchart">{[38, 52, 44, 61, 58, 73, 66, 84, 92].map((h, k) => <b key={k} style={{ height: `${h}%` }} />)}</div>
        <div className="ir"><span>INV-021</span>Meridian Studio<Chip>Draft</Chip><b>$3,200</b></div>
        <div className="ir"><span>INV-019</span>Fernwood Hotels<Chip c="bad">Overdue</Chip><b>$1,500</b></div>
        <div className="ir"><span>INV-018</span>Atlas Coffee<Chip c="ok">Paid</Chip><b>$4,200</b></div>
      </>);
    case "Habits":
      return (<>
        <Hd t="Habits"><Chip>1 of 3 today</Chip></Hd>
        <div className="sub">Morning</div>
        <Row on>Morning walk<em><Icon name="fire" size="1em" /> 12</em></Row>
        <Row>Meditate<em><Icon name="fire" size="1em" /> 12</em></Row>
        <div className="sub">Evening</div>
        <Row>Read 20 minutes<em><Icon name="fire" size="1em" /> 0</em></Row>
        <Row>No screens after 10pm<Chip>Skipped</Chip></Row>
        <div className="hgrid">{Array.from({ length: 14 }, (_, k) => <i key={k} className={k === 3 || k === 9 ? "" : "on"} />)}</div>
        <div className="bars"><span>Last 14 days</span><span>86% kept</span></div>
      </>);
    default:
      return (<>
        <Hd t="Focus session"><Chip>Session 2 of 4</Chip></Hd>
        <div className="fcols">
          <div className="timer"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="3" /><circle cx="20" cy="20" r="16" fill="none" stroke={t} strokeWidth="3" strokeLinecap="round" strokeDasharray="70 101" transform="rotate(-90 20 20)" /></svg><b>18:42</b></div>
          <div className="fside"><small>Working on</small><b>Send invoice for July to TechSpark</b><div className="chips"><Chip>TechSpark</Chip><Chip>High</Chip></div><small>Sound</small><span className="snd"><Icon name="speaker-high" size="1em" /> Rain on glass</span></div>
        </div>
        <div className="sdots"><i className="on" /><i className="on" /><i /><i /><span>25 min focus · 5 min break</span></div>
      </>);
  }
};

const Float: React.FC<{ i: number }> = ({ i }) => {
  switch (FEATS[i].name) {
    case "Tasks": return <><small>Today&apos;s highlight</small><b>Send invoice for July to TechSpark</b><div className="fb"><span className="btn"><Icon name="play" size="1em" /> Start focus</span><span className="btn g"><Icon name="check" weight="bold" size="1em" /> Mark done</span></div></>;
    case "Projects": return <div className="avs"><Avc k="p3" bg={BERRY} /><Avc k="p4" bg="#3C6A2E" /><Avc k="p2" bg="#A0542A" /><span className="srch"><Icon name="magnifying-glass" weight="regular" size="48%" /></span></div>;
    case "Docs": return <div className="cm"><Avc k="p4" bg={BERRY} /><div><small>Mara Okafor · comment</small><b>Love route two. Approved.</b></div></div>;
    case "Calendar": return <><small>Next · in 20 min</small><b>Design review</b><div className="fb"><span className="btn">Join</span><span className="btn g">16:00–18:00</span></div></>;
    case "Clients": return <div className="cm"><Avc k="p3" bg="#A0542A" /><div><small>Client portal · Sarah Chen</small><b>Proposal approved</b></div></div>;
    case "Money": return <><small>INV-018 · Atlas Coffee</small><b className="bigp">$4,200</b><div className="fb"><span className="btn ok"><Icon name="check-circle" size="1em" /> Paid</span></div></>;
    case "Habits": return <><small>Morning walk</small><b className="bigp">12-day streak</b></>;
    default: return <><small>Blocking</small><b>Slack, Mail, X</b><div className="fb"><span className="btn"><Icon name="pause" size="1em" /> Pause</span></div></>;
  }
};

export const S5Features: React.FC = () => {
  const f = useCurrentFrame();
  // continuous list position: steps with a soft spring every STEP frames
  let pos = 0;
  for (let k = 1; k < FEATS.length; k++) pos += soft(f, k * STEP, 170, 24);
  const active = Math.min(FEATS.length - 1, Math.floor((f + 6) / STEP));
  const out = ease(f, 690, 720, 0, 1, CURVE.glide); // hand-off: panel fills the frame for the automation scene
  return (
    <Frame>
      <div className="stage" style={{ background: PAPER }} />
      {/* left: feature list */}
      <div className="stage" style={{ opacity: 1 - out }}>
        <At x={4.5} y={3.6} style={{ transform: "translate(0,-50%)", ...blurIn(f, 6, 10) }}><Lockup width={8} color={INK} /></At>
        {Array.from({ length: 12 }, (_, j) => {
          const k = j - 2; // feature index (can run past the ends for continuity)
          const rel = k - pos;
          if (Math.abs(rel) > 4.2) return null;
          const idx = ((k % 8) + 8) % 8;
          const on = k === active;
          const op = on ? 1 : Math.max(0.22, 1 - Math.abs(rel) * 0.2);
          const enter = pop(f, 4 + Math.abs(j - 2) * 3, 200, 18);
          return (
            <At key={j} x={4.5} y={56.25 / 2 - 1.5 + rel * 5.3} style={{ transform: `translate(0,-50%) scale(${0.96 + 0.04 * enter})`, opacity: op * enter }}>
              <div className={`fp${on ? " on" : ""}`}>
                <span className="pico" style={{ width: "2.5cqw", height: "2.5cqw", background: FEATS[idx].bg, color: FEATS[idx].fg }}><Icon name={FEATS[idx].icon} weight="duotone" size="58%" /></span>
                {FEATS[idx].name}
              </div>
            </At>
          );
        })}
      </div>
      {/* right: field + cards per feature, crossfading on each step */}
      <div className="rpanel" style={{ left: `${38 * (1 - out)}%`, top: `${3 * (1 - out)}%`, right: `${2.2 * (1 - out)}%`, bottom: `${3 * (1 - out)}%`, borderRadius: `${2 * (1 - out)}cqw` }}>
        {FEATS.map((F, i) => {
          const inP = i === 0 ? 1 : soft(f, i * STEP - 2, 150, 24);
          const outP = i === FEATS.length - 1 ? 0 : soft(f, (i + 1) * STEP - 2, 170, 24);
          if (inP < 0.001 || outP > 0.999) return null;
          const card = i === 0 ? 1 : soft(f, i * STEP + 2, 160, 20);
          const fl = pop(f, i * STEP + (i === 0 ? 10 : 8), 220, 15);
          return (
            <div key={F.name} className="stage" style={{ opacity: inP }}>
              <div className="stage" style={{ background: `radial-gradient(130% 120% at 100% 100%,${F.l} 0%,${F.m} 38%,${F.d} 100%)` }} />
              <At x={84 - f / 90} y={45} className="lobes"><Mark size={46} color="#fff" /></At>
              <At x={58 + f / 120} y={4} className="lobes"><Mark size={30} color="#fff" /></At>
              <div className="tcard" style={mix({ color: F.tone, ["--tone" as string]: F.tone, ["--light" as string]: F.l, transform: `translateY(${(1 - card) * 5 - outP * 4}cqw) scale(${1 + 0.02 * Math.sin(Math.PI * card)})`, opacity: Math.min(1, card * 1.5) * (1 - outP), filter: `blur(${(1 - Math.min(1, card)) * 8 + outP * 6}px)` })}>
                <FeatUI i={i} />
              </div>
              <div className="fcard" style={{ ["--tone" as string]: F.tone, transform: `scale(${0.8 + 0.2 * fl}) translateY(${(1 - fl) * 1.5}cqw)`, opacity: Math.min(1, fl * 1.5) * (1 - outP), transformOrigin: "80% 20%" }}>
                <Float i={i} />
              </div>
            </div>
          );
        })}
      </div>
    </Frame>
  );
};

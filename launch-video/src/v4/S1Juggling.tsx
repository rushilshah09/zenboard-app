/**
 * Scene 1 · Juggling (0:00–0:10). One person at the centre, the apps they juggle popping onto rings,
 * badges climbing, messages piling up. Ref: Flike opener. Storyboard 1.1–1.3.
 */
import React from "react";
import { useCurrentFrame } from "remotion";
import { At, BERRY, CURVE, Face, Frame, Halftone, Icon, PaperStage, Words, blurIn, ease, mix, pop, s } from "./kit";
import { IconName } from "./icons.generated";

export type Kind = "mail" | "chat" | "tasks" | "docs" | "crm" | "cal" | "money" | "notes";
export const KIND: Record<Kind, [IconName, string, string, string]> = {
  mail: ["envelope", "#F6E4D6", "#8A4A1E", "Mail"],
  chat: ["chat-circle-dots", "#E6E7FA", "#3A3F8F", "Chat"],
  tasks: ["check-square", "#E3EEDD", "#2F5A27", "Tasks"],
  docs: ["file-text", "#DDEFF5", "#1C5A70", "Docs"],
  crm: ["users-three", "#F6E1EA", "#8A2E57", "CRM"],
  cal: ["calendar-blank", "#F5EFD2", "#6B5A12", "Calendar"],
  money: ["currency-circle-dollar", "#E3EEDD", "#2F5A27", "Invoices"],
  notes: ["note-pencil", "#F1ECE1", "#6B5B3E", "Notes"],
};
export const KINDS: Kind[] = ["mail", "chat", "tasks", "docs", "crm", "cal", "money", "notes"];

export const Tile: React.FC<{ kind: Kind; size?: number; badge?: number | null; label?: boolean; style?: React.CSSProperties }> = ({ kind, size = 6.2, badge, label, style }) => {
  const [icon, bg, fg, name] = KIND[kind];
  return (
    <div className="tile" style={{ width: `${size}cqw`, height: `${size}cqw`, ["--bg" as string]: bg, color: fg, ...style }}>
      <Icon name={icon} weight="fill" size="46%" />
      {badge ? <span className="badge">{badge}</span> : null}
      {label ? <span className="tlabel">{name}</span> : null}
    </div>
  );
};

export const Chip: React.FC<{ t: string; n?: string; dot?: string }> = ({ t, n, dot = BERRY }) => (
  <span className="chip"><i style={{ background: dot }} />{t}{n ? <em>{n}</em> : null}</span>
);
const FACE: Record<string, "p1" | "p2" | "p3" | "p4" | "p5"> = { Mara: "p4", Sarah: "p3", David: "p1", James: "p2", Fernwood: "p5" };
export const Msg: React.FC<{ name: string; t: string; w?: number; when?: string }> = ({ name, t, w = 16, when = "2m" }) => (
  <div className="msg" style={{ width: `${w}cqw` }}>
    <Face k={FACE[name.replace("To: ", "").split(" ")[0]]} className="mav face" />
    <div><b>{name}<small>{when}</small></b><span>{t}</span></div>
  </div>
);

const CY = 56.25 / 2;
export const Rings: React.FC<{ radii: number[]; appear: (i: number) => number; spin?: number }> = ({ radii, appear, spin = 0 }) => (
  <>
    {radii.map((r, i) => {
      const p = appear(i);
      return (
        <At key={i} x={50} y={CY} className="ring" style={{
          width: `${2 * r}cqw`, height: `${2 * r}cqw`, borderStyle: i === 0 ? "dashed" : "solid",
          opacity: Math.min(1, p * 1.2), transform: `scale(${0.82 + 0.18 * p}) rotate(${i === 0 ? spin : 0}deg)`,
        }} />
      );
    })}
  </>
);

export const Portrait: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <At x={50} y={CY} className="portrait" style={{ width: `${size}cqw`, height: `${size}cqw`, ...style }}>
    <div className="lobe-halo" />
    <div className="lobe"><Face k="portrait" /></div>
  </At>
);

/** Ring layout: 8 slots, blended between the calm (1.2) and overloaded (1.3) layouts. */
export const ringPos = (i: number, t: number, orbit: number) => {
  const r = 19.5 + (22 - 19.5) * t;
  const squash = 0.95 + (0.86 - 0.95) * t;
  const start = -90 + 20 * t + orbit;
  const a = ((start + i * 45) * Math.PI) / 180;
  return [50 + r * Math.cos(a), CY + r * squash * Math.sin(a)] as const;
};

const BADGES = [15, 7, null, 19, 4, 20, null, 9];
const EARLY = [null, 3, null, 1, null, 2, null, null];

export const S1Juggling: React.FC = () => {
  const f = useCurrentFrame();
  const over = ease(f, s(4), s(6.2), 0, 1, CURVE.glide); // calm → overload
  const orbit = f * 0.035; // slow drift of the whole ring
  const push = 1 + ease(f, 0, s(10), 0, 0.08, CURVE.breathe) + ease(f, s(4), s(10), 0, 0.04, CURVE.glide);
  const roll = Math.sin(f / 90) * 0.6;
  const portraitIn = pop(f, 12, 170, 13);
  return (
    <Frame>
      <PaperStage glow={0.35 + 0.65 * ease(f, 0, s(4), 0, 1, CURVE.breathe)} />
      <div className="stage" style={{ transform: `scale(${push}) rotate(${roll}deg)` }}>
        <At x={50} y={CY}><Halftone size={44} color={BERRY} opacity={0.045} reveal={ease(f, 0, s(2.5), 0, 1.4, CURVE.settle)} /></At>
        <Rings radii={[11, 17, 24, 31]} spin={f * 0.08} appear={(i) => (i < 2 ? pop(f, 4 + i * 8, 120, 20) : i === 2 ? pop(f, s(1.6), 120, 20) : pop(f, s(4.4), 120, 20))} />
        {KINDS.map((k, i) => {
          const at = i < 6 ? s(1.5) + i * 30 : s(4.6) + (i - 6) * 20; // on the beat, then the last two join the overload
          const p = pop(f, at, 210, 14);
          const [x, y] = ringPos(i, over, orbit);
          const n = BADGES[i];
          const badge = over > 0.05 && n ? Math.max(1, Math.round((EARLY[i] ?? 0) + (n - (EARLY[i] ?? 0)) * ease(f, s(4.4) + i * 8, s(7.5), 0, 1))) : f > at + 20 ? EARLY[i] : null;
          const far = i === 1 || i === 6 ? over * 0.25 : 0;
          const size = i % 3 ? 6.2 - 0.4 * over : 6.2 + 0.4 * over;
          return (
            <At key={k} x={x} y={y} style={{ opacity: Math.min(1, p * 1.3), transform: `scale(${p})`, filter: far ? `blur(${far}cqw)` : undefined }}>
              <Tile kind={k} size={size} badge={badge} label={over < 0.5} style={{ ["--lab" as string]: 1 - over * 2 }} />
            </At>
          );
        })}
        {/* the pile-up: chips and messages, staggered like a feed arriving */}
        <At x={24} y={11} className="stack" style={mix(blurIn(f, s(5.0), 24))}><Chip t="Email" n="12" dot="#ECBF9B" /><Msg name="To: Mara · Acme" t="Following up on the proposal…" when="now" /></At>
        <At x={77} y={14} className="stack" style={mix(blurIn(f, s(5.4), 24))}><Chip t="Pending follow-ups" n="3" dot="#B8BDEE" /><Msg name="Sarah" t="Any update on the invoice?" when="4m" /><div style={blurIn(f, s(6.3), 16)}><Msg name="David" t="Where's the latest file?" when="9m" /></div></At>
        <At x={76} y={44} className="stack" style={mix(blurIn(f, s(5.8), 24))}><Chip t="Client chats" n="19" dot="#A6D1E0" /><Msg name="James" t="Quick check-in, any news?" when="1m" /></At>
        <At x={21} y={42} className="stack" style={mix(blurIn(f, s(6.2), 24))}><Chip t="Invoice overdue" n="6d" dot={BERRY} /><Msg name="Fernwood Hotels" t="INV-019 · $1,500 · 6 days late" w={17} when="6d" /></At>
        <Portrait size={14 - 0.5 * over} style={{ transform: `scale(${0.9 + 0.1 * portraitIn})`, opacity: Math.min(1, portraitIn * 1.5) }} />
      </div>
      <At x={50} y={53.2}><Words f={f} at={s(2.2)} exitAt={s(4.8)} text="Your work lives in eight apps." style={{ fontSize: "2.6cqw" }} /></At>
      <At x={50} y={53.2}><Words f={f} at={s(6.4)} text="And you live in all of them." style={{ fontSize: "2.6cqw" }} /></At>
    </Frame>
  );
};

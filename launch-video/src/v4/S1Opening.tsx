/**
 * Opening (0:00–0:17.5): scenes 1 and 2 as one continuous movement. Storyboard 1.1–2.5.
 *
 * Build → accelerate → reveal → breathe:
 *   the person lands, the apps arrive on the beat and orbit (1.1–1.2); the feed piles up while the orbit gathers
 *   momentum and the camera leans in (1.3); each app streaks into a thick arc in its own colour and the ring
 *   tightens around the person (2.1); a Berry line enters from the top right and strikes the ring, which gives,
 *   then spins up (2.2); the arcs merge in pairs, the spin decelerates into place and the four segments curl into
 *   the four lobes of the mark (2.3); the module icons bloom around it and gather back in (2.3–2.4); the mark
 *   glides into the lockup while the wordmark writes itself (2.5), then holds.
 *
 * One motion language: M.inOut travel, settle/lift arrivals, eased angular velocity for every spin.
 */
import React from "react";
import { useCurrentFrame } from "remotion";
import { LOCKUP_MARK } from "../brand/logo.generated";
import { At, BERRY, CURVE, Frame, Halftone, Icon, Lockup, M, Mark, PaperStage, Words, blurIn, bump, ease, lift, mix, ramp, s, settle, spinAt } from "./kit";
import { IconName } from "./icons.generated";
import { Chip, KINDS, Msg, Portrait, Rings, Tile } from "./S1Juggling";

const CY = 56.25 / 2;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ---------- the orbit's angular velocity (degrees per frame), eased between speeds ---------- */
const omega = (t: number) =>
  0.04 * ramp(t, s(1.5), s(3.5)) + // the apps start to drift
  0.21 * ramp(t, s(4.4), s(8)) + // the feed piles up
  1.25 * ramp(t, s(8), s(10)) + // tension: the orbit accelerates
  -0.9 * ramp(t, s(10), s(11.2)) + // breathe: it coasts around the person
  3.9 * ramp(t, s(11.8), s(12.3)) + // the strike transfers its momentum
  -4.5 * ramp(t, s(12.4), s(13.5)); // and the ring decelerates into place
// every pair of arcs must finish on one of the mark's diagonals: tile i sits at -70 + orbit + 45i
const RAW_END = spinAt(s(13.6), omega);
const CORR = (((2.5 - RAW_END) % 90) + 90) % 90;
const orbitAt = (f: number) => {
  const u = clamp01((f - s(13.1)) / s(0.8));
  const overshoot = 4 * Math.sin(Math.PI * u) * (1 - u); // follow-through: a hair past, then settle
  return spinAt(f, omega) + CORR * ramp(f, s(11.9), s(12.7)) + overshoot;
};

/* ---------- mark geometry (Mark/GMark use a 34-unit viewBox; lobes: centre ±8.6u, radius 7.4u) ---------- */
const MARK_W = 8.95; // cqw across 34 units → 32 units = the lockup's mark (8.42cqw)
const U = MARK_W / 34;
const LOBE_D = Math.SQRT2 * 8.6 * U; // centre → lobe centre
const LOBE_R = 7.4 * U;

const ARC_COLOR = ["#E8A06B", "#8C94E0", "#7FB26B", "#6FB3CC", "#E07AAE", "#D9B84A", BERRY, "#A99BE6"];
const ARC_LEN = [34, 22, 30, 26, 38, 24, 42, 28];

const RING: [IconName, string, string][] = [
  ["check-square", "#2F9E6B", "Tasks"], ["envelope-simple", "#E0523F", "Mail"], ["calendar-blank", "#3C6FD8", "Calendar"],
  ["file-text", "#1C5A70", "Docs"], ["kanban", "#C41C72", "Projects"], ["users-three", "#E08A2E", "Clients"],
  ["currency-circle-dollar", "#2F9E6B", "Money"], ["plant", "#C9A21F", "Habits"], ["timer", "#6E63D9", "Focus"], ["lightning", "#C41C72", "Automations"],
];
const POS = [[-1, -1], [0, -1], [1, -1], [1, -0.35], [1, 0.35], [1, 1], [0, 1], [-1, 1], [-1, 0.35], [-1, -0.35]];
const shape = (ic: IconName) => (["file-text", "check-square", "plant"].includes(ic) ? "sheet" : ["timer", "users-three"].includes(ic) ? "circ" : "sq");

const GMark: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <svg viewBox="-1 -1 34 34" style={{ width: `${size}cqw`, height: `${size}cqw`, display: "block", ...style }}><path d={LOCKUP_MARK} fill="url(#zgrad)" /></svg>
);

/** An arc around (cx, cy) with radius r, vertical squash sq, from a0 to a1 degrees, as a sampled path (frame units). */
const arc = (cx: number, cy: number, r: number, sq: number, a0: number, a1: number, n = 36) => {
  let d = "";
  for (let k = 0; k <= n; k++) {
    const a = ((a0 + ((a1 - a0) * k) / n) * Math.PI) / 180;
    d += `${k ? "L" : "M"}${(cx + r * Math.cos(a)).toFixed(3)} ${(cy + r * sq * Math.sin(a)).toFixed(3)}`;
  }
  return d;
};

const BADGES = [15, 7, null, 19, 4, 20, null, 9];
const EARLY = [null, 3, null, 1, null, 2, null, null];

export const S1Opening: React.FC = () => {
  const f = useCurrentFrame();
  const orbit = orbitAt(f);

  /* ---- layout of the orbit ---- */
  const over = ease(f, s(4), s(6.2), 0, 1, CURVE.glide); // calm (1.2) → overload (1.3)
  const tight = ramp(f, s(9.4), s(10.8)); // the ring tightens around the person
  const R =
    lerp(19.5 + 2.5 * over, 9, tight) - // orbit radius
    0.9 * bump(f, s(11.8), s(11.93), s(12.2)) + // the ring gives on impact
    (LOBE_D - 9) * ramp(f, s(12), s(12.9)); // then contracts to the lobes
  const sq = lerp(0.95 - 0.09 * over, 1, tight);
  const toArc = ramp(f, s(9.2), s(10.2)); // tiles streak into arcs

  /* ---- camera: lean in while the tension builds, pull back for the reveal ---- */
  const push = 1 + 0.06 * ramp(f, 0, s(9.4)) + 0.05 * ramp(f, s(8.4), s(10.4)) - 0.11 * ramp(f, s(11.9), s(13.4));
  const near = 1 + (push - 1) * 1.6; // the feed sits closer to camera (parallax)

  /* ---- the strike ---- */
  const contactDeg = -40;
  const cxC = 50 + 9 * Math.cos((contactDeg * Math.PI) / 180), cyC = CY + 9 * Math.sin((contactDeg * Math.PI) / 180);
  const sx = cxC + 46 * Math.cos((contactDeg * Math.PI) / 180), sy = cyC + 46 * Math.sin((contactDeg * Math.PI) / 180); // just off the top-right corner
  const head = M.in(clamp01((f - s(11.0)) / s(0.8))); // enters from the corner and accelerates into the ring
  const tail = ease(f, s(11.3), s(12.05), 0, 1, M.inOut); // then is absorbed
  const P = (u: number) => [sx + (cxC - sx) * u, sy + (cyC - sy) * u] as const;
  const [ax, ay] = P(tail), [bx, by] = P(head);
  const lineOn = f >= s(11.0) && tail < 0.999;
  const impact = bump(f, s(11.8), s(11.9), s(12.4));

  /* ---- arcs → lobes → mark ---- */
  const merge = ramp(f, s(12.05), s(12.7));
  const curl = ramp(f, s(12.55), s(13.4));
  const markIn = ramp(f, s(13.35), s(13.7));
  const W0 = 1.0 + 0.35 * impact;
  const arcs: React.ReactNode[] = [];
  if (toArc > 0 && markIn < 1) {
    for (let k = 0; k < 4; k++) {
      const psi = -70 + orbit + 90 * k + 22.5; // the pair's centre angle
      for (const j of [0, 1]) {
        const i = 2 * k + j;
        const op = j === 1 ? 1 - ramp(f, s(12.35), s(12.75)) : 1;
        if (op <= 0.001) continue;
        const th = psi + (j ? 22.5 : -22.5) * (1 - merge);
        const L = ARC_LEN[i] * toArc * 0.85 + (j === 0 ? ARC_LEN[i + 1] * 0.6 * merge : 0);
        const w = W0 * toArc;
        let d: string, width: number;
        if (curl <= 0 || j === 1) {
          d = arc(50, CY, R, sq, th - L / 2, th + L / 2);
          width = w;
        } else {
          // curl around the arc's own midpoint into a lobe: the centre travels out, the radius shrinks, the sweep closes
          const ux = Math.cos((psi * Math.PI) / 180), uy = Math.sin((psi * Math.PI) / 180);
          const ccx = 50 + ux * LOBE_D * curl, ccy = CY + uy * LOBE_D * curl;
          const rho = lerp(R, LOBE_R / 2, curl);
          const sweep = lerp(L, 360, curl);
          d = arc(ccx, ccy, rho, 1, psi - sweep / 2, psi + sweep / 2, 48);
          width = lerp(w, LOBE_R * 1.06, curl);
        }
        arcs.push(<path key={i} d={d} fill="none" stroke={ARC_COLOR[i]} strokeWidth={width} strokeLinecap="round" opacity={op * (1 - markIn)} />);
      }
    }
  }

  /* ---- the person ---- */
  const portraitIn = lift(f, 12, 50);
  const pOut = ease(f, s(11.95), s(12.6), 0, 1, M.inOut);

  /* ---- icons bloom around the mark, then gather back in ---- */
  const gather = ease(f, s(15.05), s(15.45), 0, 1, M.in);
  const sp = 15;

  /* ---- lockup ---- */
  const glide = ease(f, s(15.45), s(16.2), 0, 1, M.inOut);
  const toBerry = ramp(f, s(15.5), s(15.95));
  const inhale = 1 - 0.07 * ramp(f, s(15.05), s(15.4)) + 0.07 * ramp(f, s(15.4), s(15.75));
  const markSize = lerp(MARK_W, 8.4, glide);
  const mx = lerp(50, 34.2, glide), my = lerp(CY, 24.5, glide);
  const reveal = ease(f, s(15.7), s(16.4), 0, 1, M.out);

  const glow = 0.35 + 0.65 * ramp(f, 0, s(4)) * (1 - 0.7 * ramp(f, s(11.9), s(13.4)));
  return (
    <Frame>
      <PaperStage glow={glow} />
      <div className="stage" style={{ transform: `scale(${push})` }}>
        <At x={50} y={CY} style={{ opacity: 1 - ramp(f, s(10), s(12)) }}>
          <Halftone size={44} color={BERRY} opacity={0.045} reveal={ease(f, 0, s(2.5), 0, 1.4, CURVE.settle)} />
        </At>
        <div className="stage" style={{ opacity: 1 - ramp(f, s(9.2), s(10.2)) }}>
          <Rings radii={[11, 17, 24, 31]} spin={0}
            appear={(i) => (i < 2 ? settle(f, 4 + i * 14, 50) : i === 2 ? settle(f, s(1.6), 50) : settle(f, s(4.4), 50))} />
        </div>
        {/* the apps: they arrive on the beat along their orbit, then streak into arcs */}
        {KINDS.map((k, i) => {
          const at = i < 6 ? s(1.5) + i * 30 : s(4.6) + (i - 6) * 20;
          const p = lift(f, at, 44);
          if (p <= 0.001 || toArc >= 1) return null;
          const a = ((-90 + 20 * over + orbit + 45 * i) * Math.PI) / 180;
          const r = R - 2.5 * (1 - p);
          const x = 50 + r * Math.cos(a), y = CY + r * sq * Math.sin(a);
          const n = BADGES[i];
          const badge = f > s(8.9) ? null : over > 0.05 && n ? Math.max(1, Math.round((EARLY[i] ?? 0) + (n - (EARLY[i] ?? 0)) * ease(f, s(4.4) + i * 8, s(7.5), 0, 1))) : f > at + 20 ? EARLY[i] : null;
          const far = i === 1 || i === 6 ? over * 0.25 : 0;
          const size = i % 3 ? 6.2 - 0.4 * over : 6.2 + 0.4 * over;
          const speedBlur = Math.min(0.5, omega(f) * 0.25);
          return (
            <At key={k} x={x} y={y} style={{
              opacity: Math.min(1, p * 1.3) * (1 - toArc),
              transform: `scale(${(0.6 + 0.4 * p) * (1 - 0.65 * toArc)})`,
              filter: far + speedBlur + toArc * 0.4 > 0.01 ? `blur(${far + speedBlur + toArc * 0.4}cqw)` : undefined,
            }}>
              <Tile kind={k} size={size} badge={badge} label={over < 0.5} style={{ ["--lab" as string]: 1 - over * 2 }} />
            </At>
          );
        })}
        {/* the pile-up: a feed arriving, then drifting past the camera as the orbit takes over */}
        <div className="stage" style={{ transform: `scale(${near / push})`, opacity: 1 - ramp(f, s(8.4), s(9.6)), filter: f > s(8.4) ? `blur(${0.5 * ramp(f, s(8.4), s(9.6))}cqw)` : undefined }}>
          <At x={24} y={11} className="stack" style={mix(blurIn(f, s(5.0), 24))}><Chip t="Email" n="12" dot="#ECBF9B" /><Msg name="To: Mara · Acme" t="Following up on the proposal…" when="now" /></At>
          <At x={77} y={14} className="stack" style={mix(blurIn(f, s(5.4), 24))}><Chip t="Pending follow-ups" n="3" dot="#B8BDEE" /><Msg name="Sarah" t="Any update on the invoice?" when="4m" /><div style={blurIn(f, s(6.3), 16)}><Msg name="David" t="Where's the latest file?" when="9m" /></div></At>
          <At x={76} y={44} className="stack" style={mix(blurIn(f, s(5.8), 24))}><Chip t="Client chats" n="19" dot="#A6D1E0" /><Msg name="James" t="Quick check-in, any news?" when="1m" /></At>
          <At x={21} y={42} className="stack" style={mix(blurIn(f, s(6.2), 24))}><Chip t="Invoice overdue" n="6d" dot={BERRY} /><Msg name="Fernwood Hotels" t="INV-019 · $1,500 · 6 days late" w={17} when="6d" /></At>
        </div>
        <Portrait size={14 - 0.5 * over - 1.2 * tight}
          style={{ transform: `scale(${(0.9 + 0.1 * portraitIn) * (1 - 0.4 * pOut)})`, opacity: Math.min(1, portraitIn * 1.5) * (1 - pOut), filter: pOut > 0.01 ? `blur(${pOut * 10}px)` : undefined }} />
        {/* arcs, the strike, the lobes */}
        <svg className="stage" viewBox="0 0 100 56.25" style={{ overflow: "visible" }}>
          {arcs}
          {lineOn ? <line x1={ax} y1={ay} x2={bx} y2={by} stroke={BERRY} strokeWidth={1.0} strokeLinecap="round" /> : null}
          {impact > 0 ? <circle cx={cxC} cy={cyC} r={0.6 + 5 * ease(f, s(11.8), s(12.4), 0, 1, M.out)} fill="none" stroke={BERRY} strokeWidth={0.15} opacity={1 - ease(f, s(11.8), s(12.4), 0, 1)} /> : null}
        </svg>
      </div>

      {/* the mark forms from the lobes; the modules bloom around it and gather back in */}
      {f > s(13.3) && f < s(15.5) ? (
        <>
          <At x={50} y={CY} style={{ opacity: ramp(f, s(13.8), s(14.3)) * (1 - gather) }}><div className="markhalo" /></At>
          {RING.map(([ic, c, label], i) => {
            const p = lift(f, s(13.8) + i * 3, 44);
            if (p <= 0.001) return null;
            const [u, v] = POS[i];
            const k = p * (1 - gather);
            return (
              <React.Fragment key={ic + i}>
                <At x={50 + u * sp * k} y={CY + v * sp * 0.92 * k} style={{ opacity: Math.min(1, p * 1.4) * (1 - ramp(f, s(15.3), s(15.45))), transform: `scale(${(0.55 + 0.45 * p) * (1 - 0.6 * gather)}) rotate(${gather * 90}deg)` }}>
                  <span className={`ricon ${shape(ic)}`} style={{ ["--c" as string]: c }}><Icon name={ic} weight="fill" size="54%" color="#fff" /></span>
                </At>
                <At x={50 + u * sp} y={CY + v * sp * 0.92 + 3.75} style={{ opacity: ramp(f, s(14.1) + i * 2, s(14.4) + i * 2) * (1 - ramp(f, s(14.9), s(15.1))) }}><span className="rlab">{label}</span></At>
              </React.Fragment>
            );
          })}
        </>
      ) : null}
      {markIn > 0 ? (
        <At x={mx} y={my} style={{ transform: `rotate(${orbit - orbitAt(s(14))}deg) scale(${(0.94 + 0.06 * lift(f, s(13.35), 50)) * inhale})`, filter: markIn < 0.99 ? `blur(${(1 - markIn) * 4}px)` : undefined, opacity: markIn }}>
          <div style={{ position: "relative", width: `${markSize}cqw`, height: `${markSize}cqw` }}>
            <GMark size={markSize} style={{ position: "absolute", inset: 0, opacity: 1 - toBerry }} />
            <Mark size={markSize} style={{ position: "absolute", inset: 0, opacity: toBerry }} />
          </div>
        </At>
      ) : null}
      {/* the wordmark writes itself beside the mark */}
      {f >= s(15.6) ? (
        <>
          <At x={50} y={24.5}>
            <div style={{ clipPath: `inset(-10% ${(1 - reveal) * 79}% -10% 0)` }}>
              <Lockup width={40} letters={8} markColor="transparent"
                letterStyle={(i) => { const q = settle(f, s(15.75) + i * 3, 40); return { opacity: q, transform: `translateX(${(1 - q) * -10}px)` }; }} />
            </div>
          </At>
          <At x={50} y={33.5} style={mix(blurIn(f, s(16.35), 12))}>
            <span className="withask">with <GMark size={2.6} /> <b>Ask</b></span>
          </At>
        </>
      ) : null}

      <At x={50} y={53.2}><Words f={f} at={s(2.2)} exitAt={s(4.8)} text="Your work lives in eight apps." style={{ fontSize: "2.6cqw" }} /></At>
      <At x={50} y={53.2}><Words f={f} at={s(6.4)} exitAt={s(9.0)} text="And you live in all of them." style={{ fontSize: "2.6cqw" }} /></At>
    </Frame>
  );
};

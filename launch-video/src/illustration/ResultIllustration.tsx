import React from "react";
import { AbsoluteFill } from "remotion";
import { FONT } from "../brand/fonts";
import { GlyphName } from "../brand/glyphs.generated";
import { LOCKUP_MARK } from "../brand/logo.generated";
import { Icon } from "../components/Glyph";

/**
 * "Result" illustration (user reference: a product mark inside concentric
 * rounded squares, with notification and feature cards floating around it).
 * Rebuilt for Zenboard: the glossy berry app icon carries the Zenboard mark,
 * and every card is a real Zenboard moment from the Acme dataset. Designed on
 * a 1200 × 765 grid and rendered at `scale` (2 = 2400 × 1530).
 */
export const ILLO = { w: 1200, h: 765 } as const;

const INK = "#16121A";
const SUB = "#5E5A66";
const MUTED = "#8E8A96";
const LINE = "rgba(166, 19, 97, 0.14)";

const Card: React.FC<{ x: number; y: number; w?: number; children: React.ReactNode }> = ({ x, y, w, children }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
      padding: "13px 18px 13px 14px",
      background: "#FFFFFF",
      borderRadius: 10,
      boxShadow: "0 1px 2px rgba(22, 18, 26, 0.04), 0 8px 24px rgba(22, 18, 26, 0.07)",
      fontFamily: FONT,
    }}
  >
    {children}
  </div>
);

const Round: React.FC<{ bg: string; icon: GlyphName }> = ({ bg, icon }) => (
  <span style={{ width: 32, height: 32, borderRadius: 16, background: bg, display: "grid", placeItems: "center", flexShrink: 0 }}>
    <Icon name={icon} size={16} tint="#FFFFFF" />
  </span>
);

const Tile: React.FC<{ from: string; to: string; icon: GlyphName }> = ({ from, to, icon }) => (
  <span style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${from}, ${to})`, display: "grid", placeItems: "center", flexShrink: 0, boxShadow: "inset 0 1px 0 rgba(255,255,255,.35)" }}>
    <Icon name={icon} size={16} tint="#FFFFFF" fill />
  </span>
);

const Face: React.FC<{ initials: string; bg: string; size?: number; ring?: boolean }> = ({ initials, bg, size = 40, ring }) => (
  <span
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      background: bg,
      color: "#fff",
      display: "inline-grid",
      placeItems: "center",
      fontFamily: FONT,
      fontWeight: 600,
      fontSize: size * 0.36,
      flexShrink: 0,
      boxShadow: ring ? "0 0 0 2px #fff" : undefined,
    }}
  >
    {initials}
  </span>
);

const Title: React.FC<{ children: React.ReactNode }> = ({ children }) => <div style={{ fontSize: 14.5, fontWeight: 500, color: INK, letterSpacing: "-0.005em", lineHeight: 1.3, whiteSpace: "nowrap" }}>{children}</div>;
const Sub: React.FC<{ children: React.ReactNode }> = ({ children }) => <div style={{ fontSize: 12.5, color: SUB, marginTop: 4, lineHeight: 1.4 }}>{children}</div>;
const Time: React.FC<{ children: React.ReactNode }> = ({ children }) => <div style={{ fontSize: 10.5, color: MUTED, whiteSpace: "nowrap", marginLeft: 20 }}>{children}</div>;

/** The glossy Zenboard app icon. */
const AppIcon: React.FC<{ x: number; y: number; s: number }> = ({ x, y, s }) => (
  <div style={{ position: "absolute", left: x - s / 2, top: y - s / 2, width: s, height: s }}>
    {/* Contact glow. */}
    <div style={{ position: "absolute", left: s * 0.1, right: s * 0.1, bottom: -s * 0.08, height: s * 0.3, borderRadius: "50%", background: "rgba(166, 19, 97, 0.35)", filter: `blur(${s * 0.09}px)` }} />
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: s * 0.26,
        background: "linear-gradient(160deg, #E0428F 0%, #C41C72 42%, #8A0F51 100%)",
        boxShadow: `inset 0 ${s * 0.02}px ${s * 0.02}px rgba(255,255,255,.45), inset 0 -${s * 0.04}px ${s * 0.06}px rgba(70, 4, 38, .55), inset 0 0 0 ${s * 0.012}px rgba(255,255,255,.18), 0 ${s * 0.05}px ${s * 0.12}px rgba(138, 15, 81, .35)`,
        overflow: "hidden",
      }}
    >
      {/* Top gloss. */}
      <div style={{ position: "absolute", left: "6%", right: "6%", top: "3%", height: "46%", borderRadius: `${s * 0.22}px ${s * 0.22}px ${s * 0.5}px ${s * 0.5}px`, background: "linear-gradient(180deg, rgba(255,255,255,.28), rgba(255,255,255,0))" }} />
      {/* Sparkles. */}
      {[
        [0.22, 0.2, 0.06],
        [0.74, 0.3, 0.045],
        [0.3, 0.74, 0.04],
        [0.82, 0.78, 0.05],
      ].map(([px, py, ps], i) => (
        <svg key={i} viewBox="0 0 10 10" width={s * ps} height={s * ps} style={{ position: "absolute", left: `${px * 100}%`, top: `${py * 100}%`, opacity: 0.35 }}>
          <path d="M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z" fill="#fff" />
        </svg>
      ))}
      {/* The Zenboard mark, embossed. */}
      <svg viewBox="0 0 32 32" width={s * 0.54} height={s * 0.54} style={{ position: "absolute", left: s * 0.23, top: s * 0.23, overflow: "visible", filter: `drop-shadow(0 ${s * 0.012}px ${s * 0.02}px rgba(70, 4, 38, .45))` }}>
        <defs>
          <linearGradient id="markFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#FBE3EF" />
          </linearGradient>
        </defs>
        <path d={LOCKUP_MARK} fill="url(#markFill)" />
      </svg>
    </div>
  </div>
);

/** Concentric rounded squares around the icon. */
const Rings: React.FC<{ cx: number; cy: number }> = ({ cx, cy }) => (
  <svg width={ILLO.w} height={ILLO.h} style={{ position: "absolute", inset: 0 }}>
    {[
      [132, 42],
      [182, 64],
      [232, 88],
      [282, 116],
      [332, 150],
    ].map(([half, r], i) => (
      <rect key={i} x={cx - half} y={cy - half} width={half * 2} height={half * 2} rx={r} fill="none" stroke={LINE} strokeWidth={1} opacity={1 - i * 0.12} />
    ))}
  </svg>
);

const Strong: React.FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ color: INK, fontWeight: 500 }}>{children}</span>;

export const ResultIllustration: React.FC<{ scale?: number }> = ({ scale = 2 }) => {
  const cx = 599;
  const cy = 383;
  return (
    <AbsoluteFill style={{ background: "#FFFFFF" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: ILLO.w, height: ILLO.h, transform: `scale(${scale})`, transformOrigin: "0 0", fontFamily: FONT }}>
        {/* A soft floor wash, like the reference. */}
        <div style={{ position: "absolute", left: 60, top: 420, width: 560, height: 300, borderRadius: "50%", background: "radial-gradient(closest-side, rgba(22,18,26,.035), transparent)" }} />
        <div style={{ position: "absolute", left: 20, top: 20, fontSize: 13, color: SUB }}>Result</div>
        <Rings cx={cx} cy={cy} />
        <AppIcon x={cx} y={cy} s={172} />

        {/* Top: a client approval. */}
        <Card x={455} y={57} w={290}>
          <Face initials="MO" bg="linear-gradient(135deg, #7B6FD0, #3F3A5E)" />
          <div style={{ flex: 1 }}>
            <Title>Mara Okafor</Title>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: SUB, marginTop: 4, whiteSpace: "nowrap" }}>
              <Icon name="check" size={13} tint={SUB} /> Approved the proposal
            </div>
          </div>
          <Time>1hr ago</Time>
        </Card>

        {/* Right: an invoice paid. */}
        <Card x={789} y={170} w={214}>
          <Round bg="#55A87C" icon="receipt" />
          <div>
            <Title>Invoice paid</Title>
            <div style={{ fontSize: 12.5, color: SUB, marginTop: 4, whiteSpace: "nowrap" }}>INV-1042 · $1,875.00</div>
          </div>
        </Card>

        {/* Left: an overdue task. */}
        <Card x={180} y={231} w={246}>
          <Round bg="#E5675E" icon="clock" />
          <div>
            <Title>Overdue task</Title>
            <div style={{ fontSize: 12.5, color: SUB, marginTop: 4, whiteSpace: "nowrap" }}>Book accountant · 2 days late</div>
          </div>
        </Card>

        {/* Right: the week's clients. */}
        <Card x={868} y={320} w={292}>
          <span style={{ position: "relative", width: 44, height: 40, flexShrink: 0 }}>
            <span style={{ position: "absolute", left: 16, top: -2 }}>
              <Face initials="AS" bg="linear-gradient(135deg, #D55391, #8A0F51)" size={26} ring />
            </span>
            <span style={{ position: "absolute", left: 0, top: 9 }}>
              <Face initials="LC" bg="linear-gradient(135deg, #6E9CC0, #2F4A6A)" size={18} ring />
            </span>
            <span style={{ position: "absolute", left: 12, top: 22 }}>
              <Face initials="NW" bg="linear-gradient(135deg, #4FA8A4, #1F4E4C)" size={20} ring />
            </span>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Title>Acme, Lumen, Nort…</Title>
            <div style={{ fontSize: 12.5, color: SUB, marginTop: 4, whiteSpace: "nowrap" }}>Feedback is in</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <Time>20min ago</Time>
            <span style={{ display: "flex" }}>
              {[
                ["MO", "#5A4FA0"],
                ["TL", "#2F4A45"],
                ["ID", "#8A6A3A"],
              ].map(([i, c], k) => (
                <span key={i} style={{ marginLeft: k ? -6 : 0 }}>
                  <Face initials={i} bg={c} size={18} ring />
                </span>
              ))}
            </span>
          </div>
        </Card>

        {/* Right: a feature. */}
        <Card x={776} y={468} w={284}>
          <Tile from="#F07AB0" to="#C41C72" icon="sparkle" />
          <div>
            <Title>AI Summaries</Title>
            <Sub>Turns long docs and call notes into clear next steps.</Sub>
          </div>
        </Card>

        {/* Left: a feature. */}
        <Card x={109} y={521} w={284}>
          <Tile from="#B4AEDD" to="#7B6FD0" icon="calendar-dots" />
          <div>
            <Title>Smart Scheduling</Title>
            <Sub>Finds the right time for every task on your calendar.</Sub>
          </div>
        </Card>

        {/* Bottom: a focus session. */}
        <Card x={489} y={677} w={228}>
          <Round bg="#8E8A96" icon="timer" />
          <div>
            <Title>Focus session ended</Title>
            <Sub>
              Deep work <span style={{ color: INK, marginLeft: 6 }}>1:30:00</span>
            </Sub>
          </div>
        </Card>

        {/* The result, in words. */}
        <div style={{ position: "absolute", left: 904, top: 634, width: 280, fontSize: 11.5, lineHeight: 1.5, color: SUB }}>
          As a result of using <Strong>Zenboard</Strong>, founders and small teams keep their <Strong>tasks</Strong>, <Strong>calendar</Strong>, docs, <Strong>clients</Strong> and <Strong>money</Strong> in one connected workspace. Work moves from plan to <Strong>invoice</Strong> without switching tools, so projects move faster and nothing slips, across <Strong>work, life and business</Strong>.
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const ResultIllustration4K: React.FC = () => <ResultIllustration scale={3.2} />;

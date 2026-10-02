import React from "react";
import { FONT, MONO } from "../../brand/fonts";
import { GlyphName } from "../../brand/glyphs.generated";
import { Icon } from "../../components/Glyph";

/**
 * The film's product kit, built from the real Zenboard app's design system
 * ("Paper", app/tokens.generated.css): the dark product surfaces, the ink
 * scale, berry, and the ten label colours with their fill/text pairs. Type is
 * sized up ~1.3× from the app so it reads at 1080p; proportions, radii,
 * hairlines and states follow the app (ds/ui list-row, tag, avatar, priority,
 * kbd). Nothing here is invented per scene: every screen is built from these.
 */
export const app = {
  canvas: "#0B0B0B",
  paper: "#121212",
  paper2: "#1A1A1A",
  paper3: "#232323",
  paper4: "#2C2C2C",
  hairline: "rgba(242, 241, 235, 0.08)",
  hairline2: "rgba(242, 241, 235, 0.13)",
  ink900: "#F2F1EB",
  ink800: "#E6E5E3",
  ink700: "#C9C8C2",
  ink600: "#A8A8A8",
  ink500: "#91918E",
  ink400: "#7C7C79",
  ink300: "#5C5C5C",
  berry700: "#8A0F51",
  berry600: "#A61361",
  berry500: "#C41C72",
  berry400: "#D55391",
  berry300: "#E38CB2",
  berry200: "#EFB9D0",
  berryFill: "#351523",
  success: "#55A87C",
  warning: "#D2A150",
  danger: "#E5675E",
  info: "#5E92BE",
} as const;

export type Label = "stone" | "berry" | "rust" | "ochre" | "moss" | "teal" | "slate" | "indigo" | "plum" | "clay";
export const LABEL: Record<Label, { dot: string; fill: string; text: string }> = {
  stone: { dot: "#8B877E", fill: "#2A2A28", text: "#C6C3BC" },
  berry: { dot: "#C41C72", fill: "#351523", text: "#E896BD" },
  rust: { dot: "#C97A55", fill: "#33221A", text: "#DBA588" },
  ochre: { dot: "#C99E3F", fill: "#322A16", text: "#DDBE7A" },
  moss: { dot: "#55A87C", fill: "#1E2C24", text: "#8FC9A9" },
  teal: { dot: "#4FA8A4", fill: "#172B2A", text: "#85C7C4" },
  slate: { dot: "#6E9CC0", fill: "#1C2733", text: "#A3C2DB" },
  indigo: { dot: "#8B84C9", fill: "#232134", text: "#B4AEDD" },
  plum: { dot: "#B07CB8", fill: "#2C2030", text: "#D0A8D6" },
  clay: { dot: "#A98B77", fill: "#2B2420", text: "#C8AE9D" },
};

/** Type ramp (film scale of the app's ramp). */
export const t = {
  h1: { fontFamily: FONT, fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.15 },
  h2: { fontFamily: FONT, fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.2 },
  body: { fontFamily: FONT, fontSize: 18, fontWeight: 400, letterSpacing: "-0.005em", lineHeight: 1.35 },
  bodyStrong: { fontFamily: FONT, fontSize: 18, fontWeight: 500, letterSpacing: "-0.005em", lineHeight: 1.35 },
  small: { fontFamily: FONT, fontSize: 15, fontWeight: 400, lineHeight: 1.35 },
  label: { fontFamily: FONT, fontSize: 13, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" as const },
  mono: { fontFamily: MONO, fontSize: 14, fontWeight: 400, letterSpacing: "0.01em" },
} as const;

export const Tag: React.FC<{ label: Label; children: React.ReactNode; size?: "sm" | "md" }> = ({ label, children, size = "md" }) => {
  const c = LABEL[label];
  const h = size === "sm" ? 24 : 28;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, height: h, padding: `0 ${size === "sm" ? 8 : 10}px`, borderRadius: 6, background: c.fill, color: c.text, fontFamily: FONT, fontSize: size === "sm" ? 13 : 14, fontWeight: 500, whiteSpace: "nowrap" }}>
      <span style={{ width: 7, height: 7, borderRadius: 2, background: c.dot }} />
      {children}
    </span>
  );
};

const AV: Record<string, string> = { RS: "#5B2440", MO: "#3F3A5E", TL: "#2F4A45", ID: "#5A4630", SP: "#384A5E" };
export const Avatar: React.FC<{ initials: string; size?: number; ring?: string }> = ({ initials, size = 28, ring = app.paper }) => (
  <span
    style={{
      width: size,
      height: size,
      borderRadius: 999,
      background: AV[initials] ?? app.paper4,
      boxShadow: `0 0 0 2px ${ring}`,
      color: app.ink900,
      display: "inline-grid",
      placeItems: "center",
      fontFamily: FONT,
      fontSize: size * 0.4,
      fontWeight: 600,
      flexShrink: 0,
    }}
  >
    {initials}
  </span>
);

export const AvatarStack: React.FC<{ people: string[]; size?: number; ring?: string }> = ({ people, size = 26, ring }) => (
  <span style={{ display: "inline-flex" }}>
    {people.map((p, i) => (
      <span key={p} style={{ marginLeft: i ? -size * 0.18 : 0 }}>
        <Avatar initials={p} size={size} ring={ring} />
      </span>
    ))}
  </span>
);

/** Check: 0 = open, 1 = done (draws on). */
export const Check: React.FC<{ p?: number; size?: number }> = ({ p = 0, size = 20 }) => (
  <span style={{ position: "relative", width: size, height: size, borderRadius: size * 0.3, flexShrink: 0, boxShadow: `inset 0 0 0 1.6px ${p > 0 ? app.berry500 : app.ink400}`, background: p > 0 ? `rgba(196, 28, 114, ${p})` : "transparent", display: "inline-block" }}>
    <svg viewBox="0 0 20 20" width={size} height={size} style={{ position: "absolute", inset: 0 }}>
      {p > 0 ? <path d="M5 10.5 L8.6 14 L15 6.5" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${p} 2`} /> : null}
    </svg>
  </span>
);

/** Priority bars (ds/ui priority): 0 none … 3 high, 4 urgent. */
export const Priority: React.FC<{ level: 0 | 1 | 2 | 3 | 4 }> = ({ level }) =>
  level === 4 ? (
    <span style={{ width: 18, height: 18, borderRadius: 4, background: app.danger, color: app.paper, display: "inline-grid", placeItems: "center", fontFamily: FONT, fontWeight: 700, fontSize: 13 }}>!</span>
  ) : (
    <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 2, height: 16 }}>
      {[6, 10, 15].map((h, i) => (
        <span key={i} style={{ width: 4, height: h, borderRadius: 1, background: i < level ? app.ink700 : app.ink300 }} />
      ))}
    </span>
  );

export const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ ...t.mono, fontSize: 13, height: 22, minWidth: 22, padding: "0 6px", display: "inline-grid", placeItems: "center", borderRadius: 5, background: app.paper3, boxShadow: `inset 0 0 0 1px ${app.hairline2}`, color: app.ink600 }}>{children}</span>
);

export const Ico: React.FC<{ name: GlyphName; size?: number; tint?: string }> = ({ name, size = 18, tint = app.ink500 }) => <Icon name={name} size={size} tint={tint} />;

/** A product surface: paper, hairline rim, the app's layered shadow. */
export const Surface: React.FC<{ w?: number; h?: number; r?: number; pad?: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({ w, h, r = 14, pad = 0, style, children }) => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: r,
      padding: pad,
      background: app.paper,
      boxShadow: `inset 0 0 0 1px ${app.hairline2}, inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 6px rgba(0,0,0,0.35), 0 24px 60px rgba(0,0,0,0.45)`,
      color: app.ink800,
      fontFamily: FONT,
      position: "relative",
      overflow: "hidden",
      ...style,
    }}
  >
    {children}
  </div>
);

export const Divider: React.FC<{ style?: React.CSSProperties }> = ({ style }) => <div style={{ height: 1, background: app.hairline, ...style }} />;

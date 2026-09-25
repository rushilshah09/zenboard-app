/**
 * v4 film kit: the shared pieces every v4 scene is built from. Visual language is ported 1:1 from the
 * approved storyboard (storyboard/, v4.css). All motion is a pure function of the frame.
 */
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile } from "remotion";
import { LOCKUP_LETTERS, LOCKUP_MARK } from "../brand/logo.generated";
import { ICONS, IconName, IconWeight } from "./icons.generated";
import { HALFTONE } from "./halftone.generated";
import "./v4.css";

export const FPS = 60;
export const W = 1920;
export const H = 1080;
/** 1cqw in px at 1920 wide (the storyboard's unit). */
export const CQ = 19.2;
export const s = (sec: number) => Math.round(sec * FPS);

export const BERRY = "#C41C72";
export const INK = "#191919";
export const PAPER = "#FBFAF6";
export const FIELD = {
  petal: "#EAB9CB", apricot: "#ECBF9B", butter: "#E5D494", sage: "#B7CEAB",
  sky: "#A6D1E0", peri: "#B8BDEE", sand: "#EEE7D9", mist: "#E7EAEC",
} as const;

/* ---------------- motion ---------------- */

export const CURVE = {
  /** Fast start, long silky settle (expo-out). Entrances, camera arrivals. */
  settle: Easing.bezier(0.16, 1, 0.3, 1),
  /** Heavy camera with inertia. */
  glide: Easing.bezier(0.65, 0, 0.35, 1),
  /** Exits accelerate away. */
  depart: Easing.bezier(0.7, 0, 0.84, 0),
  /** Soft in-out for drifts. */
  breathe: Easing.bezier(0.37, 0, 0.63, 1),
};

/** Clamped interpolation with an easing. */
export const ease = (f: number, a: number, b: number, from: number, to: number, curve = CURVE.settle) =>
  interpolate(f, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: curve });

/** Pop spring: small overshoot (~6%) then a soft land. 0 → 1. */
export const pop = (f: number, at: number, stiffness = 190, damping = 15) =>
  spring({ frame: f - at, fps: FPS, config: { stiffness: stiffness * 0.7, damping: damping * 1.18, mass: 1 } });

/** Soft spring: no visible overshoot. 0 → 1. */
export const soft = (f: number, at: number, stiffness = 120, damping = 26) =>
  spring({ frame: f - at, fps: FPS, config: { stiffness, damping, mass: 1 } });

/** Blur-in entrance used for words and cards: opacity, blur and a small rise ride one spring. */
export const blurIn = (f: number, at: number, rise = 18, blurPx = 14): React.CSSProperties => {
  const p = soft(f, at, 140, 22);
  return { opacity: Math.min(1, p * 1.4), filter: `blur(${(1 - Math.min(1, p)) * blurPx}px)`, transform: `translateY(${(1 - p) * rise}px)` };
};
/** Blur-out exit. */
export const blurOut = (f: number, at: number, dur = 14, blurPx = 12): React.CSSProperties => {
  const p = ease(f, at, at + dur, 0, 1, CURVE.depart);
  return { opacity: 1 - p, filter: `blur(${p * blurPx}px)` };
};
/** Merge style objects, multiplying opacity and concatenating transforms and filters. */
export const mix = (...st: React.CSSProperties[]): React.CSSProperties => {
  const out: React.CSSProperties = {};
  let op = 1; const tr: string[] = []; const fl: string[] = [];
  for (const x of st) {
    if (x.opacity !== undefined) op *= Number(x.opacity);
    if (x.transform) tr.push(String(x.transform));
    if (x.filter) fl.push(String(x.filter));
    Object.assign(out, x);
  }
  out.opacity = op;
  if (tr.length) out.transform = tr.join(" ");
  if (fl.length) out.filter = fl.join(" ");
  return out;
};

/** Deterministic pseudo-random in [0,1) from a seed. */
export const rnd = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/* ---------------- layout ---------------- */

/** Absolutely positioned, centred on (x, y) given in cqw (like the storyboard's at()). */
export const At: React.FC<{ x: number; y: number; style?: React.CSSProperties; className?: string; children?: React.ReactNode }> = ({ x, y, style, className, children }) => (
  <div className={`a ${className ?? ""}`} style={{ left: `${x}cqw`, top: `${y}cqw`, ...style, transform: `translate(-50%,-50%) ${style?.transform ?? ""}` }}>
    {children}
  </div>
);

/** A 1920×1080 frame with the storyboard's container units and the shared SVG defs. */
export const Frame: React.FC<{ children?: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <AbsoluteFill>
    <div className="fr" style={style}>
      <Defs />
      {children}
    </div>
  </AbsoluteFill>
);

const LOBE = LOCKUP_MARK.split("ZM")[0] + "Z";
export const Defs: React.FC = () => (
  <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
    <defs>
      <clipPath id="lobeClip" clipPathUnits="objectBoundingBox"><path transform="scale(0.03125)" d={LOBE} /></clipPath>
      <linearGradient id="zgrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#AAA0D4" /><stop offset=".35" stopColor="#C41C72" /><stop offset=".7" stopColor="#E8A8C5" /><stop offset="1" stopColor="#E8B88A" />
      </linearGradient>
      <filter id="inkBleed" x="-2%" y="-2%" width="104%" height="104%">
        <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves={1} seed={4} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={1.6} />
      </filter>
    </defs>
  </svg>
);

/* ---------------- brand ---------------- */

export const Mark: React.FC<{ size: number; color?: string; style?: React.CSSProperties }> = ({ size, color = BERRY, style }) => (
  <svg viewBox="-1 -1 34 34" style={{ width: `${size}cqw`, height: `${size}cqw`, display: "block", ...style }}>
    <path d={LOCKUP_MARK} fill={color} />
  </svg>
);

/** The lockup. `letters` = how many wordmark letters are visible (typing), `letterStyle` per index. */
export const Lockup: React.FC<{ width: number; color?: string; markColor?: string; letters?: number; letterStyle?: (i: number) => React.CSSProperties; markStyle?: React.CSSProperties }> = ({
  width, color = INK, markColor = BERRY, letters = 8, letterStyle, markStyle,
}) => (
  <svg viewBox="0 0 152 32" style={{ width: `${width}cqw`, overflow: "visible", display: "block" }}>
    <path d={LOCKUP_MARK} fill={markColor} style={{ transformBox: "fill-box", transformOrigin: "center", ...markStyle }} />
    {LOCKUP_LETTERS.slice(0, letters).map((d, i) => (
      <path key={i} d={d} fill={color} style={{ transformBox: "fill-box", transformOrigin: "center", ...letterStyle?.(i) }} />
    ))}
  </svg>
);

const camel = (k: string) => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
export const Icon: React.FC<{ name: IconName; weight?: IconWeight; size?: string; color?: string; style?: React.CSSProperties }> = ({
  name, weight = "fill", size = "100%", color = "currentColor", style,
}) => (
  <svg viewBox="0 0 256 256" fill={color} stroke={color} style={{ width: size, height: size, display: "block", ...style }}>
    {ICONS[name][weight].map((e, i) => {
      const props: Record<string, string> = {};
      for (const [k, v] of Object.entries(e.attrs as Record<string, string>)) props[camel(k)] = v === "currentColor" ? color : v;
      if (!("stroke" in e.attrs)) props.stroke = "none";
      return React.createElement(e.tag, { key: i, ...props });
    })}
  </svg>
);

/** The mark as a halftone dot field. `reveal` 0→1 grows the dots from the centre out. */
export const Halftone: React.FC<{ size: number; color: string; opacity: number; reveal?: number; rot?: number }> = ({ size, color, opacity, reveal = 1, rot = 0 }) => (
  <svg viewBox="0 0 100 100" style={{ width: `${size}cqw`, height: `${size}cqw`, opacity, transform: `rotate(${rot}deg)` }} fill={color}>
    {HALFTONE.map(([x, y, r], i) => {
      const d = Math.hypot(x - 50, y - 50) / 70;
      const k = Math.max(0, Math.min(1, (reveal - d * 0.6) / 0.4));
      return k > 0 ? <circle key={i} cx={x} cy={y} r={r * k} /> : null;
    })}
  </svg>
);

export const img = (name: string) => staticFile(`v4/${name}`);
export const Face: React.FC<{ k: "p1" | "p2" | "p3" | "p4" | "p5" | "portrait"; className?: string; style?: React.CSSProperties }> = ({ k, className, style }) => (
  <span className={className} style={className ? style : { display: "block", width: "100%", height: "100%", ...style }}>
    <Img src={img(`${k}.jpg`)} style={className ? undefined : { width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
  </span>
);

/* ---------------- stages ---------------- */

export const PaperStage: React.FC<{ glow?: number; dots?: boolean }> = ({ glow = 1, dots = true }) => (
  <div className="stage paper">
    {dots ? <div className="dots" /> : null}
    <div className="glow" style={{ opacity: glow }} />
  </div>
);

/** Film grain that moves every 2 frames (deterministic). */
export const Grain: React.FC<{ f: number; opacity?: number }> = ({ f, opacity = 0.06 }) => (
  <div className="stage grain" style={{ opacity, backgroundPosition: `${Math.floor(f / 2) * 37 % 160}px ${Math.floor(f / 2) * 91 % 160}px` }} />
);

/** Word-by-word blur-in caption. */
export const Words: React.FC<{ f: number; at: number; text: string; stagger?: number; style?: React.CSSProperties; className?: string; exitAt?: number }> = ({
  f, at, text, stagger = 5, style, className = "cap", exitAt,
}) => (
  <span className={className} style={{ display: "inline-flex", gap: "0.28em", whiteSpace: "nowrap", ...style }}>
    {text.split(" ").map((w, i) => (
      <span key={i} style={mix(blurIn(f, at + i * stagger, 14, 16), exitAt !== undefined ? blurOut(f, exitAt + i * 2) : {})}>{w}</span>
    ))}
  </span>
);

/** A white overexposure flash used for the light-flash whip transitions. peak at `at`. */
export const Flash: React.FC<{ f: number; at: number; len?: number; color?: string }> = ({ f, at, len = 10, color = "#FFF8FB" }) => {
  const o = f < at ? ease(f, at - len, at, 0, 1, CURVE.depart) : ease(f, at, at + len * 1.6, 1, 0, CURVE.settle);
  return o > 0.001 ? <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, #fff, ${color})`, opacity: o }} /> : null;
};

/** A crisp arrow cursor whose tip sits exactly at (x, y) in cqw. */
export const Cursor: React.FC<{ x: number; y: number; press?: number; opacity?: number }> = ({ x, y, press = 0, opacity = 1 }) => (
  <svg viewBox="0 0 24 24" style={{ position: "absolute", left: `${x}cqw`, top: `${y}cqw`, width: "2.4cqw", height: "2.4cqw", overflow: "visible", opacity,
    transform: `translate(-0.08cqw,-0.08cqw) scale(${1 - 0.12 * press})`, transformOrigin: "0 0", filter: "drop-shadow(0 .25cqw .35cqw rgba(0,0,0,.28))" }}>
    <path d="M1 1 L1 19 L6 14.5 L9.5 22 L12.6 20.6 L9.2 13.3 L16 13.3 Z" fill="#191919" stroke="#fff" strokeWidth={1.4} strokeLinejoin="round" />
  </svg>
);

/* ---------------- motion language (one system for the whole film) ----------------
 * Moves:     inOut (accelerate softly, decelerate naturally)
 * Arrivals:  settle spring (no bounce) or lift spring (≈3% overshoot, only where it adds personality)
 * Exits:     depart (accelerate away, always faster than the entrance)
 * Rotation:  integrated angular velocity, so spins build momentum and coast down instead of switching speed
 * Anticipation: a tiny counter-move before a major move
 */
export const M = {
  inOut: Easing.bezier(0.7, 0, 0.25, 1),
  out: Easing.bezier(0.16, 1, 0.3, 1),
  in: Easing.bezier(0.5, 0, 0.9, 0.4),
};

/** Smooth 0→1 ramp (inOut) between a and b. */
export const ramp = (f: number, a: number, b: number) => ease(f, a, b, 0, 1, M.inOut);

/** Critically damped arrival: no overshoot. */
export const settle = (f: number, at: number, dur = 40) =>
  spring({ frame: f - at, fps: FPS, config: { stiffness: 100, damping: 20, mass: 1 }, durationInFrames: dur });

/** Arrival with a subtle (~3%) overshoot and a clean settle. */
export const lift = (f: number, at: number, dur = 44) =>
  spring({ frame: f - at, fps: FPS, config: { stiffness: 120, damping: 15.5, mass: 1 }, durationInFrames: dur });

/**
 * Anticipation: dips to -amt (a small counter-move) over the first `pre` share of the move, then travels to 1 with inOut.
 * Use for major moves: position, scale, rotation.
 */
export const anticipate = (f: number, at: number, dur: number, amt = 0.06, pre = 0.24) => {
  const t = Math.max(0, Math.min(1, (f - at) / dur));
  if (t <= 0) return 0;
  if (t < pre) return -amt * Math.sin((Math.PI / 2) * M.inOut(t / pre));
  return -amt + (1 + amt) * M.inOut((t - pre) / (1 - pre));
};

/**
 * Integrates an angular velocity (degrees per frame) from 0 to f, so rotations are continuous.
 * `omega` should itself be built from ramps so the spin accelerates and coasts.
 */
export const spinAt = (f: number, omega: (t: number) => number, step = 1) => {
  let a = 0;
  for (let t = 0; t < f; t += step) a += omega(t + step / 2) * Math.min(step, f - t);
  return a;
};

/** Smooth bump 0→1→0 between a (rise) b (peak) c (fall). */
export const bump = (f: number, a: number, b: number, c: number) => (f < b ? ramp(f, a, b) : 1 - ramp(f, b, c));

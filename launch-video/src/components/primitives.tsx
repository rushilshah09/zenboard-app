import React from "react";
import { useCurrentFrame } from "remotion";
import { color, font, radius, shadow } from "../theme";

const MARK_PATH =
  "M29.4762 13.0274L29.8244 12.6792C32.7252 9.77835 32.7252 5.07728 29.8244 2.17642L29.8213 2.17331C26.9206 -0.724437 22.2197 -0.724437 19.322 2.17331L18.9707 2.52465C17.3322 4.16318 14.6678 4.16318 13.0262 2.52465L12.678 2.17642C9.77722 -0.724437 5.07632 -0.724437 2.17556 2.17642C-0.725188 5.07728 -0.725188 9.77835 2.17556 12.6792L2.52378 13.0274C4.16225 14.6691 4.16225 17.3336 2.52378 18.9722L2.17556 19.3204C-0.725188 22.2213 -0.725188 26.9223 2.17556 29.8232C5.07632 32.724 9.77722 32.7272 12.678 29.8232L13.0262 29.475C14.6678 27.8333 17.3322 27.8333 18.9707 29.475L19.3189 29.8232C22.2197 32.724 26.9206 32.724 29.8213 29.8232H29.8244V29.8201C32.7252 26.9192 32.7252 22.2182 29.8244 19.3173L29.4762 18.9691C27.8346 17.3305 27.8346 14.666 29.4762 13.0243V13.0274ZM7.77498 24.2236C12.3173 19.6811 12.3173 12.3185 7.77498 7.77604C12.3173 12.3185 19.6827 12.3185 24.225 7.77604C19.6827 12.3185 19.6827 19.6811 24.225 24.2236C19.6827 19.6811 12.3173 19.6811 7.77498 24.2236Z";

/** The Zenboard mark, lifted verbatim from app/icon.svg. */
export const Mark: React.FC<{ size: number; fill?: string; style?: React.CSSProperties }> = ({
  size,
  fill = color.berry500,
  style,
}) => (
  <svg width={size} height={size} viewBox="-2 -2 36 36" style={style}>
    <path d={MARK_PATH} fill={fill} />
  </svg>
);

/** macOS-style pointer. `pressed` shrinks it for the click beat. */
export const Cursor: React.FC<{ x: number; y: number; pressed?: number; size?: number }> = ({
  x,
  y,
  pressed = 0,
  size = 44,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    style={{
      position: "absolute",
      left: x,
      top: y,
      scale: String(1 - pressed * 0.14),
      transformOrigin: "4px 3px",
      filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))",
      zIndex: 50,
    }}
  >
    <path
      d="M5 3l14 8.2-6.3 1.3 3.9 6.9-2.6 1.4-3.9-6.9L5 18.6z"
      fill="#000"
      stroke="#fff"
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
  </svg>
);

/** Blinking text caret, 2 blinks per second. */
export const Caret: React.FC<{ height: number; tint?: string }> = ({ height, tint = color.ink900 }) => {
  const frame = useCurrentFrame();
  const on = Math.floor(frame / 15) % 2 === 0;
  return (
    <span
      style={{
        display: "inline-block",
        width: Math.max(2, height * 0.06),
        height,
        marginLeft: 4,
        background: tint,
        opacity: on ? 1 : 0,
        verticalAlign: "middle",
        translate: `0 ${-height * 0.06}px`,
      }}
    />
  );
};

/** A floating Zenboard panel (#121212 surface, hairline border, XL radius). */
export const Panel: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  width?: number;
}> = ({ children, style, width }) => (
  <div
    style={{
      width,
      background: color.paper,
      border: `1px solid ${color.line}`,
      borderRadius: radius.xl,
      boxShadow: shadow.lift3,
      color: color.ink800,
      fontFamily: font.sans,
      overflow: "hidden",
      ...style,
    }}
  >
    {children}
  </div>
);

/** Round task checkbox matching the app's Today list. */
export const Check: React.FC<{ done: number; size?: number }> = ({ done, size = 18 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: radius.pill,
      border: `1.5px solid ${done > 0.5 ? color.ink900 : color.ink400}`,
      background: done > 0.5 ? color.ink900 : "transparent",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      scale: String(1 + Math.sin(Math.min(done, 1) * Math.PI) * 0.18),
    }}
  >
    <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 12 12" style={{ opacity: done }}>
      <path
        d="M2.5 6.2l2.3 2.3 4.7-5"
        fill="none"
        stroke={color.paper}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={12}
        strokeDashoffset={12 * (1 - done)}
      />
    </svg>
  </div>
);

/** Small keyboard key cap, used for ⌘K / ↵ hints. */
export const Kbd: React.FC<{ children: React.ReactNode; tone?: "dark" | "light" }> = ({
  children,
  tone = "dark",
}) => (
  <span
    style={{
      fontFamily: font.mono,
      fontSize: 11,
      lineHeight: "18px",
      padding: "0 6px",
      borderRadius: radius.xs,
      border: `1px solid ${tone === "dark" ? color.line3 : "rgba(18,18,18,0.16)"}`,
      color: tone === "dark" ? color.ink600 : "rgba(18,18,18,0.6)",
      display: "inline-block",
    }}
  >
    {children}
  </span>
);

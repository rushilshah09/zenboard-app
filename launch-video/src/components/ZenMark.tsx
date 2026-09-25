import React from "react";
import { Img, staticFile } from "remotion";
import { FONT } from "../brand/fonts";
import { colour, type } from "../brand/tokens";
import { hasFile } from "./media";

const MARK_PATH =
  "M29.4762 13.0274L29.8244 12.6792C32.7252 9.77835 32.7252 5.07728 29.8244 2.17642L29.8213 2.17331C26.9206 -0.724437 22.2197 -0.724437 19.322 2.17331L18.9707 2.52465C17.3322 4.16318 14.6678 4.16318 13.0262 2.52465L12.678 2.17642C9.77722 -0.724437 5.07632 -0.724437 2.17556 2.17642C-0.725188 5.07728 -0.725188 9.77835 2.17556 12.6792L2.52378 13.0274C4.16225 14.6691 4.16225 17.3336 2.52378 18.9722L2.17556 19.3204C-0.725188 22.2213 -0.725188 26.9223 2.17556 29.8232C5.07632 32.724 9.77722 32.7272 12.678 29.8232L13.0262 29.475C14.6678 27.8333 17.3322 27.8333 18.9707 29.475L19.3189 29.8232C22.2197 32.724 26.9206 32.724 29.8213 29.8232H29.8244V29.8201C32.7252 26.9192 32.7252 22.2182 29.8244 19.3173L29.4762 18.9691C27.8346 17.3305 27.8346 14.666 29.4762 13.0243V13.0274ZM7.77498 24.2236C12.3173 19.6811 12.3173 12.3185 7.77498 7.77604C12.3173 12.3185 19.6827 12.3185 24.225 7.77604C19.6827 12.3185 19.6827 19.6811 24.225 24.2236C19.6827 19.6811 12.3173 19.6811 7.77498 24.2236Z";

/** The Zenboard mark (app/icon.svg). Pink, and only from S09 onward. */
export const Mark: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <svg width={size} height={size} viewBox="-2 -2 36 36" style={{ flexShrink: 0, ...style }}>
    <path d={MARK_PATH} fill={colour.pink} />
  </svg>
);

export const Wordmark: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = type.display.fontSize, style }) => (
  <div style={{ fontFamily: FONT, ...type.display, fontSize: size, lineHeight: `${size}px`, color: colour.ink, whiteSpace: "nowrap", ...style }}>
    Zenboard
  </div>
);

/**
 * Magenta Mist (IMG-05). Uses public/img/IMG-05.png when present; until then
 * the same Pink → Blush → Cream falloff is drawn as a radial gradient (the one
 * gradient the brand allows).
 */
export const Aura: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => {
  if (hasFile("img/IMG-05.png")) {
    return <Img src={staticFile("img/IMG-05.png")} style={{ width: size * 1.78, height: size, objectFit: "cover", ...style }} />;
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(closest-side, rgba(196, 28, 114, 0.30), rgba(243, 217, 229, 0.75) 48%, rgba(247, 241, 232, 0) 100%)`,
        ...style,
      }}
    />
  );
};

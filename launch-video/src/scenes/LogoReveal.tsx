import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Mark } from "../components/primitives";
import { Sfx } from "../components/Sfx";
import { color, ease, font, tween } from "../theme";

/** Scene 3 / 9 — the mark arrives, the wordmark follows, then the promise. */
export const LogoLockup: React.FC<{ frame: number; size?: number }> = ({ frame, size = 150 }) => {
  const markIn = tween(frame, [0, 22], [0, 1], ease.spring);
  const open = tween(frame, [16, 40], [0, 1], ease.inOut);
  const wordW = size * 4.5;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Mark
        size={size}
        style={{
          scale: String(markIn),
          rotate: `${(1 - markIn) * -120}deg`,
          filter: `drop-shadow(0 0 ${40 * markIn}px rgba(196, 28, 114, 0.45))`,
        }}
      />
      <div
        style={{
          width: wordW * open,
          overflow: "hidden",
          whiteSpace: "nowrap",
          marginLeft: size * 0.22 * open,
        }}
      >
        <div
          style={{
            fontFamily: font.sans,
            fontWeight: 600,
            fontSize: size * 0.95,
            letterSpacing: "-0.045em",
            color: color.ink900,
            translate: `${(1 - open) * -60}px 0`,
            opacity: open,
            lineHeight: 1,
            paddingBottom: size * 0.08,
          }}
        >
          Zenboard
        </div>
      </div>
    </div>
  );
};

export const LogoReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const tag = tween(frame, [44, 62], [0, 1]);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 46%, ${color.paper2} 0%, ${color.canvas} 60%)`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ translate: `0 ${-tag * 40}px` }}>
        <LogoLockup frame={frame} />
      </div>
      <div
        style={{
          position: "absolute",
          top: 640,
          fontFamily: font.sans,
          fontSize: 48,
          fontWeight: 400,
          letterSpacing: "-0.015em",
          color: color.ink600,
          opacity: tag,
          translate: `0 ${(1 - tag) * 16}px`,
        }}
      >
        The calm workspace for a business of one.
      </div>
      <Sfx at={0} sound="whoosh" volume={0.4} />
    </AbsoluteFill>
  );
};

import React from "react";
import { color, ease, font, tween } from "../theme";
import { Mark } from "./primitives";

/** Mark spins in, then the wordmark unrolls from behind it. `frame` is local. */
export const LogoLockup: React.FC<{ frame: number; size?: number; tint?: string }> = ({
  frame,
  size = 150,
  tint = color.ink900,
}) => {
  const markIn = tween(frame, [0, 22], [0, 1], ease.spring);
  const open = tween(frame, [16, 40], [0, 1], ease.inOut);
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
      <div style={{ width: size * 4.5 * open, overflow: "hidden", whiteSpace: "nowrap", marginLeft: size * 0.22 * open }}>
        <div
          style={{
            fontFamily: font.sans,
            fontWeight: 600,
            fontSize: size * 0.95,
            letterSpacing: "-0.045em",
            color: tint,
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

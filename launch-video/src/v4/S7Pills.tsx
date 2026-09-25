/**
 * Scene 7 · Pill wall (0:46–0:51). The toast opens a Berry field; rows of glass-bordered module pills
 * slide in and scroll in alternating directions, accelerating. The Tasks pill then comes to camera and
 * becomes the first 3D tile of the carousel while the stage drops to ink.
 */
import React from "react";
import { useCurrentFrame } from "remotion";
import { At, BERRY, CURVE, FIELD, Frame, Grain, Icon, ease, pop } from "./kit";
import { IconName } from "./icons.generated";

type F = keyof typeof FIELD | "berry";
const PILLS: [string, F, IconName][] = [
  ["Tasks", "sky", "check-square"], ["Projects", "sand", "kanban"], ["Invoices", "apricot", "receipt"], ["Calendar", "berry", "calendar-blank"],
  ["Notes", "butter", "note-pencil"], ["Habits", "petal", "plant"], ["Focus", "sky", "timer"], ["Clients", "peri", "users-three"],
  ["Docs", "peri", "file-text"], ["Goals", "sand", "target"], ["Payments", "berry", "credit-card"], ["Time tracking", "sage", "clock"],
  ["Proposals", "sand", "paper-plane-tilt"], ["Life", "sage", "sun"], ["Files", "petal", "folder"], ["Automations", "petal", "lightning"],
  ["Insights", "sand", "chart-line"], ["Messages", "sky", "chat-circle"], ["Reminders", "peri", "bell"],
];

const Pill: React.FC<{ p: (typeof PILLS)[number]; style?: React.CSSProperties }> = ({ p: [t, c, ic], style }) => {
  const glass = c === "berry";
  return (
    <span className={`wp${glass ? " glass" : ""}`} style={{ background: glass ? "rgba(255,255,255,.14)" : FIELD[c as keyof typeof FIELD], color: glass ? "#FBFAF6" : "#191919", ...style }}>
      <i className="wpi"><Icon name={ic} size="58%" /></i>{t}
    </span>
  );
};

export const S7Pills: React.FC = () => {
  const f = useCurrentFrame();
  const open = ease(f, 0, 34, 0, 1, CURVE.settle);
  const focus = ease(f, 232, 290, 0, 1, CURVE.glide); // Tasks pill to camera
  const ink = ease(f, 250, 290, 0, 1, CURVE.breathe);
  return (
    <Frame>
      <div className="stage paper" />
      <div className="stage" style={{ clipPath: `circle(${open * 120}% at 50% 50%)` }}>
        <div className="stage" style={{ background: "radial-gradient(130% 120% at 100% 100%,#B5226C 0%,#8E1253 40%,#4A0A2C 100%)" }} />
        <div className="stage" style={{ background: "#16060F", opacity: ink }} />
        <div className="stage" style={{ transform: `scale(${1 + focus * 0.6})`, opacity: 1 - focus, filter: focus > 0.02 ? `blur(${focus * 10}px)` : undefined }}>
          {Array.from({ length: 6 }, (_, r) => {
            const dir = r % 2 ? -1 : 1;
            const speed = 0.05 + 0.12 * ease(f, 40, 230, 0, 1, CURVE.breathe);
            const drift = dir * (f * speed + 6 * ease(f, 0, 60, 1, 0, CURVE.settle) * (r % 2 ? -1 : 1));
            const enter = pop(f, 6 + r * 5, 150, 20);
            return (
              <At key={r} x={50 + (r % 2 ? -6 : 4) + drift} y={6 + r * 9} style={{ opacity: Math.min(1, enter * 1.3), transform: `translateX(${(1 - enter) * dir * -30}cqw)` }}>
                <div className="wrow">
                  {Array.from({ length: 14 }, (_, k) => {
                    const p = PILLS[(r * 5 + k + 17) % PILLS.length];
                                        return <Pill key={k} p={p} />;
                  })}
                </div>
              </At>
            );
          })}
        </div>
        {/* the hero pill: Tasks comes to camera and becomes the carousel's centre tile */}
        <At x={50} y={6 + 3 * 9 + (25 - 33) * focus} style={{ transform: `scale(${(1 + focus * 0.35) * (0.7 + 0.3 * pop(f, 222, 200, 16))})`, opacity: ease(f, 222, 236, 0, 1) }}>
          <span className="wp" style={{
            background: focus > 0.5 ? "#F5F1EA" : FIELD.sky, color: "#191919", borderRadius: `${99 - 70 * focus}px`,
            width: focus > 0 ? `${14 + (18 - 14) * focus}cqw` : undefined, height: focus > 0 ? `${5 + 13 * focus}cqw` : undefined,
            justifyContent: "center", gap: `${0.8 * (1 - focus)}cqw`,
          }}>
            <i className="wpi" style={{ width: `${2.6 + 5 * focus}cqw`, height: `${2.6 + 5 * focus}cqw`, background: focus > 0.5 ? BERRY : undefined, color: focus > 0.5 ? "#fff" : undefined, borderRadius: `${50 - 30 * focus}%` }}>
              <Icon name="check-square" size="58%" />
            </i>
            <span style={{ opacity: 1 - focus * 2, width: focus > 0.5 ? 0 : undefined, overflow: "hidden" }}>Tasks</span>
          </span>
        </At>
        <Grain f={f} opacity={0.14} />
      </div>
    </Frame>
  );
};

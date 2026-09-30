/**
 * Scene 7 · Pill wall (0:46–0:51). The toast opens a Berry field; rows of glass-bordered module pills
 * slide in and scroll in alternating directions, accelerating. The Tasks pill then comes to camera and
 * becomes the first 3D tile of the carousel while the stage drops to ink.
 */
import React from "react";
import { useCurrentFrame } from "remotion";
import { At, BERRY, CURVE, FIELD, Frame, Grain, Icon, PaperStage, blurOut, ease, mix, soft } from "./kit";
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

/** The carousel's centre tile, exactly as scene 8 draws it at its first frame. */
export const TasksTile: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <div className="i3" style={{ width: "18cqw", height: "18cqw", ["--c" as string]: "#F5F1EA", color: BERRY, ...style }}>
    <span className="i3g"><Icon name="check-square" size="100%" /></span>
  </div>
);
export const TILE_AT = { x: 50, y: 24 };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const S7Pills: React.FC = () => {
  const f = useCurrentFrame();
  const open = ease(f, 0, 40, 0, 1, CURVE.settle);
  const m = ease(f, 214, 286, 0, 1, CURVE.glide); // the Tasks pill → tile morph
  const wallOut = ease(f, 200, 280, 0, 1, CURVE.breathe);
  const ink = ease(f, 230, 290, 0, 1, CURVE.breathe);
  // the centre row glides in and comes to rest with its Tasks pill exactly at the centre
  const heroX = 50 + 70 * (1 - ease(f, 0, 214, 0, 1, (t) => 1 - (1 - t) ** 3));
  const hy = lerp(33, TILE_AT.y, m);
  const pillOut = ease(f, 214, 250, 0, 1, CURVE.breathe);
  const tileIn = ease(f, 226, 270, 0, 1, CURVE.breathe);
  return (
    <Frame>
      <PaperStage glow={0} />
      <div className="stage" style={{ background: "radial-gradient(46% 58% at 50% 50%,rgba(234,185,203,.55),rgba(250,237,244,.35) 45%,transparent 75%)" }} />
      {/* the toast from scene 6 opens the Berry field from its own centre */}
      {f < 30 ? (
        <At x={50} y={28.1} style={mix({ transform: `scale(${1.5 + 0.6 * ease(f, 0, 24, 0, 1)})` }, blurOut(f, 2, 20, 12))}>
          <div className="toast"><Icon name="check-circle" size="1.2cqw" color="#6FCF9D" /> Reminder sent to Fernwood Hotels</div>
        </At>
      ) : null}
      <div className="stage" style={{ clipPath: `circle(${open * 120}% at 50% 50%)` }}>
        <div className="stage" style={{ background: "radial-gradient(130% 120% at 100% 100%,#B5226C 0%,#8E1253 40%,#4A0A2C 100%)" }} />
        <div className="stage" style={{ background: "#16060F", opacity: ink }} />
        <div className="stage" style={{ transform: `scale(${1 - 0.12 * wallOut})`, opacity: 1 - wallOut, filter: wallOut > 0.01 ? `blur(${wallOut * 12}px)` : undefined }}>
          {Array.from({ length: 6 }, (_, r) => {
            const dir = r % 2 ? -1 : 1;
            const speed = 0.05 + 0.1 * ease(f, 30, 200, 0, 1, CURVE.breathe);
            const drift = dir * f * speed;
            const enter = soft(f, 4 + r * 5, 90, 20);
            if (r === 3) {
              // centre row: anchored on its Tasks pill
              const left = Array.from({ length: 7 }, (_, k) => PILLS[(3 * 5 + 17 + 7 + k) % PILLS.length]);
              const right = Array.from({ length: 7 }, (_, k) => PILLS[(3 * 5 + 17 + k + 1) % PILLS.length]);
              return (
                <At key={r} x={heroX} y={33} style={{ opacity: Math.min(1, enter * 1.3) }}>
                  <div style={{ position: "relative" }}>
                    <div className="wrow" style={{ position: "absolute", right: "calc(100% + 1.2cqw)", top: 0 }}>{left.map((p, k) => <Pill key={k} p={p} />)}</div>
                    <span style={{ visibility: "hidden" }}><Pill p={["Tasks", "sky", "check-square"]} /></span>
                    <div className="wrow" style={{ position: "absolute", left: "calc(100% + 1.2cqw)", top: 0 }}>{right.map((p, k) => <Pill key={k} p={p} />)}</div>
                  </div>
                </At>
              );
            }
            return (
              <At key={r} x={50 + (r % 2 ? -6 : 4) + drift} y={6 + r * 9} style={{ opacity: Math.min(1, enter * 1.3), transform: `translateX(${(1 - enter) * dir * -30}cqw)` }}>
                <div className="wrow">
                  {Array.from({ length: 14 }, (_, k) => <Pill key={k} p={PILLS[(r * 5 + k + 17) % PILLS.length]} />)}
                </div>
              </At>
            );
          })}
        </div>
        {/* the hero: the centre row's Tasks pill lifts out and dissolves into the carousel's centre tile */}
        <At x={heroX} y={hy} style={{ opacity: Math.min(1, soft(f, 4 + 15, 90, 20) * 1.3) * (1 - pillOut), transform: `scale(${1 + 1.6 * m})`, filter: pillOut > 0.01 ? `blur(${pillOut * 10}px)` : undefined }}>
          <Pill p={["Tasks", "sky", "check-square"]} />
        </At>
        {tileIn > 0 ? (
          <At x={TILE_AT.x} y={hy} style={{ opacity: tileIn, transform: `scale(${lerp(0.3, 1, m)})`, filter: tileIn < 0.99 ? `blur(${(1 - tileIn) * 10}px)` : undefined }}>
            <TasksTile />
          </At>
        ) : null}
        <Grain f={f} opacity={0.12} />
      </div>
    </Frame>
  );
};

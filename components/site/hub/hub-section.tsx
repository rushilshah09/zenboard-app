"use client";

// Client component: the icon seam (components/ds/icons) is client-only, like
// every other icon call site in the app. It still server-renders as HTML.
import type { CSSProperties } from "react";
import type { IconType } from "@/components/ds/icons";
import {
  TileCalendar, TileClients, TileDocs, TileEverything, TileFinance, TileFocus, TileForms,
  TileGoals, TileHabits, TileInbox, TilePortal, TileProjects, TileTasks,
} from "../site-tiles";
import { Mark } from "@/components/ds/ui/icon";
import { Eyebrow, SiteSection, type SiteTheme } from "../section";
import s from "../section.module.css";
import h from "./hub-section.module.css";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

// Design canvas: 1440 × 640, the mark at (720, 320). Each side fans 13 cubic
// lines out of the mark; every feature sits on one of them (x, y in design px,
// computed on its curve), nearer areas larger, the far ones smaller.
const W = 1440;
const H = 640;
const LINES_PER_SIDE = 13;

type Hue = "slate" | "teal" | "rust" | "ochre" | "berry" | "moss" | "indigo" | "clay" | "plum" | "accent";

type Feature = { label: string; icon: IconType; hue: Hue; x: number; y: number; size: number };

const FEATURES: Feature[] = [
  // My day — left
  { label: "Inbox", icon: TileInbox, hue: "slate", x: 275.9, y: 72.9, size: 56 },
  { label: "Tasks", icon: TileTasks, hue: "teal", x: 425.1, y: 253.5, size: 64 },
  { label: "Calendar", icon: TileCalendar, hue: "rust", x: 425.1, y: 386.5, size: 64 },
  { label: "Focus", icon: TileFocus, hue: "ochre", x: 289.8, y: 556.6, size: 56 },
  { label: "Goals", icon: TileGoals, hue: "moss", x: 119.9, y: 274.9, size: 52 },
  { label: "Habits", icon: TileHabits, hue: "berry", x: 84, y: 431.2, size: 52 },
  // Work — right
  { label: "Docs", icon: TileDocs, hue: "slate", x: 1178.3, y: 125.1, size: 56 },
  { label: "Projects", icon: TileProjects, hue: "indigo", x: 1021, y: 221.4, size: 64 },
  { label: "Client portal", icon: TilePortal, hue: "accent", x: 1033.4, y: 365.3, size: 64 },
  { label: "Finance", icon: TileFinance, hue: "moss", x: 1150.2, y: 499.2, size: 56 },
  { label: "Clients", icon: TileClients, hue: "clay", x: 1337.8, y: 274, size: 52 },
  { label: "Forms", icon: TileForms, hue: "plum", x: 1269.5, y: 557.4, size: 52 },
];

const hueVar = (hue: Hue) => (hue === "accent" ? "var(--site-accent-600)" : `var(--site-hue-${hue})`);

/** The fan: line i on side s leaves the mark's edge, then bends to its own height. */
function fanPath(side: -1 | 1, i: number) {
  const midX = W / 2;
  const midY = H / 2;
  const u = (i - 6) / 6;
  const startY = midY + (i - 6) * 2.6;
  const endY = midY + 470 * Math.sign(u) * Math.abs(u) ** 1.25;
  const x = (d: number) => midX + side * d;
  return `M${x(54)} ${startY.toFixed(1)}C${x(300)} ${startY.toFixed(1)} ${x(420)} ${endY.toFixed(1)} ${x(800)} ${endY.toFixed(1)}`;
}

const LINES = ([-1, 1] as const).flatMap((side) =>
  Array.from({ length: LINES_PER_SIDE }, (_, i) => ({ id: `${side < 0 ? "l" : "r"}${i}`, d: fanPath(side, i) })),
);

// Work flowing in: a dot rides a feature's line into the mark.
const FLOWS = [
  { line: "l3", dur: 4.6, begin: 0 },
  { line: "r2", dur: 5.2, begin: 1.4 },
  { line: "l9", dur: 5, begin: 2.6 },
  { line: "r8", dur: 4.4, begin: 0.8 },
  { line: "l1", dur: 6, begin: 3.2 },
  { line: "r10", dur: 5.6, begin: 2 },
];

/**
 * zenboard.app — "everything in one calm place": the Zenboard mark at the
 * center, every product area connected to it.
 */
export function HubSection({ theme = "light" }: { theme?: SiteTheme }) {
  return (
    <SiteSection id="everything" labelledBy="hub-title" theme={theme} className={h.section}>
      <div className={h.intro}>
        <Eyebrow icon={TileEverything}>Everything in Zenboard</Eyebrow>
        <h2 id="hub-title" className={cx(s.title, h.title)}>
          Everything you run, in one calm place.
        </h2>
        <p className={cx(s.lead, h.lead)}>
          Your day, your projects, your clients and your money live together, so nothing falls between apps.
        </p>
      </div>

      <div className={h.stage} aria-hidden="true">
        <div className={h.canvas}>
          <div className={h.glow} />
          <svg className={h.lines} viewBox={`0 0 ${W} ${H}`}>
            {LINES.map((l) => (
              <path key={l.id} id={`hub-${l.id}`} className={h.line} d={l.d} vectorEffect="non-scaling-stroke" />
            ))}
            {FLOWS.map((f) => (
              <circle key={f.line} className={h.flow} r="3" opacity="0">
                <animateMotion
                  dur={`${f.dur}s`}
                  begin={`${f.begin}s`}
                  repeatCount="indefinite"
                  keyPoints="0.62;0"
                  keyTimes="0;1"
                  calcMode="linear"
                >
                  <mpath href={`#hub-${f.line}`} />
                </animateMotion>
                <animate
                  attributeName="opacity"
                  values="0;0.9;0.9;0"
                  keyTimes="0;0.15;0.8;1"
                  dur={`${f.dur}s`}
                  begin={`${f.begin}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))}
          </svg>
          <span className={cx(h.ring, h.ringOuter)} />
          <span className={cx(h.ring, h.ringInner)} />
          <div className={h.core}>
            <Mark size={48} style={{ color: "currentColor" }} />
          </div>
          <ul className={h.tiles}>
            {FEATURES.map((f) => {
              const Icon = f.icon;
              const vars = {
                "--x": `${(f.x / W) * 100}%`,
                "--y": `${(f.y / H) * 100}%`,
                "--size": `${(f.size / W) * 100}cqw`,
                "--hue": hueVar(f.hue),
              } as CSSProperties;
              return (
                <li key={f.label} className={h.tile} style={vars}>
                  <span className={h.tileFace}>
                    <Icon />
                  </span>
                  <span className={h.tileLabel}>{f.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <ul className={h.list} aria-label="Everything in Zenboard">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <li key={f.label} className={h.chip} style={{ "--hue": hueVar(f.hue) } as CSSProperties}>
              <Icon size={20} aria-hidden="true" />
              {f.label}
            </li>
          );
        })}
      </ul>
    </SiteSection>
  );
}

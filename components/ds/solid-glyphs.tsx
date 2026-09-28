// ─────────────────────────────────────────────────────────────────────────────
// Zen Solid — Zenboard's own filled glyph set, drawn on a 24×24 grid.
//
// Grammar (keep every new glyph inside it):
// • Solid silhouettes in currentColor; details are knocked OUT of the shape
//   (masks), never drawn in a second color — so a glyph works on any surface
//   and in both themes with zero extra tokens.
// • Soft geometry: corner radii 2–5, round caps/joins, 2px strokes for linework.
// • Overlaps are separated by a 1.5px knockout gap, not by outlines.
// • Live area 2–22; nothing touches the edge of the 24 grid.
//
// Each glyph takes the same props as the icon seam (size / className / style /
// aria-*), so it drops into <Icon>, IconButton and Button slots unchanged.
// ─────────────────────────────────────────────────────────────────────────────
import * as React from "react";

export type SolidGlyphProps = {
  size?: number | string;
  title?: string;
} & Omit<React.SVGProps<SVGSVGElement>, "ref" | "children">;

type Draw = (id: string) => React.ReactNode;

/** Wraps a glyph drawing in the shared 24-grid <svg>. */
function glyph(name: string, draw: Draw) {
  const C = React.forwardRef<SVGSVGElement, SolidGlyphProps>(function SolidGlyph(
    { size = 24, title, ...rest },
    ref,
  ) {
    const id = React.useId().replace(/:/g, "");
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="none"
        aria-hidden={title ? undefined : true}
        role={title ? "img" : undefined}
        {...rest}
      >
        {title && <title>{title}</title>}
        {draw(id)}
      </svg>
    );
  });
  C.displayName = name;
  return C;
}

/* ── Drawing helpers ──────────────────────────────────────────────────────── */

const LINE = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
/** Rounds the sharp corners of a filled path without changing its weight much. */
const SOFT = { stroke: "currentColor", strokeWidth: 1.5, strokeLinejoin: "round" } as const;
/** Mask paint: white keeps, black knocks out. */
const KEEP = "#fff";
const CUT = "#000";

/** Renders `shape` with `cut` knocked out of it. Both are drawn inside a mask,
 *  so `cut` elements should paint with CUT (fill/stroke). */
function Knockout({ id, shape, cut }: { id: string; shape: React.ReactNode; cut: React.ReactNode }) {
  return (
    <>
      <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <g fill={KEEP} stroke={KEEP} strokeWidth={0}>{shape}</g>
        {cut}
      </mask>
      <rect width="24" height="24" mask={`url(#${id})`} />
    </>
  );
}

/** Arc path from angle a0 to a1 (degrees, 0 = 12 o'clock, clockwise). */
function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => {
    const t = ((a - 90) * Math.PI) / 180;
    return `${(cx + r * Math.cos(t)).toFixed(2)} ${(cy + r * Math.sin(t)).toFixed(2)}`;
  };
  const large = (a1 - a0 + 360) % 360 > 180 ? 1 : 0;
  return `M${p(a0)}A${r} ${r} 0 ${large} 1 ${p(a1)}`;
}

const HEART = "M12 20C8 17.5 3 14 3 9A4.5 4.5 0 0 1 12 8A4.5 4.5 0 0 1 21 9C21 14 16 17.5 12 20Z";
const PERSON = (cx: number, top: number, r: number, w: number) => {
  const shoulders = top + r * 2 + 1.6;
  return {
    head: <circle cx={cx} cy={top + r} r={r} />,
    body: `M${cx - w} 20C${cx - w} ${shoulders + 1.2} ${cx - w * 0.55} ${shoulders} ${cx} ${shoulders}S${cx + w} ${shoulders + 1.2} ${cx + w} 20A1 1 0 0 1 ${cx + w - 1} 21H${cx - w + 1}A1 1 0 0 1 ${cx - w} 20Z`,
  };
};
const SQUIRCLE = <rect x="3" y="3" width="18" height="18" rx="5" />;

/* ── Row 1 — navigation & people ──────────────────────────────────────────── */

export const SolidHome = glyph("SolidHome", (id) => (
  <Knockout
    id={id}
    shape={<path d="M4 10.2 12 3.8l8 6.4V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" strokeWidth={1.5} strokeLinejoin="round" />}
    cut={<rect x="10" y="15" width="4" height="8" rx="1.5" fill={CUT} />}
  />
));

export const SolidApps = glyph("SolidApps", () => (
  <>
    <path d="M7 11.3C5.2 10.1 3 8.6 3 6.2A2.1 2.1 0 0 1 7 5.3a2.1 2.1 0 0 1 4 .9c0 2.4-2.2 3.9-4 5.1Z" {...SOFT} />
    <rect x="13" y="3" width="8" height="8" rx="2.5" />
    <rect x="3" y="13" width="8" height="8" rx="2.5" />
    <rect x="13" y="13" width="8" height="8" rx="2.5" />
  </>
));

export const SolidTrophy = glyph("SolidTrophy", () => (
  <>
    <path d="M7 3.5h10V9a5 5 0 0 1-10 0Z" {...SOFT} />
    <path d="M7 5.5H4.5v1.5a3.5 3.5 0 0 0 3.2 3.5M17 5.5h2.5v1.5a3.5 3.5 0 0 1-3.2 3.5" {...LINE} />
    <rect x="10.8" y="13" width="2.4" height="5" />
    <path d="M8.5 17.5h7l1 3.5h-9Z" {...SOFT} />
  </>
));

export const SolidUser = glyph("SolidUser", () => {
  const p = PERSON(12, 3, 4, 8);
  return (<>{p.head}<path d={p.body} /></>);
});

export const SolidUserAdd = glyph("SolidUserAdd", () => {
  const p = PERSON(14.5, 3.5, 3.6, 6.5);
  return (
    <>
      {p.head}
      <path d={p.body} />
      <path d="M5 8.5v6M2 11.5h6" {...LINE} />
    </>
  );
});

export const SolidUsers = glyph("SolidUsers", (id) => {
  const back = PERSON(16, 3, 3.2, 6);
  const front = PERSON(9, 4, 3.6, 7);
  return (
    <>
      <Knockout
        id={id}
        shape={<>{back.head}<path d={back.body} /></>}
        cut={
          <g fill={CUT} stroke={CUT} strokeWidth={3}>
            {front.head}
            <path d={front.body} />
          </g>
        }
      />
      {front.head}
      <path d={front.body} />
    </>
  );
});

export const SolidCompass = glyph("SolidCompass", (id) => (
  <>
    <Knockout
      id={id}
      shape={<circle cx="12" cy="12" r="10" />}
      cut={<path d="M16.2 7.8 13.4 13.4 7.8 16.2 10.6 10.6Z" fill={CUT} stroke={CUT} strokeWidth={1} strokeLinejoin="round" />}
    />
    <circle cx="12" cy="12" r="1.4" />
  </>
));

/* ── Row 2 — tools & signals ──────────────────────────────────────────────── */

export const SolidPencil = glyph("SolidPencil", (id) => (
  <g transform="rotate(45 12 12)">
    <Knockout
      id={id}
      shape={
        <>
          <rect x="9.5" y="1.5" width="5" height="15" rx="1.6" />
          <path d="M9.5 17.5h5L12 22Z" strokeWidth={1.2} strokeLinejoin="round" />
        </>
      }
      cut={<path d="M8 5.8h8" stroke={CUT} strokeWidth={1.4} />}
    />
  </g>
));

export const SolidSettings = glyph("SolidSettings", (id) => (
  <Knockout
    id={id}
    shape={
      <>
        <circle cx="12" cy="12" r="7" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <rect key={a} x="9.8" y="1.8" width="4.4" height="5" rx="1.4" transform={`rotate(${a} 12 12)`} />
        ))}
      </>
    }
    cut={<circle cx="12" cy="12" r="3" fill={CUT} />}
  />
));

export const SolidScribble = glyph("SolidScribble", () => (
  <>
    <path d="M9 7.2c3-2 5.4-2.4 5.2-1.1-.3 1.7-9.7 8-8.7 10 .9 1.9 11.4-7.5 12.4-5.7.9 1.7-7.6 7.7-6.6 9 .8 1 4.8-1.4 7.2-3.1" {...LINE} />
    <path d="M5 3.8 5.6 5.4 7.2 6 5.6 6.6 5 8.2 4.4 6.6 2.8 6 4.4 5.4Z" {...SOFT} strokeWidth={0.8} />
  </>
));

export const SolidTarget = glyph("SolidTarget", (id) => (
  <>
    <Knockout
      id={id}
      shape={
        <g fill="none" strokeWidth={2.2}>
          <circle cx="12" cy="12" r="8.9" />
          <circle cx="12" cy="12" r="4.9" />
          <circle cx="12" cy="12" r="1.4" fill={KEEP} strokeWidth={0} />
        </g>
      }
      cut={<path d="M12 12 19.5 4.5" stroke={CUT} strokeWidth={5} strokeLinecap="round" />}
    />
    <path d="M12 12 19 5" {...LINE} />
    <path d="M17 3.8V7h3.2L22 5.2h-2.2V3Z" {...SOFT} strokeWidth={1} />
  </>
));

export const SolidProgress = glyph("SolidProgress", () => (
  <g {...LINE} strokeWidth={2.2}>
    <path d={arc(12, 12, 9, 0, 300)} />
    <path d={arc(12, 12, 5.4, 60, 330)} />
    <path d={arc(12, 12, 1.9, 150, 60)} />
  </g>
));

export const SolidMention = glyph("SolidMention", () => (
  <g {...LINE} strokeWidth={2.2}>
    <circle cx="12" cy="12" r="3.6" />
    <path d="M15.6 8.6v4.7a2.6 2.6 0 0 0 5.2 0V12a8.8 8.8 0 1 0-3.5 7" />
  </g>
));

export const SolidLayers = glyph("SolidLayers", (id) => {
  const rhomb = (cy: number) => `M12 ${cy - 4.8}L20.6 ${cy}L12 ${cy + 4.8}L3.4 ${cy}Z`;
  return (
    <g strokeLinejoin="round">
      <Knockout
        id={`${id}b`}
        shape={<path d={rhomb(16.8)} strokeWidth={1.8} />}
        cut={<path d={rhomb(12.3)} fill={CUT} stroke={CUT} strokeWidth={4.8} strokeLinejoin="round" />}
      />
      <Knockout
        id={`${id}m`}
        shape={<path d={rhomb(12.3)} strokeWidth={1.8} />}
        cut={<path d={rhomb(7.8)} fill={CUT} stroke={CUT} strokeWidth={4.8} strokeLinejoin="round" />}
      />
      <path d={rhomb(7.8)} stroke="currentColor" strokeWidth={1.8} />
    </g>
  );
});

/* ── Row 3 — collections & health ─────────────────────────────────────────── */

export const SolidCards = glyph("SolidCards", (id) => {
  const front = <rect x="9.5" y="2.5" width="11" height="15.5" rx="2.2" transform="rotate(8 15 10.25)" />;
  return (
    <>
      <Knockout
        id={id}
        shape={<rect x="3.2" y="5.5" width="11" height="15.5" rx="2.2" transform="rotate(-12 8.7 13.25)" />}
        cut={<g fill={CUT} stroke={CUT} strokeWidth={3}>{front}</g>}
      />
      {front}
    </>
  );
});

function heartWith(name: string, cut: React.ReactNode) {
  return glyph(name, (id) => (
    <Knockout id={id} shape={<path d={HEART} strokeWidth={1.5} strokeLinejoin="round" />} cut={cut} />
  ));
}
const CUT_LINE = { fill: "none", stroke: CUT, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const SolidHeartPulse = heartWith("SolidHeartPulse", <path d="M6 12.3h3l1.4-2.6 2.6 5 1.4-2.4H18" {...CUT_LINE} />);
export const SolidHeartSleep = heartWith(
  "SolidHeartSleep",
  <path d="M13.2 9.4a3 3 0 1 0 1.6 4.4 2.4 2.4 0 0 1-1.6-4.4Z" fill={CUT} />,
);
export const SolidHeartDown = heartWith("SolidHeartDown", <path d="M12 9v6M9.5 12.5 12 15l2.5-2.5" {...CUT_LINE} />);
export const SolidHeartUp = heartWith("SolidHeartUp", <path d="M12 15V9M9.5 11.5 12 9l2.5 2.5" {...CUT_LINE} />);

export const SolidScale = glyph("SolidScale", (id) => (
  <Knockout
    id={id}
    shape={SQUIRCLE}
    cut={
      <>
        <path d="M7 10.5a5 4.2 0 0 1 10 0Z" fill={CUT} stroke={CUT} strokeWidth={1} strokeLinejoin="round" />
        <path d="M12 10.2 13.6 7.6" stroke={KEEP} strokeWidth={1.4} strokeLinecap="round" />
      </>
    }
  />
));

export const SolidGif = glyph("SolidGif", (id) => (
  <Knockout
    id={id}
    shape={SQUIRCLE}
    cut={
      <text
        x="12"
        y="14.6"
        textAnchor="middle"
        fontSize="7.2"
        fontWeight={800}
        letterSpacing="0.2"
        fontFamily="var(--font-sans, system-ui), system-ui, sans-serif"
        fill={CUT}
      >
        GIF
      </text>
    }
  />
));

/* ── Row 4 — content, devices & actions ───────────────────────────────────── */

export const SolidNote = glyph("SolidNote", (id) => (
  <Knockout id={id} shape={SQUIRCLE} cut={<path d="M7.5 10h9M7.5 14h5" {...CUT_LINE} strokeWidth={2} />} />
));

export const SolidChat = glyph("SolidChat", () => (
  <path d="M12 2.8a9.2 9.2 0 1 0 5 16.9l3.4 1.1a.7.7 0 0 0 .9-.9l-1.1-3.4A9.2 9.2 0 0 0 12 2.8Z" />
));

export const SolidImage = glyph("SolidImage", (id) => (
  <Knockout
    id={id}
    shape={SQUIRCLE}
    cut={
      <>
        <circle cx="8.8" cy="8.8" r="1.9" fill={CUT} />
        <path d="M6.5 17.5c1.6-2.6 3.8-3.6 6-2.2 1.3-1.2 3.3-1.2 5 .1v1.1a1 1 0 0 1-1 1Z" fill={CUT} stroke={CUT} strokeWidth={1} strokeLinejoin="round" />
      </>
    }
  />
));

export const SolidDevices = glyph("SolidDevices", (id) => (
  <>
    <Knockout
      id={id}
      shape={<rect x="3" y="2.5" width="10.5" height="19" rx="2.6" />}
      cut={<path d="M6.8 18.2h3.9" stroke={CUT} strokeWidth={1.6} strokeLinecap="round" />}
    />
    <rect x="16.3" y="6" width="3.9" height="12" rx="1" />
    <rect x="15" y="8.5" width="6.5" height="7" rx="1.8" />
  </>
));

export const SolidAppBadge = glyph("SolidAppBadge", (id) => (
  <>
    <Knockout
      id={id}
      shape={<rect x="3" y="4" width="17" height="17" rx="5" />}
      cut={<circle cx="19" cy="5" r="4.6" fill={CUT} />}
    />
    <circle cx="19" cy="5" r="2.9" />
  </>
));

export const SolidMeasure = glyph("SolidMeasure", (id) => (
  <>
    <Knockout
      id={`${id}r`}
      shape={
        <>
          <path d="M2.5 8.2a6 3.2 0 0 1 12 0v7.6a6 3.2 0 0 1-12 0Z" />
          <rect x="11" y="13" width="10.5" height="6" rx="1.3" />
        </>
      }
      cut={
        <>
          <ellipse cx="8.5" cy="8.2" rx="3.4" ry="1.5" fill={CUT} />
          <path d="M14.3 13v2.6M17 13v1.6M19.6 13v2.6" stroke={CUT} strokeWidth={1.2} strokeLinecap="round" />
          <path d="M3.5 14.6c1.8 1.4 8.2 1.4 10 0" fill="none" stroke={CUT} strokeWidth={1.1} strokeLinecap="round" />
        </>
      }
    />
    <ellipse cx="8.5" cy="8.2" rx="1.3" ry="0.6" />
  </>
));

export const SolidLogOut = glyph("SolidLogOut", (id) => (
  <>
    <Knockout
      id={id}
      shape={<path d="M4 5.2A2 2 0 0 1 5.6 3.3l5.2-1a1.6 1.6 0 0 1 1.9 1.6v16.2a1.6 1.6 0 0 1-1.9 1.6l-5.2-1A2 2 0 0 1 4 18.8Z" />}
      cut={<path d="M9.5 12h4" stroke={CUT} strokeWidth={4.6} strokeLinecap="round" />}
    />
    <path d="M9.5 12h11M17.6 9l3 3-3 3" {...LINE} strokeWidth={2.2} />
  </>
));

/* ── Registry — the canonical order the DS portal canvas renders ──────────── */

export const SOLID_GLYPHS = [
  { name: "Home", Glyph: SolidHome },
  { name: "Apps", Glyph: SolidApps },
  { name: "Trophy", Glyph: SolidTrophy },
  { name: "User", Glyph: SolidUser },
  { name: "User add", Glyph: SolidUserAdd },
  { name: "Users", Glyph: SolidUsers },
  { name: "Compass", Glyph: SolidCompass },
  { name: "Pencil", Glyph: SolidPencil },
  { name: "Settings", Glyph: SolidSettings },
  { name: "Scribble", Glyph: SolidScribble },
  { name: "Target", Glyph: SolidTarget },
  { name: "Progress", Glyph: SolidProgress },
  { name: "Mention", Glyph: SolidMention },
  { name: "Layers", Glyph: SolidLayers },
  { name: "Cards", Glyph: SolidCards },
  { name: "Heart pulse", Glyph: SolidHeartPulse },
  { name: "Heart sleep", Glyph: SolidHeartSleep },
  { name: "Heart down", Glyph: SolidHeartDown },
  { name: "Heart up", Glyph: SolidHeartUp },
  { name: "Scale", Glyph: SolidScale },
  { name: "GIF", Glyph: SolidGif },
  { name: "Note", Glyph: SolidNote },
  { name: "Chat", Glyph: SolidChat },
  { name: "Image", Glyph: SolidImage },
  { name: "Devices", Glyph: SolidDevices },
  { name: "App badge", Glyph: SolidAppBadge },
  { name: "Measure", Glyph: SolidMeasure },
  { name: "Log out", Glyph: SolidLogOut },
] as const;

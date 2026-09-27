"use client";
// Illustration kit — the parts every product scene is assembled from. Scenes are
// drawn at a fixed design size (e.g. 400×300) and <Scene> scales them to the
// tile, so a scene stays pixel-exact from a phone to a 4K board. All color, type,
// shadow and motion comes from app/illustrations.css (the --ill-* tokens).
import * as React from "react";
import { Icon, Mark } from "@/components/ds/ui/icon";
import { Check } from "@/components/ds/icons";
import { cn } from "@/lib/cn";

// ─── Scene: fixed design canvas, scaled to fit its container ──────────────────
export function Scene({
  width,
  height,
  label,
  aura,
  className,
  children,
}: {
  width: number;
  height: number;
  /** What the scene shows, for screen readers (the drawing itself is hidden). */
  label: string;
  aura?: "quiet";
  className?: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / width);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      data-aura={aura}
      className={cn("ill-stage w-full", className)}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <div
        aria-hidden
        className="absolute left-0 top-0 origin-top-left"
        style={{ width, height, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}

// Absolute placement inside a scene, in design pixels.
export function At({
  x,
  y,
  w,
  h,
  z,
  className,
  style,
  children,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  z?: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("absolute", className)} style={{ left: x, top: y, width: w, height: h, zIndex: z, ...style }}>
      {children}
    </div>
  );
}

// ─── Window: a product surface (card, panel, popover) ─────────────────────────
// `glass` adds the frosted outer rim from the brand frames.
export function Window({
  glass,
  elevation = "float",
  className,
  style,
  children,
}: {
  glass?: boolean;
  elevation?: "flat" | "raised" | "float";
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const shadow = elevation === "flat" ? "shadow-ill-1" : elevation === "raised" ? "shadow-ill-2" : "shadow-ill-float";
  const body = (
    <div className={cn("relative overflow-hidden rounded-xl bg-ill-surface", shadow, glass ? "h-full" : className)} style={glass ? undefined : style}>
      {children}
    </div>
  );
  if (!glass) return body;
  return (
    <div
      className={cn("rounded-2xl p-2", className)}
      style={{
        background: "color-mix(in srgb, var(--ill-surface) 55%, transparent)",
        boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--ill-surface) 70%, transparent), var(--ill-shadow-2)",
        backdropFilter: "blur(8px)",
        ...style,
      }}
    >
      {body}
    </div>
  );
}

// ─── Brand mark in berry ──────────────────────────────────────────────────────
export function BrandMark({ size = 16 }: { size?: number }) {
  return <Mark size={size} style={{ color: "var(--ill-accent)" }} />;
}

// ─── Checkbox (static) ────────────────────────────────────────────────────────
export function Tick({ done, size = 16 }: { done?: boolean; size?: number }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-[5px]",
        done ? "bg-ill-solid text-ill-on-solid" : "bg-ill-surface",
      )}
      style={{ width: size, height: size, boxShadow: done ? undefined : "inset 0 0 0 1.5px var(--ill-line-strong)" }}
    >
      {done && <Icon icon={Check} size={size - 4} strokeWidth={2.5} />}
    </span>
  );
}

// ─── Task row ─────────────────────────────────────────────────────────────────
export function TaskRow({
  title,
  meta,
  done,
  divider = true,
  className,
  children,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  done?: boolean;
  divider?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-center gap-3 px-4 py-2", divider && "border-t border-ill-line", className)}>
      <Tick done={done} />
      <span className={cn("ill-t-small min-w-0 flex-1 truncate", done ? "text-ill-ink-3 line-through decoration-ill-ink-4" : "text-ill-ink-1")}>
        {title}
      </span>
      {children}
      {meta && <span className="ill-t-caption shrink-0 text-ill-ink-3">{meta}</span>}
    </div>
  );
}

// ─── Chip: a small floating label with an optional glyph ──────────────────────
export function Chip({
  icon,
  tone = "surface",
  className,
  style,
  children,
}: {
  icon?: React.ReactNode;
  tone?: "surface" | "solid" | "accent" | "quiet";
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const tones = {
    surface: "bg-ill-surface text-ill-ink-1 shadow-ill-2",
    solid: "bg-ill-solid text-ill-on-solid shadow-ill-2",
    accent: "bg-ill-accent-soft text-ill-accent",
    quiet: "bg-ill-surface-3 text-ill-ink-2",
  } as const;
  return (
    <span className={cn("ill-t-caption inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 font-medium", tones[tone], className)} style={style}>
      {icon}
      {children}
    </span>
  );
}

// ─── Dot: label color swatch ──────────────────────────────────────────────────
export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: color }} />;
}

// ─── Key: a keycap. `big` for the keyboard scene, default for inline hints ────
export function Key({
  children,
  big,
  active,
  className,
  style,
}: {
  children: React.ReactNode;
  big?: boolean;
  active?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center font-medium",
        big ? "ill-t-h4 h-12 min-w-12 rounded-lg px-3" : "ill-t-micro h-5 min-w-5 rounded-[5px] px-1 text-ill-ink-3",
        active ? "bg-ill-solid text-ill-on-solid" : "bg-ill-surface",
        className,
      )}
      style={{ boxShadow: active ? undefined : big ? "var(--ill-shadow-key)" : "inset 0 -1px 0 var(--ill-line), 0 0 0 1px var(--ill-line-strong)", ...style }}
    >
      {children}
    </span>
  );
}

// ─── Person: initials avatar with a warm gradient (never a stock photo) ───────
export function Person({ initials, size = 28, hue = "berry" }: { initials: string; size?: number; hue?: "berry" | "indigo" | "ochre" | "slate" }) {
  const fills = {
    berry: "linear-gradient(135deg, var(--color-berry-300), var(--color-berry-500))",
    indigo: "linear-gradient(135deg, #B4AEDD, var(--ill-label-indigo))",
    ochre: "linear-gradient(135deg, #EAC985, var(--ill-label-ochre))",
    slate: "linear-gradient(135deg, #A3C2DB, var(--ill-label-slate))",
  } as const;
  return (
    <span
      className="ill-t-micro grid shrink-0 place-items-center rounded-full text-white"
      style={{ width: size, height: size, background: fills[hue], boxShadow: "0 0 0 2px var(--ill-surface)" }}
    >
      {initials}
    </span>
  );
}

// ─── Cursor: a pointer with a name tag (collaborator or "You") ───────────────
export function Cursor({ name, color = "var(--ill-label-indigo)", className, style }: { name: string; color?: string; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={cn("pointer-events-none absolute flex items-start", className)} style={style}>
      <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
        <path d="M1.5 1.5 L14 8.2 L8.3 9.6 L5.6 15.8 Z" fill={color} stroke="white" strokeWidth="1.25" strokeLinejoin="round" />
      </svg>
      <span className="ill-t-micro mt-3 -ml-1 rounded-sm px-1 py-0.5 text-white" style={{ background: color }}>
        {name}
      </span>
    </span>
  );
}

// ─── Skeleton text line ───────────────────────────────────────────────────────
export function Bar({ w, h = 6, className, strong }: { w: number | string; h?: number; className?: string; strong?: boolean }) {
  return <span className={cn("block rounded-full", className)} style={{ width: w, height: h, background: strong ? "var(--ill-ink-4)" : "var(--ill-skeleton)" }} />;
}

// ─── Connector: a dashed rail with a travelling signal dot ────────────────────
export function Connector({ width, delay = 0 }: { width: number; delay?: number }) {
  return (
    <span className="relative block h-px" style={{ width, backgroundImage: "linear-gradient(90deg, var(--ill-line-strong) 50%, transparent 50%)", backgroundSize: "6px 1px" }}>
      <span
        className="ill-anim ill-travel absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ill-accent"
        style={{ animationDelay: `${delay}s`, boxShadow: "0 0 0 3px var(--ill-accent-soft)" }}
      />
    </span>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
export function Meter({ value, w, tone = "ink" }: { value: number; w: number; tone?: "ink" | "accent" | "success" }) {
  const fill = tone === "accent" ? "var(--ill-accent)" : tone === "success" ? "var(--ill-success)" : "var(--ill-ink-1)";
  return (
    <span className="block h-1 overflow-hidden rounded-full bg-ill-surface-3" style={{ width: w }}>
      <span className="block h-full rounded-full" style={{ width: `${Math.round(value * 100)}%`, background: fill }} />
    </span>
  );
}

// ─── Ring: circular progress (used for highlight + focus timer) ───────────────
export function Ring({
  size,
  stroke,
  value,
  tone = "accent",
  animate,
  children,
}: {
  size: number;
  stroke: number;
  value: number;
  tone?: "accent" | "ink";
  animate?: boolean;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ill-surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone === "accent" ? "var(--ill-accent)" : "var(--ill-ink-1)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset={100 - value * 100}
          className={animate ? "ill-anim ill-sweep" : undefined}
        />
      </svg>
      {children}
    </span>
  );
}

import * as React from "react";
import { Check, Pipette } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { Tooltip } from "./tooltip";
import { LABEL_COLORS, LABEL_SOLID, type LabelColor } from "@/lib/labelColor";

// ─── Colour palette (§4.22) — choosing a LABEL colour, the common case ──────
// 5×2 grid, 24px swatches. Every swatch has a NAME (tooltip + aria-label) —
// colour-blind users choose by name. 2D roving focus.
export interface ColorPaletteProps {
  value: LabelColor | null;
  onValueChange: (c: LabelColor) => void;
  "aria-label"?: string;
  className?: string;
}

const CHECK_TEXT: Record<LabelColor, string> = {
  stone: "text-label-stone-text",
  berry: "text-label-berry-text",
  rust: "text-label-rust-text",
  ochre: "text-label-ochre-text",
  moss: "text-label-moss-text",
  teal: "text-label-teal-text",
  slate: "text-label-slate-text",
  indigo: "text-label-indigo-text",
  plum: "text-label-plum-text",
  clay: "text-label-clay-text",
};
const FILL: Record<LabelColor, string> = {
  stone: "bg-label-stone-fill",
  berry: "bg-label-berry-fill",
  rust: "bg-label-rust-fill",
  ochre: "bg-label-ochre-fill",
  moss: "bg-label-moss-fill",
  teal: "bg-label-teal-fill",
  slate: "bg-label-slate-fill",
  indigo: "bg-label-indigo-fill",
  plum: "bg-label-plum-fill",
  clay: "bg-label-clay-fill",
};

export function ColorPalette({ value, onValueChange, className, ...aria }: ColorPaletteProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const COLS = 5;

  const move = (from: number, dx: number, dy: number) => {
    const next = Math.min(LABEL_COLORS.length - 1, Math.max(0, from + dx + dy * COLS));
    const el = ref.current?.querySelectorAll<HTMLElement>("[role=radio]")[next];
    el?.focus();
  };

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={aria["aria-label"] ?? "Colour"}
      className={cn("grid w-fit grid-cols-5 gap-1.5", className)}
    >
      {LABEL_COLORS.map((c, i) => {
        const selected = value === c;
        return (
          <Tooltip key={c} content={c[0].toUpperCase() + c.slice(1)}>
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={c}
              tabIndex={selected || (value === null && i === 0) ? 0 : -1}
              onClick={() => onValueChange(c)}
              onKeyDown={(e) => {
                const map: Record<string, [number, number]> = {
                  ArrowRight: [1, 0],
                  ArrowLeft: [-1, 0],
                  ArrowDown: [0, 1],
                  ArrowUp: [0, -1],
                };
                if (map[e.key]) {
                  e.preventDefault();
                  move(i, ...map[e.key]);
                } else if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  onValueChange(c);
                }
              }}
              className={cn(
                "focus-ring grid size-6 place-items-center rounded-xs shadow-[inset_0_0_0_1px_var(--color-border-soft)]",
                FILL[c],
                selected && "ring-2 ring-ink-800 ring-offset-2 ring-offset-paper",
              )}
            >
              {selected && <Check className={cn("size-3.5", CHECK_TEXT[c])} strokeWidth={2.5} aria-hidden />}
              <span className="sr-only">{c}</span>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

// ─── Colour picker (§4.22) — arbitrary hex; workspace branding only ─────────
// SV square + hue slider + hex field (authoritative, parses #fff/rgb()/fff) +
// eyedropper where the API exists + live contrast pass/fail vs paper & ink-900.

function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.trim().replace(/^#/, "");
  const rgbM = hex.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (rgbM) return [+rgbM[1], +rgbM[2], +rgbM[3]];
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgbToHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("").toUpperCase();

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5) * 255, f(3) * 255, f(1) * 255];
}
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max];
}
function contrast(fg: [number, number, number], bg: [number, number, number]) {
  const lum = ([r, g, b]: [number, number, number]) => {
    const f = (c: number) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const a = lum(fg) + 0.05, b2 = lum(bg) + 0.05;
  return Math.max(a, b2) / Math.min(a, b2);
}

export function ColorPicker({ value, onValueChange, className }: { value: string; onValueChange: (hex: string) => void; className?: string }) {
  const rgb = hexToRgb(value) ?? [196, 28, 114];
  const [hsv, setHsv] = React.useState(() => rgbToHsv(...rgb));
  const [hexDraft, setHexDraft] = React.useState(value.toUpperCase());
  const svRef = React.useRef<HTMLDivElement>(null);

  const commitHsv = (h: number, s: number, v: number) => {
    setHsv([h, s, v]);
    const next = rgbToHex(...hsvToRgb(h, s, v));
    setHexDraft(next);
    onValueChange(next);
  };

  const pickSv = (e: React.PointerEvent) => {
    const r = svRef.current!.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const v = 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    commitHsv(hsv[0], s, v);
  };

  const parseHex = (raw: string) => {
    const p = hexToRgb(raw);
    if (!p) return;
    setHsv(rgbToHsv(...p));
    const hx = rgbToHex(...p);
    setHexDraft(hx);
    onValueChange(hx);
  };

  const cPaper = contrast(rgb, [247, 246, 242]);
  const cInk = contrast(rgb, [27, 26, 23]);
  const hueHex = rgbToHex(...hsvToRgb(hsv[0], 1, 1));
  const supportsEyeDropper = typeof window !== "undefined" && "EyeDropper" in window;

  return (
    <div className={cn("flex w-64 flex-col gap-3", className)}>
      {/* SV square */}
      <div
        ref={svRef}
        role="slider"
        aria-label="Saturation and brightness"
        aria-valuetext={`Saturation ${Math.round(hsv[1] * 100)}%, brightness ${Math.round(hsv[2] * 100)}%`}
        aria-valuenow={Math.round(hsv[1] * 100)}
        tabIndex={0}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          pickSv(e);
        }}
        onPointerMove={(e) => e.buttons === 1 && pickSv(e)}
        onKeyDown={(e) => {
          const step = 0.02;
          if (e.key === "ArrowRight") commitHsv(hsv[0], Math.min(1, hsv[1] + step), hsv[2]);
          if (e.key === "ArrowLeft") commitHsv(hsv[0], Math.max(0, hsv[1] - step), hsv[2]);
          if (e.key === "ArrowUp") commitHsv(hsv[0], hsv[1], Math.min(1, hsv[2] + step));
          if (e.key === "ArrowDown") commitHsv(hsv[0], hsv[1], Math.max(0, hsv[2] - step));
        }}
        className="focus-ring relative h-36 w-full cursor-crosshair touch-none rounded-md"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueHex})`,
        }}
      >
        <span
          aria-hidden
          className="absolute size-3 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-paper shadow-lift-1"
          style={{ left: `${hsv[1] * 100}%`, bottom: `${hsv[2] * 100}%`, background: value }}
        />
      </div>

      {/* Hue slider */}
      <input
        type="range"
        min={0}
        max={360}
        value={Math.round(hsv[0])}
        aria-label="Hue"
        onChange={(e) => commitHsv(+e.target.value, hsv[1], hsv[2])}
        className="h-2 w-full cursor-pointer appearance-none rounded-full"
        style={{
          background:
            "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
        }}
      />

      {/* Hex (authoritative) + eyedropper + swatch */}
      <div className="flex items-center gap-2">
        <span aria-hidden className="size-6 shrink-0 rounded-xs shadow-[inset_0_0_0_1px_var(--color-border-soft)]" style={{ background: value }} />
        <input
          value={hexDraft}
          aria-label="Hex colour"
          onChange={(e) => setHexDraft(e.target.value)}
          onBlur={() => parseHex(hexDraft)}
          onKeyDown={(e) => e.key === "Enter" && parseHex(hexDraft)}
          className="h-7 w-24 rounded-sm border border-line-strong bg-paper px-2 font-mono text-mono-sm text-ink-900 focus:border-berry-500 focus:outline-none focus:ring-2 focus:ring-berry-alpha-20"
        />
        {supportsEyeDropper && (
          <button
            type="button"
            aria-label="Pick from screen"
            onClick={async () => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const res = await new (window as any).EyeDropper().open();
                parseHex(res.sRGBHex);
              } catch {
                /* cancelled */
              }
            }}
            className="focus-ring grid size-7 place-items-center rounded-sm text-ink-500 hover:bg-paper-3 hover:text-ink-800"
          >
            <Pipette className="size-3.5" aria-hidden />
          </button>
        )}
      </div>

      {/* Live contrast readout (§4.22) — never let a brand colour fail silently */}
      <div className="flex gap-2">
        {[
          { name: "on paper", ratio: cPaper },
          { name: "on ink", ratio: cInk },
        ].map((c) => (
          <span
            key={c.name}
            className={cn(
              "inline-flex h-5 items-center gap-1 rounded-xs px-1.5 text-caption font-medium",
              c.ratio >= 4.5 ? "bg-success-100 text-success-600" : "bg-danger-100 text-danger-600",
            )}
          >
            {c.ratio >= 4.5 ? "AA" : "Fail"} {c.ratio.toFixed(1)}:1 {c.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export { LABEL_SOLID };

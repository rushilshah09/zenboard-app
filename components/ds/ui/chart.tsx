import * as React from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

// design-system.md §4.55 — two colours by default (berry primary, ink-300
// comparison), horizontal ink-050 gridlines only, y starts at zero, and EVERY
// chart has a table alternative ("View as table") — non-negotiable.
export interface ChartSeries {
  name: string;
  values: number[];
  kind?: "primary" | "comparison";
}

export interface ChartProps {
  type: "line" | "bar";
  labels: string[];
  series: ChartSeries[];
  /** Formats values in the table + tooltip, e.g. (v) => `₹${v}k`. */
  format?: (v: number) => string;
  title: string;
  height?: number;
  className?: string;
}

export function Chart({ type, labels, series, format = String, title, height = 160, className }: ChartProps) {
  const [asTable, setAsTable] = React.useState(false);
  const max = Math.max(...series.flatMap((s) => s.values), 1);
  const W = 400;
  const stroke = (s: ChartSeries) => (s.kind === "comparison" ? "var(--color-ink-300)" : "var(--color-berry-500)");

  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      <figcaption className="flex items-center justify-between">
        <span className="text-body font-medium text-ink-900">{title}</span>
        <Button variant="quiet" size="xs" onClick={() => setAsTable((t) => !t)} aria-pressed={asTable}>
          {asTable ? "View as chart" : "View as table"}
        </Button>
      </figcaption>

      {asTable ? (
        <table className="w-full text-ui">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="h-8 px-2 text-start font-semibold text-ink-600"> </th>
              {labels.map((l) => (
                <th key={l} scope="col" className="h-8 px-2 text-end font-semibold text-ink-600">{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {series.map((s) => (
              <tr key={s.name} className="border-b border-line-soft">
                <th scope="row" className="h-8 px-2 text-start font-medium text-ink-800">{s.name}</th>
                {s.values.map((v, i) => (
                  <td key={i} className="h-8 px-2 text-end font-mono text-ink-700" data-numeric>{format(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label={`${title} — use "View as table" for the data`}>
            {/* horizontal gridlines only (§4.55) */}
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <line key={f} x1={0} x2={W} y1={height - f * (height - 20)} y2={height - f * (height - 20)} stroke="var(--color-ink-050)" strokeWidth={1} />
            ))}
            {type === "line"
              ? series.map((s) => (
                  <polyline
                    key={s.name}
                    fill="none"
                    stroke={stroke(s)}
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                    points={s.values.map((v, i) => `${(i / (s.values.length - 1)) * (W - 8) + 4},${height - (v / max) * (height - 20)}`).join(" ")}
                  />
                ))
              : labels.map((_, i) => {
                  const group = series.length;
                  const slot = (W - 16) / labels.length;
                  const bw = Math.min(24, (slot - 8) / group);
                  return series.map((s, si) => {
                    const h = (s.values[i] / max) * (height - 20);
                    return (
                      <rect
                        key={`${s.name}-${i}`}
                        x={8 + i * slot + (slot - bw * group) / 2 + si * bw}
                        y={height - h}
                        width={bw - 2}
                        height={h}
                        rx={2}
                        fill={stroke(s)}
                      />
                    );
                  });
                })}
          </svg>
          <div className="flex justify-between px-1">
            {labels.map((l) => (
              <span key={l} className="font-mono text-caption text-ink-500">{l}</span>
            ))}
          </div>
          {series.length > 1 && (
            <div className="flex gap-4">
              {series.map((s) => (
                <span key={s.name} className="flex items-center gap-1.5 text-meta text-ink-600">
                  <span aria-hidden className="size-2 rounded-full" style={{ background: stroke(s) }} />
                  {s.name}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </figure>
  );
}

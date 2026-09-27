"use client";
// Feature grid — the marketing features section. Each cell is an icon tile, a
// title and one sentence, then the feature's illustration in the demo slot. The
// grid is one surface split by hairlines; cells differ only in span and stage
// height, so every illustration sits in the same structure.
import * as React from "react";
import { Icon } from "@/components/ds/ui/icon";
import { SceneFit } from "./primitives";
import { ILLUSTRATIONS, type IllustrationEntry } from "./scenes";
import { cn } from "@/lib/cn";

// Span on the 6-column desktop grid (2 columns on tablet, 1 on phone) and the
// stage height. The command palette runs the height of the two cells beside it.
const LAYOUT: Record<string, { span: string; stage: string }> = {
  "request-to-task": { span: "md:col-span-2 lg:col-span-6", stage: "h-[260px] md:h-[380px]" },
  today:             { span: "lg:col-span-3", stage: "h-[260px] md:h-[320px]" },
  projects:          { span: "lg:col-span-3", stage: "h-[260px] md:h-[320px]" },
  command:           { span: "md:col-span-2 lg:col-span-3 lg:row-span-2", stage: "h-[300px] md:h-[360px] lg:h-auto lg:flex-1 lg:min-h-[420px]" },
  shortcuts:         { span: "lg:col-span-3", stage: "h-[240px] md:h-[260px]" },
  focus:             { span: "lg:col-span-3", stage: "h-[240px] md:h-[260px]" },
  calendar:          { span: "lg:col-span-2", stage: "h-[240px] md:h-[260px]" },
  digest:            { span: "lg:col-span-2", stage: "h-[240px] md:h-[260px]" },
  integrations:      { span: "md:col-span-2 lg:col-span-2", stage: "h-[240px] md:h-[260px]" },
};

export function FeatureGrid({ entries = ILLUSTRATIONS, className }: { entries?: IllustrationEntry[]; className?: string }) {
  return (
    <div
      className={cn("grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-ill-line md:grid-cols-2 lg:grid-cols-6", className)}
      style={{ boxShadow: "0 0 0 1px var(--ill-line)" }}
    >
      {entries.map((entry) => (
        <FeatureCell key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

export function FeatureCell({ entry, className }: { entry: IllustrationEntry; className?: string }) {
  const layout = LAYOUT[entry.id] ?? { span: "", stage: "h-[260px]" };
  const { Scene } = entry;
  const titleId = `feature-${entry.id}`;
  return (
    <section
      aria-labelledby={titleId}
      tabIndex={0}
      className={cn("ill-tile ill-cell flex flex-col gap-8 bg-ill-page p-6 md:p-10", layout.span, className)}
    >
      <header className="flex items-start gap-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-ill-feature-icon-bg text-ill-feature-icon-ink">
          <Icon icon={entry.icon} size={24} strokeWidth={2} />
        </span>
        <div className="flex min-w-0 flex-col gap-1 pt-1">
          <h3 id={titleId} className="ill-t-title font-medium">{entry.title}</h3>
          <p className="ill-t-body-lg max-w-[560px] text-ill-ink-2">{entry.description}</p>
        </div>
      </header>
      <div className={cn("overflow-hidden rounded-xl", layout.stage)}>
        <SceneFit fit="contain">
          <Scene />
        </SceneFit>
      </div>
    </section>
  );
}

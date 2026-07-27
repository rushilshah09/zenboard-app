// The framed-panel CARD pattern now lives in the design system
// (design-system/src/components/ui/panel.tsx → mirrored to components/ds/ui/panel).
// This module re-exports it so existing call sites keep importing from
// '@/components/ui/panels', while all card styling (radius, elevation, surfaces,
// the single-border architecture) is token-driven and owned by the DS — change a
// token once and every panel across the app updates. Never restyle a card here.
import * as React from 'react';

export { Panel, PanelHeader, PanelBody, type PanelProps } from '@/components/ds/ui/panel';

// Three ascending signal bars — the priority glyph ("Zenboard — design"
// PriorityTags, node 23:7402). Shared by tags, menus, and composer chips.
export function PriorityBars({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <rect x="1" y="8" width="3" height="5" rx="1" fill={color} />
      <rect x="5.5" y="5" width="3" height="8" rx="1" fill={color} />
      <rect x="10" y="2" width="3" height="11" rx="1" fill={color} />
    </svg>
  );
}

// Tag chip ("Zenboard — design" Tags/PriorityTags, nodes 23:7319/23:7402):
// States/Selected wash, p-4, radius-tag 5, 12px glyph (folder / priority bars /
// 3×10 bar), Geist Regular 12/1 ink-600 label.
export function FigmaTag({
  icon,
  bar,
  priority,
  children,
}: {
  icon?: React.ReactNode;
  bar?: string;      // CSS color for the legacy 3×10 shape variant
  priority?: string; // CSS color for the signal-bars priority glyph
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-tag bg-surface-fill p-1">
      {priority ? (
        <PriorityBars color={priority} />
      ) : bar ? (
        <span aria-hidden className="h-[10px] w-[3px] rounded-full" style={{ background: bar }} />
      ) : (
        icon
      )}
      <span className="text-meta leading-none text-ink-600">{children}</span>
    </span>
  );
}

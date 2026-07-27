// Typography scale — single source of truth for text styling in inline `style={{}}`
// objects (the majority pattern in this codebase; see components/ui/primitives.tsx
// for the Tailwind-class equivalent used by className-based components).
//
// Each level reads its size/line-height/weight/tracking from the CSS custom
// properties defined in app/globals.css, so the scale stays in one place and
// still works with the dark-mode / density overrides those tokens carry.
//
// Usage: style={{ ...TYPE.h2, color: 'var(--ink)' }}
import type { CSSProperties } from 'react';

function level(name: string, tracking = false): CSSProperties {
  return {
    fontSize: `var(--text-${name}-size)`,
    lineHeight: `var(--text-${name}-lh)`,
    fontWeight: `var(--text-${name}-weight)` as unknown as number,
    ...(tracking ? { letterSpacing: `var(--text-${name}-tracking)` } : {}),
  };
}

export const TYPE = {
  display: { ...level('display', true), fontFamily: 'var(--font-display)' },
  h1: { ...level('h1', true), fontFamily: 'var(--font-display)' },
  /** Big KPI/metric numbers (StatTile and equivalents) — distinct from h1 page titles. */
  stat: { ...level('stat', true), fontFamily: 'var(--font-display)' },
  /** DS §4.2.2: card/featured titles are Geist 16/600 — not the display face. */
  h2: { ...level('h2', true), fontFamily: 'var(--font-body)' },
  h3: { ...level('h3', true), fontFamily: 'var(--font-display)' },
  h4: { ...level('h4', true), fontFamily: 'var(--font-display)' },
  bodyLg: level('body-lg'),
  body: level('body'),
  small: level('small'),
  caption: level('caption'),
  /** Micro-label (stat-card captions, column headers) — uppercase body sans, not
      mono: the mono treatment read "terminal" next to the rest of the UI. */
  label: { ...level('label', true), fontFamily: 'var(--font-body)', textTransform: 'uppercase' as const },
  /** DS §4.2.2 micro (10/500): badges, kbd, eyebrows. Callers add uppercase. */
  micro: level('micro', true),
  /** DS §4.2.2 nano (8/500): notification count badges only. */
  nano: level('nano', true),
  code: { ...level('code'), fontFamily: 'var(--font-mono)' },
} satisfies Record<string, CSSProperties>;

export type TypeLevel = keyof typeof TYPE;

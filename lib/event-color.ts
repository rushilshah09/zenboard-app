// Event colors — Google-Calendar-style, in Zenboard's palette. Every event has a
// single, consistent color: a calm neutral by default, or one the user picks
// from our semantic palette (accent/plum is an opt-in choice, not the default —
// a wall of brand-accent events reads as noise). The drag preview, the created
// card, and the edited card all resolve through here so they look identical.
// No random/derived colors.
import type { CalEvent } from './calendar';

// Neutral first, then the semantic hues; accent stays selectable for a
// deliberate "brand moment" but is no longer the default.
export const EVENT_COLORS = ['gray', 'blue', 'green', 'orange', 'yellow', 'purple', 'pink', 'red', 'accent'] as const;
export type EventColorName = (typeof EVENT_COLORS)[number];
export const DEFAULT_EVENT_COLOR: EventColorName = 'gray';

const isColor = (c: unknown): c is EventColorName => typeof c === 'string' && (EVENT_COLORS as readonly string[]).includes(c);

/** The event's color name, defaulting to the brand accent. */
export function colorOf(e: Pick<CalEvent, 'color'>): EventColorName {
  return isColor(e.color) ? e.color : DEFAULT_EVENT_COLOR;
}

/** The card tokens (left bar · fill · text) for a color name. Accent = brand default. */
export function eventTokens(color?: string | null): { bar: string; bg: string; text: string } {
  const c = isColor(color) ? color : DEFAULT_EVENT_COLOR;
  if (c === 'accent') {
    return { bar: 'var(--accent)', bg: 'color-mix(in srgb, var(--accent) 10%, var(--paper-2))', text: 'var(--accent-text)' };
  }
  return { bar: `var(--pal-${c}-dot)`, bg: `var(--pal-${c}-bg)`, text: `var(--pal-${c}-text)` };
}

/** The solid swatch color for the picker dot. */
export function swatch(c: EventColorName): string {
  return c === 'accent' ? 'var(--accent)' : `var(--pal-${c}-dot)`;
}

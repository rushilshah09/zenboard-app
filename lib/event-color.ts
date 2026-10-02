// Event colors — Google-Calendar-style, in Zenboard's palette. Every event has a
// single, consistent color: the user's ACCENT by default, or one they pick from
// our semantic palette. The drag preview, the created card, and the edited card
// all resolve through here so they look identical. No random/derived colors.
//
// ── THE DEFAULT WAS GREY, AND THAT WAS THE BUG (2026-09-07, user report) ────
// This file used to lead with `gray` and argue that "a wall of brand-accent
// events reads as noise", with accent parked last as an opt-in "brand moment".
// The argument is real but it was answering the wrong question, because it
// looked at the personal calendar alone. On the actual screen, every OTHER
// calendar already carries a colour — Task blue, Horizon purple, Projects
// green, Clients orange, Money yellow, Documents pink — so defaulting the
// user's own events to neutral made the one calendar that is entirely theirs
// the only colourless thing on it, and the least legible. It also meant the
// Appearance → Accent setting recoloured checkboxes and switches while the
// densest, most-looked-at surface in the app ignored it.
//
// A calendar's own events SHOULD share one identity — that is how you tell them
// from everything overlaid on top. Google's default event colour is the
// calendar's colour, for exactly this reason. That identity is dressed the way
// every palette colour is — see `eventTokens` below (revised 2026-09-21: it had
// been the left bar alone, which read as a stripe on a grey card).
//
// `gray` stays in the palette and stays one click away; it is no longer what
// you get for making an event.
import type { CalEvent } from './calendar';

// Accent first — it is the default, and the picker's first swatch should be the
// one already selected. Then the semantic hues, with the neutral at the end.
export const EVENT_COLORS = ['accent', 'blue', 'green', 'orange', 'yellow', 'purple', 'pink', 'red', 'gray'] as const;
export type EventColorName = (typeof EVENT_COLORS)[number];
export const DEFAULT_EVENT_COLOR: EventColorName = 'accent';

const isColor = (c: unknown): c is EventColorName => typeof c === 'string' && (EVENT_COLORS as readonly string[]).includes(c);

/** The event's color name, defaulting to the user's accent. */
export function colorOf(e: Pick<CalEvent, 'color'>): EventColorName {
  return isColor(e.color) ? e.color : DEFAULT_EVENT_COLOR;
}

/**
 * The card tokens (left bar · fill · text) for a color name.
 *
 * ── EVERY COLOUR IS A TRIO, THE DEFAULT INCLUDED (user, 2026-09-21) ─────────
 * "Why does the default colour look so bad and other colours look good?" A palette hue dresses the whole card —
 * dot, a pale fill and a softened ink, one family — and the default did not: after 2026-09-07 it was the accent bar
 * on the neutral card with neutral text, a stripe pasted onto grey beside cards that were finished.
 *
 * That 09-07 decision answered a real complaint — the first accent card wore the SATURATED accent as its text over a
 * 16% wash, "a wall of one hue" — and the answer was to take the colour away. The better answer is the palette's own
 * recipe: `--event-accent-bg` is a whisper of the accent in the surface (as pale as the palette's fills) and
 * `--event-accent-text` an ink leaning to it, so the default is calm AND of a piece with the hues beside it. Both
 * follow Appearance → Accent. Readable over every accent, both themes: lib/event-color.test.ts.
 */
export function eventTokens(color?: string | null): { bar: string; bg: string; text: string } {
  const c = isColor(color) ? color : DEFAULT_EVENT_COLOR;
  if (c === 'accent') {
    return { bar: 'var(--accent)', bg: 'var(--event-accent-bg)', text: 'var(--event-accent-text)' };
  }
  return { bar: `var(--pal-${c}-dot)`, bg: `var(--pal-${c}-bg)`, text: `var(--pal-${c}-text)` };
}

/** The solid swatch color for the picker dot. */
export function swatch(c: EventColorName): string {
  return c === 'accent' ? 'var(--accent)' : `var(--pal-${c}-dot)`;
}

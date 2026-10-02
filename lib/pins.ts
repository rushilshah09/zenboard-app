// PINS — the sidebar's own list, and the one rule for what may be in it.
//
// The sidebar used to end with a hard-coded "Projects" section. A project is not
// a special kind of record, though: the thing a person wants one click away is
// whatever they are living in this month — two projects, a brief, the invoice
// they keep checking, one task they cannot forget. So the section pins ANY
// record, and the vocabulary of "any record" already exists as `EntityType`
// (lib/connected.ts), which is also what `recordHref` can address. A pin is a
// reference into the fabric, not a new kind of object.
//
// ── WHERE THIS LIVES, AND WHY THERE IS NO MIGRATION ────────────────────────
// `profiles.preferences` is already a free-form JSON column carrying accent,
// density and displayFont. Pins are a per-user preference of exactly that kind,
// so they go in it under one key. Nothing is added to the schema, and pins
// follow the user across devices — which `localStorage` would not do.
//
// Every write is READ-MODIFY-WRITE on the whole object (see lib/actions/pins.ts):
// writing `{ pins }` alone would silently drop the accent the user picked.
import type { EntityType } from '@/lib/connected';

export type Pin = {
  type: EntityType;
  id: string;
  /**
   * The name to draw in the sidebar, COPIED when the pin is made.
   *
   * Deliberately a copy, not a lookup: the sidebar renders on every page, and
   * resolving twenty records' titles before it can paint would make the whole
   * app wait on a list that is only navigation. The cost is that renaming a
   * record does not rename its pin until it is pinned again — the same trade
   * `meetingFromEvent` makes with an event's title, and the same reason.
   */
  label: string;
};

/**
 * A generous ceiling rather than none. The user asked for "almost any amount",
 * and this is not a limit anyone reaches by pinning what they are working on —
 * it is a guard on a JSON column that every page load reads, so one runaway
 * client cannot make the profile row expensive to fetch forever.
 */
export const MAX_PINS = 200;

const isType = (v: unknown, types: readonly string[]): v is EntityType =>
  typeof v === 'string' && types.includes(v);

/**
 * Read pins out of `profiles.preferences`, dropping anything that is not a
 * usable pin. Same discipline as every other JSON-persisted vocabulary here: the
 * column is free-form, so the reader — not the writer — decides what is valid.
 */
export function readPins(preferences: unknown, validTypes: readonly string[]): Pin[] {
  const raw = (preferences as { pins?: unknown } | null | undefined)?.pins;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Pin[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { type, id, label } = item as Record<string, unknown>;
    if (!isType(type, validTypes)) continue;
    if (typeof id !== 'string' || !id) continue;
    // One pin per record. A duplicate is not a second pin, it is the same one
    // twice — and two rows that navigate to the same place is a bug you can see.
    const key = `${type}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ type, id, label: typeof label === 'string' && label.trim() ? label : 'Untitled' });
  }
  return out.slice(0, MAX_PINS);
}

/** The shape written back into `preferences`. */
export function writePins(pins: Pin[]): { pins: Pin[] } {
  return { pins: pins.slice(0, MAX_PINS) };
}

export const pinKey = (p: { type: EntityType; id: string }) => `${p.type}:${p.id}`;

export const isPinned = (pins: Pin[], ref: { type: EntityType; id: string }) =>
  pins.some((p) => p.type === ref.type && p.id === ref.id);

/** Pinning something already pinned is a no-op, not a duplicate. */
export function addPin(pins: Pin[], pin: Pin): Pin[] {
  if (isPinned(pins, pin)) return pins;
  return [...pins, pin].slice(0, MAX_PINS);
}

export function removePin(pins: Pin[], ref: { type: EntityType; id: string }): Pin[] {
  return pins.filter((p) => !(p.type === ref.type && p.id === ref.id));
}

/** Toggle — what a single control needs. */
export function togglePin(pins: Pin[], pin: Pin): Pin[] {
  return isPinned(pins, pin) ? removePin(pins, pin) : addPin(pins, pin);
}

/**
 * Move the pin at `from` so it sits at `to`. Out-of-range indices return the
 * list unchanged rather than throwing: a drag that ends outside the list is a
 * cancelled drag, which is a normal thing to do, not an error.
 */
export function movePin(pins: Pin[], from: number, to: number): Pin[] {
  if (from === to) return pins;
  if (from < 0 || from >= pins.length) return pins;
  if (to < 0 || to >= pins.length) return pins;
  const next = [...pins];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

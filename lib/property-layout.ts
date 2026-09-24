// WHICH of a record's properties you see, and in what order.
//
// ── THE TENSION THIS RESOLVES ───────────────────────────────────────────────
// A project header draws seven labelled facts: Status, Health, Progress,
// Deadline, Client, Started, Sharing. The user called the page "cluttered", an
// afternoon's pass cut the block to three, and the next directive was "this
// information is gone — I want it back as it was."
//
// Both statements are true, and they are not reconcilable by choosing a number.
// Seven facts are clutter to the person who reads a project by its progress and
// reference to the person who bills by its dates — so the app should not be
// deciding. Notion hides any page property and reports "N hidden"; Linear's
// project properties are the same. The answer is not a better default, it is
// giving the decision away.
//
// ── WHERE IT LIVES, AND WHY THERE IS NO MIGRATION ───────────────────────────
// `profiles.preferences` is already a free-form JSON column carrying the accent,
// density, display font, timezone, Google-sync metadata and the sidebar's pins.
// This is a per-user preference of exactly that kind, so it goes in under one
// key. lib/pins.ts is the precedent in every respect, including the rule that
// every write is READ-MODIFY-WRITE on the whole object — writing `{ layouts }`
// alone would take the accent with it.
//
// It is a PREFERENCE, not data: it says what you want to look at, never what is
// true about the project. That is what makes a profile column the right home.
// A custom property with a VALUE would be the opposite — per-record data that a
// second person in the space must see, the client portal must respect and an
// export must carry — and storing that on one user's profile is the kind of
// shortcut that becomes a migration. So this module arranges the built-ins and
// stops there, on purpose.
//
// ── ONE PREFERENCE PER KIND OF RECORD, NOT PER RECORD ───────────────────────
// Hiding Sharing means "I don't read projects by their sharing", not "not on
// this project" — nobody wants to re-hide a row on all forty projects. Same
// shape as a Notion database's property visibility, which is per database and
// not per page.

/**
 * The record kinds with a configurable property block.
 *
 * Closed on purpose: a key in stored preferences that matches no set is junk
 * from a rolled-back release, and the reader drops it. Adding a fourth kind is
 * one word here plus a `propertySet` on that header.
 */
export const PROP_SETS = ['project', 'client'] as const;
export type PropSet = (typeof PROP_SETS)[number];

export type PropLayout = {
  /**
   * The keys this person has an opinion about, in the order they want them.
   *
   * Holds HIDDEN keys too, and keys that are not currently on screen. Both are
   * load-bearing:
   *
   *   · keeping a hidden key's position means unhiding puts it back where it
   *     was, rather than at the bottom;
   *   · keeping a key whose row is conditional (Deadline only exists once a
   *     project has one) means a row does not migrate to the end of the list
   *     every time it briefly disappears.
   *
   * So this is a record of intent, not a snapshot of the screen.
   */
  order: string[];
  /** Keys not to draw. A set, stored as an array because JSON has no sets. */
  hidden: string[];
};

export const EMPTY_LAYOUT: PropLayout = { order: [], hidden: [] };

/** The key under which every set's layout sits inside `preferences`. */
export const PREF_KEY = 'propertyLayouts';

/**
 * A generous ceiling rather than none — the same guard lib/pins.ts puts on its
 * own list, and for the same reason: every page load reads this column, so one
 * runaway client must not be able to make the profile row expensive forever.
 * Keys come from a closed set of built-ins, so this is unreachable in normal use.
 */
export const MAX_KEYS = 100;

/** A property the header was given — the minimum this module needs to arrange. */
export type Keyed = { key: string };

const strings = (v: unknown): string[] => {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of v) {
    // A duplicate key is not two properties, it is one drawn twice — and two
    // rows with the same label is a bug you can see.
    if (typeof item !== 'string' || !item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
    if (out.length >= MAX_KEYS) break;
  }
  return out;
};

/**
 * Read one set's layout out of `profiles.preferences`.
 *
 * Same discipline as every other JSON-persisted vocabulary here: the column is
 * free-form, so the READER decides what is valid. Anything unrecognisable reads
 * as "no opinion", which renders the declared defaults — the state a new account
 * is in, and the correct answer to corrupt preferences.
 */
export function readPropLayout(preferences: unknown, set: PropSet): PropLayout {
  const bag = (preferences as Record<string, unknown> | null | undefined)?.[PREF_KEY];
  const raw = (bag as Record<string, unknown> | null | undefined)?.[set];
  if (!raw || typeof raw !== 'object') return EMPTY_LAYOUT;
  const { order, hidden } = raw as Record<string, unknown>;
  return { order: strings(order), hidden: strings(hidden) };
}

/** Every set's layout, for a write that must not drop the sets it is not touching. */
export function readPropLayouts(preferences: unknown): Record<PropSet, PropLayout> {
  const out = {} as Record<PropSet, PropLayout>;
  for (const set of PROP_SETS) out[set] = readPropLayout(preferences, set);
  return out;
}

/** The shape written back into `preferences`. Normalised on the way out as well
 *  as in, so a client cannot store a layout the reader would reject. */
export function writePropLayouts(all: Partial<Record<PropSet, PropLayout>>): Record<string, unknown> {
  const bag: Record<string, PropLayout> = {};
  for (const set of PROP_SETS) {
    const l = all[set];
    if (!l) continue;
    const order = strings(l.order);
    const hidden = strings(l.hidden);
    // Nothing to say is stored as nothing, not as two empty arrays. It keeps the
    // column honest: a set appears once the person has actually arranged it.
    if (order.length === 0 && hidden.length === 0) continue;
    bag[set] = { order, hidden };
  }
  return { [PREF_KEY]: bag };
}

/**
 * The full order to WRITE: stored order first, then declared keys it has never
 * seen, appended.
 *
 * Appended rather than inserted at their declared neighbour. A new built-in
 * property arriving in a release must SHOW UP for someone who has arranged their
 * header — the alternative, dropping what it does not recognise, means a feature
 * ships invisible to exactly the people who care most about this block. The end
 * of the list is visible and it does not disturb a single choice they made.
 */
export function fullOrder(declared: readonly Keyed[], layout: PropLayout): string[] {
  const known = new Set(layout.order);
  const extra = declared.map((d) => d.key).filter((k) => !known.has(k));
  return [...layout.order, ...extra].slice(0, MAX_KEYS);
}

/**
 * Split the declared properties into what to draw and what is put away.
 *
 * A key in `hidden` that is not currently declared is NOT counted: hiding
 * Sharing and then turning the portal off must not leave a "1 hidden" control
 * that restores nothing. The block reports what you can act on.
 */
export function arrangeProps<T extends Keyed>(declared: readonly T[], layout: PropLayout): {
  visible: T[]; hidden: T[];
} {
  const by = new Map(declared.map((d) => [d.key, d]));
  const away = new Set(layout.hidden);
  const visible: T[] = [];
  const hidden: T[] = [];
  for (const key of fullOrder(declared, layout)) {
    const prop = by.get(key);
    if (!prop) continue;
    (away.has(key) ? hidden : visible).push(prop);
  }
  return { visible, hidden };
}

/**
 * Move a property one place up or down past its nearest VISIBLE neighbour.
 *
 * Past the nearest VISIBLE one specifically — swapping with a hidden row would
 * read as a control that did nothing, which is the worst thing a control can do.
 * The swap happens in the full stored order, so the hidden rows keep their own
 * positions and come back where they were.
 */
export function moveProp(layout: PropLayout, declared: readonly Keyed[], key: string, delta: -1 | 1): PropLayout {
  const order = fullOrder(declared, layout);
  const { visible } = arrangeProps(declared, layout);
  const at = visible.findIndex((p) => p.key === key);
  if (at < 0) return layout;
  const swapWith = visible[at + delta];
  // At an end. Returning the layout unchanged rather than clamping keeps this a
  // no-op instead of a silent reorder; the menu disables the item as well.
  if (!swapWith) return layout;
  const i = order.indexOf(key);
  const j = order.indexOf(swapWith.key);
  if (i < 0 || j < 0) return layout;
  const next = [...order];
  next[i] = swapWith.key;
  next[j] = key;
  return { order: next, hidden: layout.hidden };
}

/**
 * Put a property at a given index among the VISIBLE ones — what a drag produces.
 *
 * Indices are into the visible list because that is what the person is looking
 * at and dragging. The move is then replayed onto the full order so hidden keys
 * are carried along rather than shuffled.
 */
export function reorderProps(layout: PropLayout, declared: readonly Keyed[], from: number, to: number): PropLayout {
  const { visible } = arrangeProps(declared, layout);
  if (from === to) return layout;
  if (from < 0 || from >= visible.length) return layout;
  if (to < 0 || to >= visible.length) return layout;
  const moved = [...visible];
  const [taken] = moved.splice(from, 1);
  moved.splice(to, 0, taken);
  // Rebuild the stored order by walking it and handing out the new visible
  // sequence wherever a visible key used to sit. Every hidden key and every
  // off-screen key keeps its exact index — the drag reorders what was dragged
  // and touches nothing else.
  const order = fullOrder(declared, layout);
  const wasVisible = new Set(visible.map((p) => p.key));
  let n = 0;
  const next = order.map((k) => (wasVisible.has(k) ? moved[n++].key : k));
  return { order: next, hidden: layout.hidden };
}

/** Put a property away. Its position in `order` is kept, so showing it again
 *  returns it to where it was rather than to the end. */
export function hideProp(layout: PropLayout, declared: readonly Keyed[], key: string): PropLayout {
  if (layout.hidden.includes(key)) return layout;
  return { order: fullOrder(declared, layout), hidden: [...layout.hidden, key] };
}

export function showProp(layout: PropLayout, key: string): PropLayout {
  if (!layout.hidden.includes(key)) return layout;
  return { order: layout.order, hidden: layout.hidden.filter((k) => k !== key) };
}

/** Bring everything back and forget the order — one way out of any arrangement. */
export const resetPropLayout = (): PropLayout => EMPTY_LAYOUT;

/** Whether the person has arranged this block at all. Drives the "Reset" item:
 *  an offer to undo something you have not done is noise. */
export const isArranged = (layout: PropLayout): boolean =>
  layout.order.length > 0 || layout.hidden.length > 0;

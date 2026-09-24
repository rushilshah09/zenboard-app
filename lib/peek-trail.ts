// The trail of pages inside a peek — the database row it opened on, then each page
// opened from inside it, as deep as they go. Pure, so going deeper, back, forward
// and along the breadcrumb are tested without a panel.

export type Trail<E> = {
  /** Identity of the page the peek was opened on; a different one starts over. */
  root: string;
  /** From the page the peek opened on to the page showing. Never empty. */
  stack: E[];
  /** Pages stepped back out of, nearest first — what Forward returns to. */
  ahead: E[];
};

export const startTrail = <E>(root: string, entry: E): Trail<E> => ({ root, stack: [entry], ahead: [] });

/** Open a page from inside the one showing. A new way forward forgets the old one. */
export const deeper = <E>(t: Trail<E>, entry: E): Trail<E> => ({ ...t, stack: [...t.stack, entry], ahead: [] });

/** Back one page; the page left becomes the first step forward. The first page stays. */
export const back = <E>(t: Trail<E>): Trail<E> =>
  t.stack.length > 1 ? { ...t, stack: t.stack.slice(0, -1), ahead: [t.stack[t.stack.length - 1], ...t.ahead] } : t;

export const forward = <E>(t: Trail<E>): Trail<E> =>
  t.ahead.length ? { ...t, stack: [...t.stack, t.ahead[0]], ahead: t.ahead.slice(1) } : t;

/** A breadcrumb: back to the page at `index`, and nothing to go forward to. */
export const backTo = <E>(t: Trail<E>, index: number): Trail<E> =>
  index >= 0 && index < t.stack.length - 1 ? { ...t, stack: t.stack.slice(0, index + 1), ahead: [] } : t;

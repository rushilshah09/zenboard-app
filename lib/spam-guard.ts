import 'server-only';
// ── THE TWO QUIET SPAM DEFENCES ─────────────────────────────────────────────
//
// A honeypot field and a time trap, shared by every PUBLIC write in the product (the form renderer
// and the waitlist). They were written for forms and lived privately there; the waitlist needs the
// same two, and two copies of a rule like this drift — one gets a fix, the other keeps the bug.
//
// Both are deliberately FORGIVING, because the cost of a false positive is a real person quietly
// turned away with no way to tell us:
//   · an unknown or unparseable start time is given the benefit of the doubt, never treated as a bot;
//   · a tripped guard is answered with success, not an error — a bot learns nothing, and in the rare
//     case a real person trips it they are not shown a wall.
// The threshold is a PARAMETER, not one constant, because "too fast to be human" depends on how much
// there was to fill in: a page of questions is not a single email field an autofill can complete.

/** Minimum plausible time between opening a form of questions and submitting it. */
export const MIN_FILL_MS = 3000;

/** The same, for a one-field ask. Lower on purpose: a browser autofilling a saved address into a
 *  single input is genuinely fast, and turning that person away would be our bug, not their fraud. */
export const MIN_FILL_MS_SINGLE_FIELD = 1200;

/** A field no human sees; anything in it was typed by something that reads markup, not a page. */
export function trippedHoneypot(honeypot?: string): boolean {
  return typeof honeypot === 'string' && honeypot.trim().length > 0;
}

/** Was this submitted sooner than a person could plausibly have filled it in? */
export function tooFast(startedAt?: unknown, minMs: number = MIN_FILL_MS): boolean {
  if (typeof startedAt !== 'string') return false; // unknown start ⇒ give benefit of the doubt
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started)) return false;
  return Date.now() - started < minMs;
}

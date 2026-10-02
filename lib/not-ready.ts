// WHAT A PERSON IS TOLD WHEN A FEATURE'S TABLE ISN'T THERE YET.
//
// Every capability probe here degrades gracefully, which is the house rule (SPRINT_RULES:
// "gated behind a capability probe"). What they did not do was speak to the right person.
// Twenty-four of them put the MIGRATION NUMBER in the user-facing message — "Memory needs
// migration 0029.", "Apply migration 0025 for repeat schedules…" — handing a customer an
// instruction only the developer can follow, and making the product read as unfinished (user,
// 2026-09-30, on a screenshot of exactly that). One of them was also a wrong diagnosis: Goals
// reported EVERY failed month-goal save as a missing migration, network errors included.
//
// So the two audiences get two channels. The person sees a plain sentence; the developer sees
// the migration number in the console, in development only, where it can be acted on. Guarded
// by app/copy-voice.test.ts, "never talks to the user about its own plumbing".

/** Tell the developer which migration a missing capability needs. Silent in production. */
export function warnNotReady(what: string, migration: string): void {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[zenboard] ${what}: apply migration ${migration} to this database.`);
  }
}

/** The `{ error }` an action returns when its feature's migration is missing. */
export function notReady(message: string, migration: string): { error: string } {
  warnNotReady(message, migration);
  return { error: message };
}

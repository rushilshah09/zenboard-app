// When did the server build this payload?
//
// One line, its own file, for two reasons.
//
// FIRST, IT CANNOT LIVE IN THE CLIENT MODULE. `RevalidateOnStale` is a
// `'use client'` component; anything exported from that module is a client
// reference, so a server component importing it would get a stub rather than a
// function it can call.
//
// SECOND, IT IS DELIBERATELY IMPURE AND SAYS SO. React's purity rule — which
// the compiler enforces, and which flagged `Date.now()` written inline in the
// template — exists because a component that re-renders must produce the same
// output. That is a rule about CLIENT re-renders. This runs in a Server
// Component, once per request, and reading the wall clock is the entire point:
// the value is a fact about *this* response, and the client uses its age to
// tell a fresh payload from one the browser served out of its cache.
//
// Naming it, rather than reaching for an eslint-disable over an inline
// `Date.now()`, is the difference between an exception with a reason and an
// exception with a comment. It also matches how the rest of this codebase
// reads the clock on the server (`todayISO()` in lib/date.ts).

/** Wall-clock ms at the moment the server rendered. Server components only. */
export function serverRenderedAt(): number {
  return Date.now();
}

'use client';
// ── THE ROOM'S LIGHT ───────────────────────────────────────────────────────
//
// User, 2026-09-23, with a screenshot of macOS's screen-recording border: "when I go in focus mode
// on/off I want this gradient edge, like the OS and other applications" — and, on the control
// itself: "just a toggle in the header looks boring".
//
// Both are the same problem. Focus mode ALREADY changes everything — the sidebar goes, the chrome
// goes, eleven ways out become one — and the only thing that says so is a 28px switch. A mode with
// no visible boundary is just a page that lost its navigation.
//
// So the mode has an ambient signal, the way the OS does it: the app frame lights from its edge and
// stays lit for as long as you are in it. It is the accent, so it follows the accent the person
// chose, and it is the ONLY accent on a focus screen.
//
// ── WHY IT IS ALWAYS MOUNTED ───────────────────────────────────────────────
// Focus is a ROUTE (`lib/focus-mode.ts`), so a component rendered only while focused would unmount
// the instant you leave and could never animate out — the light would vanish a frame before the
// chrome returned, which is exactly the jarring change the animation exists to prevent. It is
// mounted always and carries `data-on`, so entrance and exit are both transitions of one element.
//
// The motion lives in CSS (globals.css, `.zb-focus-edge`): CSS animations run off the main thread,
// and entering focus navigates — the busiest moment in the app's life is the wrong time to ask
// requestAnimationFrame for a smooth fade.
export function FocusEdge({ on }: { on: boolean }) {
  return <div aria-hidden data-on={on || undefined} className="zb-focus-edge" />;
}

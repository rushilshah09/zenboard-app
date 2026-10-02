'use client';
// ── THE ILLUSTRATION BOARD, EXACTLY ─────────────────────────────────────────
//
// The user, 2026-09-27, of their illustration board (claude.ai/artifact/9naKXYCRYER9BgdQSxNL2Y): "use
// these exact same illustrations on my website in the Details section. Do not change, redesign, or
// modify the illustration style, line work, shapes, proportions, or any visual details … All 6 should
// always have animation … Do not change anything in the illustrations."
//
// So these six are the board's own markup, node for node: every element, class, inline style, path and
// word as the board draws it, converted to JSX by machine rather than redrawn by hand. The copies the
// site had drifted in exactly the ways a redraw does: an aura and a dot screen behind four of them (the
// board draws those only on a stage OUTSIDE a cell, and these live in cells), the focus timer's two
// buttons swapped in weight, a footer bolted onto the calendar, a scene scaled past its own proportions.
//
// Three things are not the board's, and none of them is visible in a drawing:
//   · the board's `ill-` names are `ib-` here, so no class or keyframe can collide with one of the same
//     name elsewhere on the site (the site had drawings of its own under `ill-` when these came across);
//   · the palette and type come from `app/site-board.css`, the board's values read off the board as it
//     renders, light and dark, rather than re-derived from the house tokens (that re-derivation is how a
//     copy drifts);
//   · the loops always run (the board runs them under the pointer), and the one scene the board leaves
//     still, the morning email, takes the board's own `arrive` loop. Less motion asked for: all still.
//
// A scene is laid out at the board's design size and scaled to fit its stage, contained and centred,
// exactly as the board's own `fit()` does it.

import * as React from 'react';

/** A scene's stage: the drawing at its design size, scaled to fit and centred (the board's `fit`, data-fit="contain"). */
function Stage({ w, h, label, children }: { w: number; h: number; label: string; children: React.ReactNode }) {
  const stage = React.useRef<HTMLDivElement>(null);
  const scene = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const el = stage.current;
    const inner = scene.current;
    if (!el || !inner) return;
    const fit = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      const s = Math.min(cw / w, ch / h);
      inner.style.transform = `translate(${(cw - w * s) / 2}px, ${(ch - h * s) / 2}px) scale(${s})`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h]);
  return (
    <div ref={stage} role="img" aria-label={label} className="ib-scope relative h-full w-full">
      <div ref={scene} aria-hidden="true" className="ib-scene absolute left-0 top-0 origin-top-left" style={{ width: w, height: h, '--ib-w': w, '--ib-h': h } as React.CSSProperties}>
        {children}
      </div>
    </div>
  );
}

/** The command palette over the app: the selection steps down the list and the caret blinks. */
export function BoardPalette() {
  return (
    <Stage w={400} h={380} label="The command palette over the app: type a command, move with the arrow keys, press Enter.">
      <div className="absolute" style={{ left: "20px", top: "20px", width: "360px", height: "340px" }}>
        <div className="relative overflow-hidden rounded-xl bg-ib-surface shadow-ib-2 flex h-full">
          <div className="flex w-20 flex-col gap-2 border-r border-ib-line bg-ib-surface-2 p-3">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" className="shrink-0" style={{ color: "var(--ib-accent)" }}>
              <path d="M18.4226 8.14215L18.6403 7.92451C20.4532 6.11147 20.4532 3.1733 18.6403 1.36026L18.6383 1.35832C16.8254 -0.452773 13.8873 -0.452773 12.0763 1.35832L11.8567 1.57791C10.8326 2.60199 9.16736 2.60199 8.14137 1.57791L7.92373 1.36026C6.11076 -0.452773 3.1727 -0.452773 1.35973 1.36026C-0.453243 3.1733 -0.453243 6.11147 1.35973 7.92451L1.57736 8.14215C2.60141 9.16818 2.60141 10.8335 1.57736 11.8576L1.35973 12.0753C-0.453243 13.8883 -0.453243 16.8265 1.35973 18.6395C3.1727 20.4525 6.11076 20.4545 7.92373 18.6395L8.14137 18.4219C9.16736 17.3958 10.8326 17.3958 11.8567 18.4219L12.0743 18.6395C13.8873 20.4525 16.8254 20.4525 18.6383 18.6395H18.6403V18.6376C20.4532 16.8245 20.4532 13.8863 18.6403 12.0733L18.4226 11.8557C17.3966 10.8316 17.3966 9.16623 18.4226 8.1402V8.14215ZM4.85936 15.1397C7.69832 12.3007 7.69832 7.69909 4.85936 4.86003C7.69832 7.69909 12.3017 7.69909 15.1406 4.86003C12.3017 7.69909 12.3017 12.3007 15.1406 15.1397C12.3017 12.3007 7.69832 12.3007 4.85936 15.1397Z" />
            </svg>
            <span className="flex items-center gap-1.5 text-ib-ink-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" className="shrink-0" aria-hidden="true">
                <path d="M104,40H56A16,16,0,0,0,40,56v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,104,40Zm0,64H56V56h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,64H152V56h48v48Zm-96,32H56a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,104,136Zm0,64H56V152h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,200,136Zm0,64H152V152h48v48Z" />
              </svg>
              {' '}
              <span className="block rounded-full" style={{ width: "32px", height: "4px", background: "var(--ib-skeleton)" }} />
            </span>
            <span className="flex items-center gap-1.5 text-ib-ink-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" className="shrink-0" aria-hidden="true">
                <path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,16V152h-28.7A15.86,15.86,0,0,0,168,156.69L148.69,176H107.31L88,156.69A15.86,15.86,0,0,0,76.69,152H48V48Zm0,160H48V168H76.69L96,187.31A15.86,15.86,0,0,0,107.31,192h41.38A15.86,15.86,0,0,0,160,187.31L179.31,168H208v40Z" />
              </svg>
              {' '}
              <span className="block rounded-full" style={{ width: "32px", height: "4px", background: "var(--ib-skeleton)" }} />
            </span>
            <span className="flex items-center gap-1.5 text-ib-ink-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" className="shrink-0" aria-hidden="true">
                <path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Z" />
              </svg>
              {' '}
              <span className="block rounded-full" style={{ width: "32px", height: "4px", background: "var(--ib-skeleton)" }} />
            </span>
            <span className="flex items-center gap-1.5 text-ib-ink-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" className="shrink-0" aria-hidden="true">
                <path d="M216,72H131.31L104,44.69A15.86,15.86,0,0,0,92.69,40H40A16,16,0,0,0,24,56V200.62A15.4,15.4,0,0,0,39.38,216H216.89A15.13,15.13,0,0,0,232,200.89V88A16,16,0,0,0,216,72ZM40,56H92.69l16,16H40ZM216,200H40V88H216Z" />
              </svg>
              {' '}
              <span className="block rounded-full" style={{ width: "32px", height: "4px", background: "var(--ib-skeleton)" }} />
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-3 p-4">
            <span className="block rounded-full" style={{ width: "120px", height: "8px", background: "var(--ib-ink-4)" }} />
            <span className="flex items-center gap-2">
              <span className="grid shrink-0 place-items-center rounded-[5px] bg-ib-surface" style={{ width: "10px", height: "10px", boxShadow: "inset 0 0 0 1.5px var(--ib-line-strong)" }} />
              <span className="block rounded-full" style={{ width: "180px", height: "5px", background: "var(--ib-skeleton)" }} />
            </span>
            <span className="flex items-center gap-2">
              <span className="grid shrink-0 place-items-center rounded-[5px] bg-ib-surface" style={{ width: "10px", height: "10px", boxShadow: "inset 0 0 0 1.5px var(--ib-line-strong)" }} />
              <span className="block rounded-full" style={{ width: "150px", height: "5px", background: "var(--ib-skeleton)" }} />
            </span>
            <span className="flex items-center gap-2">
              <span className="grid shrink-0 place-items-center rounded-[5px] bg-ib-surface" style={{ width: "10px", height: "10px", boxShadow: "inset 0 0 0 1.5px var(--ib-line-strong)" }} />
              <span className="block rounded-full" style={{ width: "200px", height: "5px", background: "var(--ib-skeleton)" }} />
            </span>
            <span className="flex items-center gap-2">
              <span className="grid shrink-0 place-items-center rounded-[5px] bg-ib-surface" style={{ width: "10px", height: "10px", boxShadow: "inset 0 0 0 1.5px var(--ib-line-strong)" }} />
              <span className="block rounded-full" style={{ width: "130px", height: "5px", background: "var(--ib-skeleton)" }} />
            </span>
            <span className="flex items-center gap-2">
              <span className="grid shrink-0 place-items-center rounded-[5px] bg-ib-surface" style={{ width: "10px", height: "10px", boxShadow: "inset 0 0 0 1.5px var(--ib-line-strong)" }} />
              <span className="block rounded-full" style={{ width: "170px", height: "5px", background: "var(--ib-skeleton)" }} />
            </span>
            <span className="flex items-center gap-2">
              <span className="grid shrink-0 place-items-center rounded-[5px] bg-ib-surface" style={{ width: "10px", height: "10px", boxShadow: "inset 0 0 0 1.5px var(--ib-line-strong)" }} />
              <span className="block rounded-full" style={{ width: "110px", height: "5px", background: "var(--ib-skeleton)" }} />
            </span>
            <span className="flex items-center gap-2">
              <span className="grid shrink-0 place-items-center rounded-[5px] bg-ib-surface" style={{ width: "10px", height: "10px", boxShadow: "inset 0 0 0 1.5px var(--ib-line-strong)" }} />
              <span className="block rounded-full" style={{ width: "160px", height: "5px", background: "var(--ib-skeleton)" }} />
            </span>
            <span className="flex items-center gap-2">
              <span className="grid shrink-0 place-items-center rounded-[5px] bg-ib-surface" style={{ width: "10px", height: "10px", boxShadow: "inset 0 0 0 1.5px var(--ib-line-strong)" }} />
              <span className="block rounded-full" style={{ width: "190px", height: "5px", background: "var(--ib-skeleton)" }} />
            </span>
          </div>
          <span className="absolute inset-0 bg-ib-scrim" />
        </div>
      </div>
      <div className="absolute" style={{ left: "52px", top: "38px", width: "296px", zIndex: "1" }}>
        <div className="relative overflow-hidden rounded-xl bg-ib-surface shadow-ib-float">
          <div className="flex items-center gap-2 border-b border-ib-line px-3 py-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" className="shrink-0 text-ib-ink-3" aria-hidden="true">
              <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
            </svg>
            <span className="ib-t-small text-ib-ink-1">
              go to
            </span>
            <span className="ib-anim ib-blink -ml-1.5 h-4 w-px bg-ib-ink-1" />
            <span className="flex-1" />
            <span className="inline-grid shrink-0 place-items-center font-medium ib-t-micro h-5 min-w-5 rounded-[5px] px-1 text-ib-ink-3 bg-ib-surface" style={{ boxShadow: "inset 0 -1px 0 var(--ib-line), 0 0 0 1px var(--ib-line-strong)" }}>
              esc
            </span>
          </div>
          <div className="px-2 pt-2 pb-1">
            <div className="ib-t-micro px-2 pb-1 text-ib-ink-3">
              Navigate
            </div>
            <div className="relative" style={{ "--ib-row": "26px" } as React.CSSProperties}>
              <span className="ib-anim ib-select absolute inset-x-0 top-0 rounded-md bg-ib-surface-3" style={{ height: "26px" }} />
              <div className="relative flex items-center gap-2 px-2" style={{ height: "26px" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" className="shrink-0 text-ib-ink-3" aria-hidden="true">
                  <path d="M216,72H131.31L104,44.69A15.86,15.86,0,0,0,92.69,40H40A16,16,0,0,0,24,56V200.62A15.4,15.4,0,0,0,39.38,216H216.89A15.13,15.13,0,0,0,232,200.89V88A16,16,0,0,0,216,72ZM40,56H92.69l16,16H40ZM216,200H40V88H216Z" />
                </svg>
                <span className="ib-t-small flex-1 text-ib-ink-1">
                  Go to Projects
                </span>
                <span className="flex gap-0.5">
                  <span className="inline-grid shrink-0 place-items-center font-medium ib-t-micro h-5 min-w-5 rounded-[5px] px-1 text-ib-ink-3 bg-ib-surface" style={{ boxShadow: "inset 0 -1px 0 var(--ib-line), 0 0 0 1px var(--ib-line-strong)" }}>
                    G
                  </span>
                  <span className="inline-grid shrink-0 place-items-center font-medium ib-t-micro h-5 min-w-5 rounded-[5px] px-1 text-ib-ink-3 bg-ib-surface" style={{ boxShadow: "inset 0 -1px 0 var(--ib-line), 0 0 0 1px var(--ib-line-strong)" }}>
                    P
                  </span>
                </span>
              </div>
              <div className="relative flex items-center gap-2 px-2" style={{ height: "26px" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" className="shrink-0 text-ib-ink-3" aria-hidden="true">
                  <path d="M24,104H48v64H32a8,8,0,0,0,0,16H224a8,8,0,0,0,0-16H208V104h24a8,8,0,0,0,4.19-14.81l-104-64a8,8,0,0,0-8.38,0l-104,64A8,8,0,0,0,24,104Zm40,0H96v64H64Zm80,0v64H112V104Zm48,64H160V104h32ZM128,41.39,203.74,88H52.26ZM248,208a8,8,0,0,1-8,8H16a8,8,0,0,1,0-16H240A8,8,0,0,1,248,208Z" />
                </svg>
                <span className="ib-t-small flex-1 text-ib-ink-1">
                  Go to Finance
                </span>
                <span className="flex gap-0.5">
                  <span className="inline-grid shrink-0 place-items-center font-medium ib-t-micro h-5 min-w-5 rounded-[5px] px-1 text-ib-ink-3 bg-ib-surface" style={{ boxShadow: "inset 0 -1px 0 var(--ib-line), 0 0 0 1px var(--ib-line-strong)" }}>
                    G
                  </span>
                  <span className="inline-grid shrink-0 place-items-center font-medium ib-t-micro h-5 min-w-5 rounded-[5px] px-1 text-ib-ink-3 bg-ib-surface" style={{ boxShadow: "inset 0 -1px 0 var(--ib-line), 0 0 0 1px var(--ib-line-strong)" }}>
                    M
                  </span>
                </span>
              </div>
              <div className="relative flex items-center gap-2 px-2" style={{ height: "26px" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" className="shrink-0 text-ib-ink-3" aria-hidden="true">
                  <path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Zm-32-80a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,136Zm0,32a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,168Z" />
                </svg>
                <span className="ib-t-small flex-1 text-ib-ink-1">
                  Go to Documents
                </span>
                <span className="flex gap-0.5">
                  <span className="inline-grid shrink-0 place-items-center font-medium ib-t-micro h-5 min-w-5 rounded-[5px] px-1 text-ib-ink-3 bg-ib-surface" style={{ boxShadow: "inset 0 -1px 0 var(--ib-line), 0 0 0 1px var(--ib-line-strong)" }}>
                    G
                  </span>
                  <span className="inline-grid shrink-0 place-items-center font-medium ib-t-micro h-5 min-w-5 rounded-[5px] px-1 text-ib-ink-3 bg-ib-surface" style={{ boxShadow: "inset 0 -1px 0 var(--ib-line), 0 0 0 1px var(--ib-line-strong)" }}>
                    D
                  </span>
                </span>
              </div>
            </div>
            <div className="ib-t-micro px-2 pt-2 pb-1 text-ib-ink-3">
              Recent
            </div>
            <div className="flex items-center gap-2 px-2" style={{ height: "26px" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" className="shrink-0 text-ib-ink-3" aria-hidden="true">
                <path d="M216,72H131.31L104,44.69A15.86,15.86,0,0,0,92.69,40H40A16,16,0,0,0,24,56V200.62A15.4,15.4,0,0,0,39.38,216H216.89A15.13,15.13,0,0,0,232,200.89V88A16,16,0,0,0,216,72ZM40,56H92.69l16,16H40ZM216,200H40V88H216Z" />
              </svg>
              <span className="ib-t-small flex-1 text-ib-ink-1">
                Ridgeline rebrand
              </span>
              <span className="ib-t-micro text-ib-ink-3">
                Project
              </span>
            </div>
            <div className="flex items-center gap-2 px-2" style={{ height: "26px" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" className="shrink-0 text-ib-ink-3" aria-hidden="true">
                <path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Zm-32-80a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,136Zm0,32a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,168Z" />
              </svg>
              <span className="ib-t-small flex-1 text-ib-ink-1">
                Beacon Health scope
              </span>
              <span className="ib-t-micro text-ib-ink-3">
                Doc
              </span>
            </div>
            <div className="ib-t-micro px-2 pt-2 pb-1 text-ib-ink-3">
              Actions
            </div>
            <div className="flex items-center gap-2 px-2" style={{ height: "26px" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" className="shrink-0 text-ib-ink-3" aria-hidden="true">
                <path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z" />
              </svg>
              <span className="ib-t-small flex-1 text-ib-ink-1">
                New task
              </span>
              <span className="inline-grid shrink-0 place-items-center font-medium ib-t-micro h-5 min-w-5 rounded-[5px] px-1 text-ib-ink-3 bg-ib-surface" style={{ boxShadow: "inset 0 -1px 0 var(--ib-line), 0 0 0 1px var(--ib-line-strong)" }}>
                C
              </span>
            </div>
            <div className="flex items-center gap-2 px-2" style={{ height: "26px" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="tabler-icon tabler-icon-stopwatch shrink-0 text-ib-ink-3" aria-hidden="true">
                <path d="M5 13a7 7 0 1 0 14 0a7 7 0 0 0 -14 0" />
                <path d="M14.5 10.5l-2.5 2.5" />
                <path d="M17 8l1 -1" />
                <path d="M14 3h-4" />
              </svg>
              <span className="ib-t-small flex-1 text-ib-ink-1">
                Focus mode
              </span>
              <span className="inline-grid shrink-0 place-items-center font-medium ib-t-micro h-5 min-w-5 rounded-[5px] px-1 text-ib-ink-3 bg-ib-surface" style={{ boxShadow: "inset 0 -1px 0 var(--ib-line), 0 0 0 1px var(--ib-line-strong)" }}>
                F
              </span>
            </div>
          </div>
          <div className="ib-t-micro flex items-center gap-3 border-t border-ib-line bg-ib-surface-2 px-3 py-2 text-ib-ink-3">
            <span className="flex items-center gap-1">
              <span className="inline-grid shrink-0 place-items-center font-medium ib-t-micro h-5 min-w-5 rounded-[5px] px-1 text-ib-ink-3 bg-ib-surface" style={{ boxShadow: "inset 0 -1px 0 var(--ib-line), 0 0 0 1px var(--ib-line-strong)" }}>
                ↑
              </span>
              <span className="inline-grid shrink-0 place-items-center font-medium ib-t-micro h-5 min-w-5 rounded-[5px] px-1 text-ib-ink-3 bg-ib-surface" style={{ boxShadow: "inset 0 -1px 0 var(--ib-line), 0 0 0 1px var(--ib-line-strong)" }}>
                ↓
              </span>
              {" move"}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-grid shrink-0 place-items-center font-medium ib-t-micro h-5 min-w-5 rounded-[5px] px-1 text-ib-ink-3 bg-ib-surface" style={{ boxShadow: "inset 0 -1px 0 var(--ib-line), 0 0 0 1px var(--ib-line-strong)" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="tabler-icon tabler-icon-corner-down-left shrink-0" aria-hidden="true">
                  <path d="M18 6v6a3 3 0 0 1 -3 3h-10l4 -4m0 8l-4 -4" />
                </svg>
              </span>
              {" run"}
            </span>
            <span className="flex-1" />
            <span className="flex items-center gap-1">
              <span className="inline-grid shrink-0 place-items-center font-medium ib-t-micro h-5 min-w-5 rounded-[5px] px-1 text-ib-ink-3 bg-ib-surface" style={{ boxShadow: "inset 0 -1px 0 var(--ib-line), 0 0 0 1px var(--ib-line-strong)" }}>
                ⌘
              </span>
              <span className="inline-grid shrink-0 place-items-center font-medium ib-t-micro h-5 min-w-5 rounded-[5px] px-1 text-ib-ink-3 bg-ib-surface" style={{ boxShadow: "inset 0 -1px 0 var(--ib-line), 0 0 0 1px var(--ib-line-strong)" }}>
                K
              </span>
            </span>
          </div>
        </div>
      </div>
    </Stage>
  );
}

/** A keyboard where the letters follow the words: H is pressed, and the task it highlights says so. */
export function BoardShortcuts() {
  return (
    <Stage w={400} h={300} label="Keyboard shortcuts that follow the words: H highlights a task, E completes it, G then P goes to Projects.">
      <div className="absolute ib-anim ib-rise" style={{ left: "96px", top: "20px", zIndex: "2" }}>
        <div className="relative overflow-hidden rounded-xl bg-ib-surface shadow-ib-float flex items-center gap-2 px-3 py-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" className="shrink-0" style={{ color: "var(--ib-accent)" }} aria-hidden="true">
            <path d="M234.29,114.85l-45,38.83L203,211.75a16.4,16.4,0,0,1-24.5,17.82L128,198.49,77.47,229.57A16.4,16.4,0,0,1,53,211.75l13.76-58.07-45-38.83A16.46,16.46,0,0,1,31.08,86l59-4.76,22.76-55.08a16.36,16.36,0,0,1,30.27,0l22.75,55.08,59,4.76a16.46,16.46,0,0,1,9.37,28.86Z" />
          </svg>
          <span className="ib-t-caption text-ib-ink-3">
            Highlighted
          </span>
          <span className="ib-t-caption font-medium text-ib-ink-1">
            Logo presentation
          </span>
        </div>
      </div>
      {/* 344 wide and centred, not the board's 328: the bottom row is stepped 40px in, which made it
          16px wider than the board, and the B key hung off its edge (user, 2026-09-29: "fix this
          illustration"). Now the widest row has the same 16px on its right as every row has on its
          left, and the stagger reads as a keyboard's. */}
      <div className="absolute" style={{ left: "28px", top: "64px", width: "344px", zIndex: "1" }}>
        <div className="rounded-2xl bg-ib-surface-3 px-4 pt-3 pb-6" style={{ boxShadow: "inset 0 0 0 1px var(--ib-line), var(--ib-shadow-2)" }}>
          <div className="flex gap-2">
            <span className="relative">
              <span className="inline-grid shrink-0 place-items-center font-medium ib-t-h4 h-12 min-w-12 rounded-lg px-3 bg-ib-surface text-ib-ink-4" style={{ boxShadow: "var(--ib-shadow-key)" }}>
                Q
              </span>
            </span>
            <span className="relative">
              <span className="inline-grid shrink-0 place-items-center font-medium ib-t-h4 h-12 min-w-12 rounded-lg px-3 bg-ib-surface text-ib-ink-4" style={{ boxShadow: "var(--ib-shadow-key)" }}>
                W
              </span>
            </span>
            <span className="relative">
              <span className="inline-grid shrink-0 place-items-center font-medium ib-t-h4 h-12 min-w-12 rounded-lg px-3 bg-ib-surface" style={{ boxShadow: "var(--ib-shadow-key)" }}>
                E
              </span>
              <span className="ib-t-micro absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full whitespace-nowrap text-ib-ink-3">
                Complete
              </span>
            </span>
            <span className="relative">
              <span className="inline-grid shrink-0 place-items-center font-medium ib-t-h4 h-12 min-w-12 rounded-lg px-3 bg-ib-surface text-ib-ink-4" style={{ boxShadow: "var(--ib-shadow-key)" }}>
                R
              </span>
            </span>
            <span className="relative">
              <span className="inline-grid shrink-0 place-items-center font-medium ib-t-h4 h-12 min-w-12 rounded-lg px-3 bg-ib-surface text-ib-ink-4" style={{ boxShadow: "var(--ib-shadow-key)" }}>
                T
              </span>
            </span>
          </div>
          <div className="mt-6 ml-4 flex gap-2">
            <span className="relative">
              <span className="inline-grid shrink-0 place-items-center font-medium ib-t-h4 h-12 min-w-12 rounded-lg px-3 bg-ib-surface text-ib-ink-4" style={{ boxShadow: "var(--ib-shadow-key)" }}>
                S
              </span>
            </span>
            <span className="relative">
              <span className="inline-grid shrink-0 place-items-center font-medium ib-t-h4 h-12 min-w-12 rounded-lg px-3 bg-ib-surface text-ib-ink-4" style={{ boxShadow: "var(--ib-shadow-key)" }}>
                D
              </span>
            </span>
            <span className="relative">
              <span className="inline-grid shrink-0 place-items-center font-medium ib-t-h4 h-12 min-w-12 rounded-lg px-3 bg-ib-surface" style={{ boxShadow: "var(--ib-shadow-key)" }}>
                F
              </span>
              <span className="ib-t-micro absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full whitespace-nowrap text-ib-ink-3">
                Focus
              </span>
            </span>
            <span className="relative">
              <span className="inline-grid shrink-0 place-items-center font-medium ib-t-h4 h-12 min-w-12 rounded-lg px-3 bg-ib-surface text-ib-ink-4" style={{ boxShadow: "var(--ib-shadow-key)" }}>
                G
              </span>
            </span>
            <span className="relative">
              <span className="inline-grid shrink-0 place-items-center font-medium ib-t-h4 h-12 min-w-12 rounded-lg px-3 bg-ib-solid text-ib-on-solid ib-anim ib-press">
                H
              </span>
            </span>
          </div>
          <div className="mt-6 ml-10 flex gap-2">
            <span className="relative">
              <span className="inline-grid shrink-0 place-items-center font-medium ib-t-h4 h-12 min-w-12 rounded-lg px-3 bg-ib-surface text-ib-ink-4" style={{ boxShadow: "var(--ib-shadow-key)" }}>
                Z
              </span>
            </span>
            <span className="relative">
              <span className="inline-grid shrink-0 place-items-center font-medium ib-t-h4 h-12 min-w-12 rounded-lg px-3 bg-ib-surface text-ib-ink-4" style={{ boxShadow: "var(--ib-shadow-key)" }}>
                X
              </span>
            </span>
            <span className="relative">
              <span className="inline-grid shrink-0 place-items-center font-medium ib-t-h4 h-12 min-w-12 rounded-lg px-3 bg-ib-surface" style={{ boxShadow: "var(--ib-shadow-key)" }}>
                C
              </span>
              <span className="ib-t-micro absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full whitespace-nowrap text-ib-ink-3">
                Capture
              </span>
            </span>
            <span className="relative">
              <span className="inline-grid shrink-0 place-items-center font-medium ib-t-h4 h-12 min-w-12 rounded-lg px-3 bg-ib-surface text-ib-ink-4" style={{ boxShadow: "var(--ib-shadow-key)" }}>
                V
              </span>
            </span>
            <span className="relative">
              <span className="inline-grid shrink-0 place-items-center font-medium ib-t-h4 h-12 min-w-12 rounded-lg px-3 bg-ib-surface text-ib-ink-4" style={{ boxShadow: "var(--ib-shadow-key)" }}>
                B
              </span>
            </span>
          </div>
        </div>
      </div>
      <div className="absolute flex items-center justify-center gap-2" style={{ left: "40px", top: "268px", width: "320px" }}>
        <span className="inline-grid shrink-0 place-items-center font-medium ib-t-micro h-5 min-w-5 rounded-[5px] px-1 text-ib-ink-3 bg-ib-surface" style={{ boxShadow: "inset 0 -1px 0 var(--ib-line), 0 0 0 1px var(--ib-line-strong)" }}>
          G
        </span>
        <span className="ib-t-micro text-ib-ink-3">
          then
        </span>
        <span className="inline-grid shrink-0 place-items-center font-medium ib-t-micro h-5 min-w-5 rounded-[5px] px-1 text-ib-ink-3 bg-ib-surface" style={{ boxShadow: "inset 0 -1px 0 var(--ib-line), 0 0 0 1px var(--ib-line-strong)" }}>
          P
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="tabler-icon tabler-icon-arrow-right shrink-0 text-ib-ink-4" aria-hidden="true">
          <path d="M5 12l14 0" />
          <path d="M13 18l6 -6" />
          <path d="M13 6l6 6" />
        </svg>
        <span className="ib-t-caption font-medium text-ib-ink-1">
          Projects
        </span>
      </div>
    </Stage>
  );
}

/** Focus mode: the timer over the day it is hiding, its ring running. */
export function BoardFocus() {
  return (
    <Stage w={400} h={300} label="Focus mode: one task on screen with a 25 minute timer, and nothing else.">
      <div className="absolute" style={{ left: "32px", top: "36px", width: "336px", height: "228px", filter: "blur(2px)", opacity: "0.55" }}>
        <div className="relative overflow-hidden rounded-xl bg-ib-surface shadow-ib-1 flex h-full flex-col gap-3 p-4">
          <span className="flex items-center gap-2">
            <span className="grid shrink-0 place-items-center rounded-[5px] bg-ib-surface" style={{ width: "12px", height: "12px", boxShadow: "inset 0 0 0 1.5px var(--ib-line-strong)" }} />
            <span className="block rounded-full" style={{ width: "150px", height: "5px", background: "var(--ib-skeleton)" }} />
          </span>
          <span className="flex items-center gap-2">
            <span className="grid shrink-0 place-items-center rounded-[5px] bg-ib-surface" style={{ width: "12px", height: "12px", boxShadow: "inset 0 0 0 1.5px var(--ib-line-strong)" }} />
            <span className="block rounded-full" style={{ width: "200px", height: "5px", background: "var(--ib-skeleton)" }} />
          </span>
          <span className="flex items-center gap-2">
            <span className="grid shrink-0 place-items-center rounded-[5px] bg-ib-surface" style={{ width: "12px", height: "12px", boxShadow: "inset 0 0 0 1.5px var(--ib-line-strong)" }} />
            <span className="block rounded-full" style={{ width: "120px", height: "5px", background: "var(--ib-skeleton)" }} />
          </span>
          <span className="flex items-center gap-2">
            <span className="grid shrink-0 place-items-center rounded-[5px] bg-ib-surface" style={{ width: "12px", height: "12px", boxShadow: "inset 0 0 0 1.5px var(--ib-line-strong)" }} />
            <span className="block rounded-full" style={{ width: "170px", height: "5px", background: "var(--ib-skeleton)" }} />
          </span>
          <span className="flex items-center gap-2">
            <span className="grid shrink-0 place-items-center rounded-[5px] bg-ib-surface" style={{ width: "12px", height: "12px", boxShadow: "inset 0 0 0 1.5px var(--ib-line-strong)" }} />
            <span className="block rounded-full" style={{ width: "140px", height: "5px", background: "var(--ib-skeleton)" }} />
          </span>
        </div>
      </div>
      <div className="absolute" style={{ left: "88px", top: "18px", width: "224px", zIndex: "1" }}>
        <div className="ib-glass rounded-2xl p-2" style={{ background: "color-mix(in srgb, var(--ib-surface) 55%, transparent)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--ib-surface) 70%, transparent), var(--ib-shadow-2)", backdropFilter: "blur(8px)" }}>
          <div className="relative overflow-hidden rounded-xl bg-ib-surface shadow-ib-float h-full">
            <div className="flex items-center justify-between px-4 pt-3">
              <span className="ib-t-caption inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 font-medium bg-ib-surface-3 text-ib-ink-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" className="shrink-0" aria-hidden="true">
                  <path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z" />
                </svg>
                Quiet
              </span>
              <span className="grid size-5 place-items-center rounded-full text-ib-ink-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256" className="shrink-0" aria-hidden="true">
                  <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
                </svg>
              </span>
            </div>
            <div className="flex flex-col items-center px-4 pt-1 pb-3">
              <span className="relative inline-grid shrink-0 place-items-center" style={{ width: "112px", height: "112px" }}>
                <svg width="112" height="112" className="absolute inset-0 -rotate-90">
                  <circle cx="56" cy="56" r="53.5" fill="none" stroke="var(--ib-surface-3)" strokeWidth="5" />
                  <circle cx="56" cy="56" r="53.5" fill="none" stroke="var(--ib-accent)" strokeWidth="5" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset="32" className="ib-anim ib-sweep" />
                </svg>
                <span className="flex flex-col items-center">
                  <span className="ib-t-stat">
                    24:03
                  </span>
                  <span className="ib-t-micro mt-1 text-ib-ink-3">
                    of 25:00
                  </span>
                </span>
              </span>
              <span className="ib-t-small mt-3 font-medium text-ib-ink-1">
                Finish the logo presentation
              </span>
              <span className="ib-t-micro mt-0.5 flex items-center gap-1 text-ib-ink-3">
                <span className="inline-block shrink-0 rounded-full" style={{ width: "6px", height: "6px", background: "var(--ib-label-indigo)" }} />
                {" Ridgeline rebrand"}
              </span>
              <div className="mt-3 flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-ib-solid text-ib-on-solid">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="tabler-icon tabler-icon-player-pause shrink-0" aria-hidden="true">
                    <path d="M6 6a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -12" />
                    <path d="M14 6a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -12" />
                  </svg>
                </span>
                <span className="ib-t-caption grid h-8 place-items-center rounded-full bg-ib-surface-3 px-3 font-medium text-ib-ink-2">
                  Done
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Stage>
  );
}

/** The plan beside the day: a task is carried from the rail onto an open slot. */
export function BoardCalendar() {
  return (
    <Stage w={400} h={300} label="Your calendar next to your plan: drag a task from the list onto an open slot in the day.">
      <div className="absolute" style={{ left: "24px", top: "32px", width: "352px", height: "236px" }}>
        <div className="ib-glass rounded-2xl p-2 h-full" style={{ background: "color-mix(in srgb, var(--ib-surface) 55%, transparent)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--ib-surface) 70%, transparent), var(--ib-shadow-2)", backdropFilter: "blur(8px)" }}>
          <div className="relative overflow-hidden rounded-xl bg-ib-surface shadow-ib-float h-full">
            <div className="flex h-full">
              <div className="flex w-36 flex-col border-r border-ib-line">
                <div className="ib-t-micro flex items-center gap-1 px-3 pt-3 pb-2 text-ib-ink-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" className="shrink-0" aria-hidden="true">
                    <path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z" />
                  </svg>
                  {" Not on the day yet"}
                </div>
                <div className="mx-2 flex h-9 items-center rounded-md border border-dashed border-ib-line-strong" />
                <div className="mx-2 mt-2 flex items-center gap-2 rounded-md bg-ib-surface-2 px-2 py-2 shadow-ib-1">
                  <span className="grid shrink-0 place-items-center rounded-[5px] bg-ib-surface" style={{ width: "12px", height: "12px", boxShadow: "inset 0 0 0 1.5px var(--ib-line-strong)" }} />
                  <span className="ib-t-caption truncate text-ib-ink-1">
                    Asset handover
                  </span>
                </div>
                <div className="mx-2 mt-2 flex items-center gap-2 rounded-md bg-ib-surface-2 px-2 py-2 shadow-ib-1">
                  <span className="grid shrink-0 place-items-center rounded-[5px] bg-ib-surface" style={{ width: "12px", height: "12px", boxShadow: "inset 0 0 0 1.5px var(--ib-line-strong)" }} />
                  <span className="ib-t-caption truncate text-ib-ink-1">
                    Beacon scope
                  </span>
                </div>
              </div>
              <div className="relative flex-1">
                <div className="ib-t-micro flex items-center justify-between px-3 pt-3 pb-2 text-ib-ink-3">
                  <span className="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" className="shrink-0" aria-hidden="true">
                      <path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Z" />
                    </svg>
                    {" Thursday"}
                  </span>
                  <span className="ib-t-caption inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 font-medium bg-ib-surface-3 text-ib-ink-2 !px-1.5 !py-0">
                    Google
                  </span>
                </div>
                <div className="absolute inset-x-0 flex items-start gap-2 pl-2" style={{ top: "36px" }}>
                  <span className="ib-t-micro w-5 -translate-y-1/2 text-right text-ib-ink-4">
                    9
                  </span>
                  <span className="mt-0 h-px flex-1 bg-ib-line" />
                </div>
                <div className="absolute inset-x-0 flex items-start gap-2 pl-2" style={{ top: "80px" }}>
                  <span className="ib-t-micro w-5 -translate-y-1/2 text-right text-ib-ink-4">
                    10
                  </span>
                  <span className="mt-0 h-px flex-1 bg-ib-line" />
                </div>
                <div className="absolute inset-x-0 flex items-start gap-2 pl-2" style={{ top: "124px" }}>
                  <span className="ib-t-micro w-5 -translate-y-1/2 text-right text-ib-ink-4">
                    11
                  </span>
                  <span className="mt-0 h-px flex-1 bg-ib-line" />
                </div>
                <div className="absolute inset-x-0 flex items-start gap-2 pl-2" style={{ top: "168px" }}>
                  <span className="ib-t-micro w-5 -translate-y-1/2 text-right text-ib-ink-4">
                    12
                  </span>
                  <span className="mt-0 h-px flex-1 bg-ib-line" />
                </div>
                <div className="absolute flex overflow-hidden rounded-md" style={{ left: "30px", right: "8px", top: "40px", height: "16px", background: "var(--ib-label-slate-soft)" }}>
                  <span className="w-0.5 shrink-0" style={{ background: "var(--ib-label-slate)" }} />
                  <span className="flex items-baseline gap-1.5 px-2 py-1">
                    <span className="ib-t-micro text-ib-ink-3">
                      9:00
                    </span>
                    <span className="ib-t-caption truncate font-medium text-ib-ink-1">
                      Standup
                    </span>
                  </span>
                </div>
                <div className="absolute flex overflow-hidden rounded-md" style={{ left: "30px", right: "8px", top: "148px", height: "38px", background: "var(--ib-label-indigo-soft)" }}>
                  <span className="w-0.5 shrink-0" style={{ background: "var(--ib-label-indigo)" }} />
                  <span className="flex items-baseline gap-1.5 px-2 py-1">
                    <span className="ib-t-micro text-ib-ink-3">
                      11:30
                    </span>
                    <span className="ib-t-caption truncate font-medium text-ib-ink-1">
                      Ridgeline call
                    </span>
                  </span>
                </div>
                <div className="absolute rounded-md border border-dashed" style={{ left: "30px", right: "8px", top: "82px", height: "38px", borderColor: "var(--ib-accent-line)", background: "var(--ib-accent-soft)" }} />
                <span className="absolute h-0.5 rounded-full bg-ib-accent" style={{ left: "26px", right: "8px", top: "115.2px" }}>
                  <span className="absolute -left-1 -top-[3px] size-2 rounded-full bg-ib-accent" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute ib-anim ib-drag" style={{ left: "40px", top: "74px", width: "128px", zIndex: "3", "--ib-dx": "146px", "--ib-dy": "8px", transform: "rotate(-2deg)" } as React.CSSProperties}>
        <div className="flex items-center gap-2 rounded-md bg-ib-surface px-2 py-2 shadow-ib-float" style={{ boxShadow: "var(--ib-shadow-float), inset 2px 0 0 var(--ib-accent)" }}>
          <span className="grid shrink-0 place-items-center rounded-[5px] bg-ib-surface" style={{ width: "12px", height: "12px", boxShadow: "inset 0 0 0 1.5px var(--ib-line-strong)" }} />
          <span className="min-w-0 flex-1">
            <span className="ib-t-caption block truncate font-medium text-ib-ink-1">
              Type and color
            </span>
            <span className="ib-t-micro block text-ib-ink-3">
              45m
            </span>
          </span>
        </div>
        <span className="pointer-events-none absolute flex items-start" style={{ left: "100px", top: "22px" }}>
          <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
            <path d="M1.5 1.5 L14 8.2 L8.3 9.6 L5.6 15.8 Z" fill="var(--ib-label-indigo)" stroke="white" strokeWidth="1.25" strokeLinejoin="round" />
          </svg>
          <span className="ib-t-micro mt-3 -ml-1 rounded-sm px-1 py-0.5 text-white" style={{ background: "var(--ib-label-indigo)" }}>
            You
          </span>
        </span>
      </div>
    </Stage>
  );
}

/** The morning email over the inbox. The board draws it still; here it arrives, on the board's own `arrive` loop, because every drawing on this row moves. */
export function BoardDigest() {
  return (
    <Stage w={400} h={300} label="A short email each morning with the highlight, the plan, and what is waiting on others.">
      <div className="absolute" style={{ left: "28px", top: "24px", width: "344px", height: "120px" }}>
        <div className="relative overflow-hidden rounded-xl bg-ib-surface shadow-ib-2 h-full">
          <div className="flex items-center gap-2 px-3 py-2.5">
            <span className="size-5 rounded-full bg-ib-surface-3" />
            <span className="block rounded-full" style={{ width: "64px", height: "5px", background: "var(--ib-ink-4)" }} />
            <span className="block rounded-full" style={{ width: "140px", height: "5px", background: "var(--ib-skeleton)" }} />
            <span className="flex-1" />
            <span className="block rounded-full" style={{ width: "24px", height: "4px", background: "var(--ib-skeleton)" }} />
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 border-t border-ib-line">
            <span className="size-5 rounded-full bg-ib-surface-3" />
            <span className="block rounded-full" style={{ width: "64px", height: "5px", background: "var(--ib-skeleton)" }} />
            <span className="block rounded-full" style={{ width: "140px", height: "5px", background: "var(--ib-skeleton)" }} />
            <span className="flex-1" />
            <span className="block rounded-full" style={{ width: "24px", height: "4px", background: "var(--ib-skeleton)" }} />
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 border-t border-ib-line">
            <span className="size-5 rounded-full bg-ib-surface-3" />
            <span className="block rounded-full" style={{ width: "64px", height: "5px", background: "var(--ib-skeleton)" }} />
            <span className="block rounded-full" style={{ width: "140px", height: "5px", background: "var(--ib-skeleton)" }} />
            <span className="flex-1" />
            <span className="block rounded-full" style={{ width: "24px", height: "4px", background: "var(--ib-skeleton)" }} />
          </div>
        </div>
      </div>
      <div className="absolute ib-anim ib-arrive" style={{ left: "52px", top: "60px", width: "296px", zIndex: "1" }}>
        <div className="ib-glass rounded-2xl p-2" style={{ background: "color-mix(in srgb, var(--ib-surface) 55%, transparent)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--ib-surface) 70%, transparent), var(--ib-shadow-2)", backdropFilter: "blur(8px)" }}>
          <div className="relative overflow-hidden rounded-xl bg-ib-surface shadow-ib-float h-full">
            <div className="flex items-center gap-2 px-4 pt-4">
              <span className="grid size-7 place-items-center rounded-full bg-ib-surface-2 shadow-ib-1">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" className="shrink-0" style={{ color: "var(--ib-accent)" }}>
                  <path d="M18.4226 8.14215L18.6403 7.92451C20.4532 6.11147 20.4532 3.1733 18.6403 1.36026L18.6383 1.35832C16.8254 -0.452773 13.8873 -0.452773 12.0763 1.35832L11.8567 1.57791C10.8326 2.60199 9.16736 2.60199 8.14137 1.57791L7.92373 1.36026C6.11076 -0.452773 3.1727 -0.452773 1.35973 1.36026C-0.453243 3.1733 -0.453243 6.11147 1.35973 7.92451L1.57736 8.14215C2.60141 9.16818 2.60141 10.8335 1.57736 11.8576L1.35973 12.0753C-0.453243 13.8883 -0.453243 16.8265 1.35973 18.6395C3.1727 20.4525 6.11076 20.4545 7.92373 18.6395L8.14137 18.4219C9.16736 17.3958 10.8326 17.3958 11.8567 18.4219L12.0743 18.6395C13.8873 20.4525 16.8254 20.4525 18.6383 18.6395H18.6403V18.6376C20.4532 16.8245 20.4532 13.8863 18.6403 12.0733L18.4226 11.8557C17.3966 10.8316 17.3966 9.16623 18.4226 8.1402V8.14215ZM4.85936 15.1397C7.69832 12.3007 7.69832 7.69909 4.85936 4.86003C7.69832 7.69909 12.3017 7.69909 15.1406 4.86003C12.3017 7.69909 12.3017 12.3007 15.1406 15.1397C12.3017 12.3007 7.69832 12.3007 4.85936 15.1397Z" />
                </svg>
              </span>
              <div className="flex-1">
                <div className="ib-t-caption font-medium text-ib-ink-1">
                  Zenboard
                </div>
                <div className="ib-t-micro text-ib-ink-3">
                  to Alex · 7:30
                </div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="tabler-icon tabler-icon-mail shrink-0 text-ib-ink-4" aria-hidden="true">
                <path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" />
                <path d="M3 7l9 6l9 -6" />
              </svg>
            </div>
            <div className="px-4 pt-3">
              <div className="ib-t-h4 font-semibold">
                Thursday: 4 tasks, 2 meetings
              </div>
            </div>
            <div className="mx-4 mt-3 flex items-center gap-2 rounded-md px-3 py-2" style={{ background: "var(--ib-accent-soft)" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256" className="shrink-0" style={{ color: "var(--ib-accent)" }} aria-hidden="true">
                <path d="M234.29,114.85l-45,38.83L203,211.75a16.4,16.4,0,0,1-24.5,17.82L128,198.49,77.47,229.57A16.4,16.4,0,0,1,53,211.75l13.76-58.07-45-38.83A16.46,16.46,0,0,1,31.08,86l59-4.76,22.76-55.08a16.36,16.36,0,0,1,30.27,0l22.75,55.08,59,4.76a16.46,16.46,0,0,1,9.37,28.86Z" />
              </svg>
              <span className="ib-t-caption text-ib-ink-1">
                <span className="text-ib-ink-3">
                  Highlight:
                </span>
                {" Send the Ridgeline invoice"}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 px-4 pt-3">
              <span className="ib-t-micro flex items-center gap-2 text-ib-ink-2">
                <span className="grid size-4 place-items-center rounded-sm bg-ib-surface-3 text-ib-ink-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" className="shrink-0" aria-hidden="true">
                    <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z" />
                  </svg>
                </span>
                11:30 Ridgeline call · 3:00 Beacon sync
              </span>
              <span className="ib-t-micro flex items-center gap-2 text-ib-ink-2">
                <span className="grid size-4 place-items-center rounded-sm bg-ib-surface-3 text-ib-ink-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="tabler-icon tabler-icon-arrow-right shrink-0" aria-hidden="true">
                    <path d="M5 12l14 0" />
                    <path d="M13 18l6 -6" />
                    <path d="M13 6l6 6" />
                  </svg>
                </span>
                Waiting on Beacon: scope sign-off
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-ib-line bg-ib-surface-2 px-4 py-2">
              <span className="ib-t-micro text-ib-ink-3">
                Arrives at
              </span>
              <span className="ib-t-micro rounded-[5px] px-1.5 py-0.5 text-ib-ink-3">
                6:30
              </span>
              <span className="ib-t-micro rounded-[5px] px-1.5 py-0.5 bg-ib-surface text-ib-ink-1 shadow-ib-1">
                7:30
              </span>
              <span className="ib-t-micro rounded-[5px] px-1.5 py-0.5 text-ib-ink-3">
                8:30
              </span>
            </div>
          </div>
        </div>
      </div>
    </Stage>
  );
}

/** Zenboard at the centre, joined to what it brings in: work travels along the lines, and the server says it is connected. */
export function BoardIntegrations() {
  return (
    <Stage w={400} h={300} label="Zenboard at the center, connected to a Notion import, Google Calendar, the morning email and an AI assistant through Zenboard's MCP server.">
      <svg width="400" height="300" className="absolute inset-0">
        <circle cx="200" cy="142" r="74" fill="none" stroke="var(--ib-line-strong)" strokeDasharray="2 5" />
        <g>
          <line x1="200" y1="142" x2="86" y2="52" stroke="var(--ib-line-strong)" strokeDasharray="3 4" />
          <circle r="3" fill="var(--ib-accent)" className="ib-anim" style={{ offsetPath: "path(\"M 86 52 L 200 142\")", animationName: "ib-offset", animationDuration: "2.4s", animationDelay: "0s" }} />
        </g>
        <g>
          <line x1="200" y1="142" x2="314" y2="52" stroke="var(--ib-line-strong)" strokeDasharray="3 4" />
          <circle r="3" fill="var(--ib-accent)" className="ib-anim" style={{ offsetPath: "path(\"M 314 52 L 200 142\")", animationName: "ib-offset", animationDuration: "2.4s", animationDelay: "0.6s" }} />
        </g>
        <g>
          <line x1="200" y1="142" x2="86" y2="244" stroke="var(--ib-line-strong)" strokeDasharray="3 4" />
          <circle r="3" fill="var(--ib-accent)" className="ib-anim" style={{ offsetPath: "path(\"M 86 244 L 200 142\")", animationName: "ib-offset", animationDuration: "2.4s", animationDelay: "1.2s" }} />
        </g>
        <g>
          <line x1="200" y1="142" x2="314" y2="244" stroke="var(--ib-line-strong)" strokeDasharray="3 4" />
          <circle r="3" fill="var(--ib-accent)" className="ib-anim" style={{ offsetPath: "path(\"M 314 244 L 200 142\")", animationName: "ib-offset", animationDuration: "2.4s", animationDelay: "1.8s" }} />
        </g>
      </svg>
      <div className="absolute" style={{ left: "168px", top: "110px", width: "64px", height: "64px", zIndex: "2" }}>
        <span className="grid size-16 place-items-center rounded-2xl bg-ib-surface shadow-ib-float">
          <svg width="28" height="28" viewBox="0 0 20 20" fill="currentColor" className="shrink-0" style={{ color: "var(--ib-accent)" }}>
            <path d="M18.4226 8.14215L18.6403 7.92451C20.4532 6.11147 20.4532 3.1733 18.6403 1.36026L18.6383 1.35832C16.8254 -0.452773 13.8873 -0.452773 12.0763 1.35832L11.8567 1.57791C10.8326 2.60199 9.16736 2.60199 8.14137 1.57791L7.92373 1.36026C6.11076 -0.452773 3.1727 -0.452773 1.35973 1.36026C-0.453243 3.1733 -0.453243 6.11147 1.35973 7.92451L1.57736 8.14215C2.60141 9.16818 2.60141 10.8335 1.57736 11.8576L1.35973 12.0753C-0.453243 13.8883 -0.453243 16.8265 1.35973 18.6395C3.1727 20.4525 6.11076 20.4545 7.92373 18.6395L8.14137 18.4219C9.16736 17.3958 10.8326 17.3958 11.8567 18.4219L12.0743 18.6395C13.8873 20.4525 16.8254 20.4525 18.6383 18.6395H18.6403V18.6376C20.4532 16.8245 20.4532 13.8863 18.6403 12.0733L18.4226 11.8557C17.3966 10.8316 17.3966 9.16623 18.4226 8.1402V8.14215ZM4.85936 15.1397C7.69832 12.3007 7.69832 7.69909 4.85936 4.86003C7.69832 7.69909 12.3017 7.69909 15.1406 4.86003C12.3017 7.69909 12.3017 12.3007 15.1406 15.1397C12.3017 12.3007 7.69832 12.3007 4.85936 15.1397Z" />
          </svg>
        </span>
      </div>
      <div className="absolute" style={{ left: "12px", top: "30px", width: "148px", zIndex: "1" }}>
        <div className="relative overflow-hidden rounded-xl bg-ib-surface shadow-ib-2 flex items-center gap-2 px-2.5 py-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-ib-surface-3 text-ib-ink-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="tabler-icon tabler-icon-upload shrink-0" aria-hidden="true">
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
              <path d="M7 9l5 -5l5 5" />
              <path d="M12 4l0 12" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="ib-t-caption block truncate font-medium text-ib-ink-1">
              Notion import
            </span>
            <span className="ib-t-micro block text-ib-ink-3">
              142 pages
            </span>
          </span>
        </div>
      </div>
      <div className="absolute" style={{ left: "240px", top: "30px", width: "148px", zIndex: "1" }}>
        <div className="relative overflow-hidden rounded-xl bg-ib-surface shadow-ib-2 flex items-center gap-2 px-2.5 py-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-ib-surface-3 text-ib-ink-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" className="shrink-0" aria-hidden="true">
              <path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Z" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="ib-t-caption block truncate font-medium text-ib-ink-1">
              Google Calendar
            </span>
            <span className="ib-t-micro block text-ib-ink-3">
              Synced
            </span>
          </span>
        </div>
      </div>
      <div className="absolute" style={{ left: "12px", top: "222px", width: "148px", zIndex: "1" }}>
        <div className="relative overflow-hidden rounded-xl bg-ib-surface shadow-ib-2 flex items-center gap-2 px-2.5 py-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-ib-surface-3 text-ib-ink-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="tabler-icon tabler-icon-mail shrink-0" aria-hidden="true">
              <path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" />
              <path d="M3 7l9 6l9 -6" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="ib-t-caption block truncate font-medium text-ib-ink-1">
              Morning email
            </span>
            <span className="ib-t-micro block text-ib-ink-3">
              7:30
            </span>
          </span>
        </div>
      </div>
      <div className="absolute" style={{ left: "240px", top: "222px", width: "148px", zIndex: "1" }}>
        <div className="relative overflow-hidden rounded-xl bg-ib-surface shadow-ib-2 flex items-center gap-2 px-2.5 py-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-ib-surface-3 text-ib-ink-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="tabler-icon tabler-icon-sparkles shrink-0" aria-hidden="true">
              <path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="ib-t-caption block truncate font-medium text-ib-ink-1">
              AI assistant
            </span>
            <span className="ib-t-micro block text-ib-ink-3">
              via MCP
            </span>
          </span>
        </div>
      </div>
      <div className="absolute flex justify-center" style={{ left: "120px", top: "186px", width: "160px", zIndex: "2" }}>
        <span className="ib-t-caption inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 font-medium bg-ib-surface text-ib-ink-1 shadow-ib-2 ib-t-mono">
          <span className="ib-anim ib-pulse size-1.5 rounded-full bg-ib-success" style={{ "--ib-pulse": "var(--ib-success-soft)" } as React.CSSProperties} />
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="tabler-icon tabler-icon-plug shrink-0" aria-hidden="true">
            <path d="M9.785 6l8.215 8.215l-2.054 2.054a5.81 5.81 0 1 1 -8.215 -8.215l2.054 -2.054" />
            <path d="M4 20l3.5 -3.5" />
            <path d="M15 4l-3.5 3.5" />
            <path d="M20 9l-3.5 3.5" />
          </svg>
          {" mcp · connected"}
        </span>
      </div>
    </Stage>
  );
}

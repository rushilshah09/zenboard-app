import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FocusEdge } from './focus-edge';

// ── ENTERING FOCUS IS AN EVENT, NOT A SETTING ──────────────────────────────
//
// User, 2026-09-23: the mode's whole interface was "a toggle in the header", and it "looks
// boring" — while the mode itself removes the sidebar, the chrome and every other way out. Two
// things fix that, and this pins both: the room lights from its edge for as long as you are in
// the mode (the OS's own recording-border idiom, which the user sent), and the key that enters
// the mode can also leave it.

const shell = readFileSync('components/shell/app-shell.tsx', 'utf8');
const css = readFileSync('app/globals.css', 'utf8');
const keys = readFileSync('components/shell/keyboard-shortcuts.tsx', 'utf8');
// The edge's own rules only — the toggle's glyph rules live after the keyframes and do animate
// transform and filter, which is Emil's icon crossfade and not this element's business.
const edgeCss = css.slice(css.indexOf('.zb-focus-edge {'), css.indexOf("/* ── THE FOCUS TOGGLE'S MARK"));

describe('the focus edge', () => {
  it('is mounted always, so it can animate OUT as well as in', () => {
    // Focus is a route: a component rendered only while focused unmounts before it can fade.
    expect(shell).toMatch(/<FocusEdge on=\{focusMode\} \/>/);
    expect(renderToStaticMarkup(React.createElement(FocusEdge, { on: true }))).toContain('data-on');
    expect(renderToStaticMarkup(React.createElement(FocusEdge, { on: false }))).not.toContain('data-on');
  });

  it('never takes a pointer event, and never speaks', () => {
    const markup = renderToStaticMarkup(React.createElement(FocusEdge, { on: true }));
    expect(markup).toContain('aria-hidden');
    expect(edgeCss).toMatch(/pointer-events: none;/);
    expect(edgeCss).toMatch(/z-index: var\(--z-focus-edge\)/);
  });

  it('is light at the edge — a stack with falloff, not one blurred vignette', () => {
    const layers = [...edgeCss.matchAll(/inset 0 0 [^,;]+/g)].map((m) => m[0]);
    expect(layers.length).toBeGreaterThanOrEqual(4);
    expect(layers[0]).toMatch(/inset 0 0 0 1(\.5)?px/); // the hairline that closes the frame
    expect(edgeCss).toMatch(/var\(--accent\)/);   // the one hue, whichever the person chose
  });

  it('arrives slower than it leaves, on tokens, animating opacity only', () => {
    // Emil: a mode change may take its time arriving; the system's response is quick. And the
    // arrival blooms past its resting level before settling — light steadies, it does not snap.
    expect(edgeCss).toMatch(/animation: zb-focus-edge-in calc\(var\(--duration-slow\) \* 3\) var\(--ease-out-quiet\)/);
    expect(edgeCss).toMatch(/transition: opacity var\(--duration-fast\) var\(--ease-hover\)/);
    expect(edgeCss).not.toMatch(/\d+ms/);
    const frames = css.slice(css.indexOf('@keyframes zb-focus-edge-in'));
    expect(frames.slice(0, 160)).toMatch(/45%\s*\{ opacity: 1; \}/);
    // Only opacity is animated — the element is fixed and full-screen; anything else repaints it.
    expect(edgeCss).not.toMatch(/transition:[^;]*(transform|width|height|filter)/);
  });

  it('keeps the signal under reduced motion and drops the bloom', () => {
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce) {\n  .zb-focus-edge'));
    expect(reduced.slice(0, 120)).toMatch(/\.zb-focus-edge\[data-on\] \{ animation: none; \}/);
  });
});

describe('the focus toggle', () => {
  it('states the mode with one glyph in two weights, crossfaded', () => {
    // better-ui: outline is the default, fill marks the active state — one SVG, recoloured.
    expect(shell).toMatch(/<Icon icon=\{Circle\} size=\{14\} className="zb-focus-glyph-off" \/>/);
    expect(shell).toMatch(/<Icon icon=\{Circle\} size=\{14\} weight="fill" className="zb-focus-glyph-on" \/>/);
    // Emil's contextual icon values, exactly: scale 0.25 → 1, opacity 0 → 1, blur 4px → 0.
    const glyph = css.slice(css.indexOf('.zb-focus-glyph {'), css.indexOf('/* Reduced motion keeps the SIGNAL'));
    expect(glyph).toMatch(/\.zb-focus-glyph-on \{ opacity: 0; transform: scale\(0\.25\); filter: blur\(4px\);/);
    expect(glyph).toMatch(/\.zb-focus-toggle\[data-on\] \.zb-focus-glyph-on \{ opacity: 1; transform: scale\(1\); filter: blur\(0\); \}/);
    // Both glyphs stay in the DOM, stacked in one grid cell — a swap would pop.
    expect(glyph).toMatch(/grid-area: 1 \/ 1;/);
  });

  it('is a switch with a name, and says which key does it', () => {
    expect(shell).toMatch(/role="switch" aria-checked=\{on\} aria-label="Focus mode"/);
    expect(shell).toMatch(/content=\{on \? 'Leave focus mode · F' : 'Focus mode · F'\}/);
  });
});

describe('entering the mode is one movement', () => {
  it('navigates inside a view transition, not straight into a cut', () => {
    expect(shell).toMatch(/navigateWithTransition\(\(\) => router\.push\(dest\), \(\) => window\.location\.pathname === dest\)/);
  });

  it('names the pieces that move, so each one moves rather than dissolving', () => {
    for (const name of ['zb-sidebar', 'zb-main', 'zb-topbar-actions']) {
      expect(shell, name).toContain(`viewTransitionName: '${name}'`);
    }
    // The header cluster is named in BOTH top bars — in focus it is one control, outside it is
    // six, and naming only one end would cross-fade instead of travelling.
    expect(shell.match(/viewTransitionName: 'zb-topbar-actions'/g)).toHaveLength(2);
  });

  it('pins the snapshots so a resizing column moves instead of stretching', () => {
    // Measured on the first build: without this, every line of the header and the breadcrumb was
    // painted twice at two widths — a double exposure, not movement.
    // Comments explain the ladder in prose ("300ms"), so the raw-ms check reads the RULES only.
    const vt = css.slice(css.indexOf('::view-transition-group(root)'), css.indexOf("html[data-vt] .zb-page-in")).replace(/\/\*[\s\S]*?\*\//g, '');
    expect(vt).toMatch(/object-fit: none;/);
    expect(vt).toMatch(/object-position: top left;/);
    expect(vt).toMatch(/::view-transition-old\(zb-topbar-actions\),\n::view-transition-new\(zb-topbar-actions\) \{\n  object-position: top right;/);
    // One ladder, no raw milliseconds: the room settles in 300ms, the sidebar leaves in 200.
    expect(vt).toMatch(/animation-duration: calc\(var\(--duration-slow\) \* 1\.5\)/);
    expect(vt).toMatch(/animation: zb-vt-sidebar-out var\(--duration-slow\)/);
    expect(vt).not.toMatch(/\d+ms/);
  });

  it('holds the page’s own entrance while the transition runs', () => {
    // Otherwise a page fades IN on top of content the browser is already cross-fading.
    expect(css).toMatch(/html\[data-vt\] \.zb-page-in \{ animation: none !important; \}/);
  });
});

describe('the focus key', () => {
  it('toggles — it used to enter a mode it could not leave', () => {
    expect(keys).toMatch(/router\.push\(isFocusMode\(pathname\) \? FOCUS_EXIT_PATH : FOCUS_PATH\)/);
    expect(keys).not.toMatch(/router\.push\('\/focus'\)/);
    // And the list Settings renders says so, because it is the same source.
    expect(keys).toMatch(/\{ keys: \['F'\], label: 'Focus mode on or off' \}/);
  });

  it('leaves a typed F alone', () => {
    expect(keys).toMatch(/if \(isTypingTarget\(e\.target\)\) return;/);
  });
});

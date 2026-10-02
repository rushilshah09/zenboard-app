import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ToolbarActions } from './shell-parts';

// ── A HAIRLINE BETWEEN EVERY TOP-BAR ACTION ────────────────────────────────
//
// User, 2026-10-02: "add separator between all action". `ToolbarActions` places the hairlines, so
// no caller writes one by hand, forgets one, or doubles one up.

const css = readFileSync('app/globals.css', 'utf8');
const shell = readFileSync('components/shell/app-shell.tsx', 'utf8');
const demo = readFileSync('components/demo/demo-shell.tsx', 'utf8');

const seps = (html: string) => (html.match(/zb-toolbar-sep/g) ?? []).length;
const action = (label: string) => React.createElement('button', { type: 'button' }, label);

describe('the top bar actions', () => {
  it('draws a hairline between every action, and none at either end', () => {
    const html = renderToStaticMarkup(React.createElement(ToolbarActions, null, action('a'), action('b'), action('c')));
    expect(seps(html)).toBe(2);
    expect(html.indexOf('zb-toolbar-sep')).toBeGreaterThan(html.indexOf('>a<'));
    expect(html.lastIndexOf('zb-toolbar-sep')).toBeLessThan(html.indexOf('>c<'));
  });

  it('skips the holes a narrow screen leaves, so two hairlines never meet', () => {
    // `{!isMobile && <X />}` is `false` on a phone; it must not cost a hairline.
    const html = renderToStaticMarkup(React.createElement(ToolbarActions, null, action('a'), false, null, action('b')));
    expect(seps(html)).toBe(1);
  });

  it('hides the second hairline when an action is present but renders nothing', () => {
    // The recording indicator renders null between meetings. React cannot see that from outside,
    // so the stylesheet hides a hairline that lands next to another one, or at an end.
    expect(css).toMatch(/\.zb-toolbar-sep \+ \.zb-toolbar-sep,\n\.zb-toolbar-sep:first-child,\n\.zb-toolbar-sep:last-child \{ display: none; \}/);
  });

  it('is the one way both top bars lay out their actions', () => {
    for (const src of [shell, demo]) {
      expect(src).toMatch(/<ToolbarActions style=\{\{ paddingInline: 'var\(--app-header-lead-px, 4px\)'/);
      expect(src, 'a hand-placed divider would double up').not.toMatch(/<ToolbarDivider/);
    }
  });
});

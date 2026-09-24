import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CircularProgress } from '@/components/ds/ui/progress';

// ── GOALS AND THE PORTAL ON THE HOUSE CARD ─────────────────────────────────
//
// The product-wide audit (2026-09-22, plans/PRODUCT_POLISH_2026-09-22.md sprint 5). A goal was a grey-filled panel on
// the grey page that drew ONE percentage twice (a 52px ring and a bar), faded a dropped goal's whole card with
// `opacity: 0.6`, opened a hand-rolled menu that closed when the pointer left it, picked its project in a native
// <select>, set its note and retro in an italic serif, and fired every save without reading the answer. The client
// portal drew its own softer card language (`paper-2` at `r-xl`/`r-2xl`) with a filled button on every card.

const code = (f: string) => readFileSync(f, 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
const GOALS = 'components/horizon/horizon-view.tsx';
const PORTAL = 'components/portal/portal-document.tsx';

describe('a goal', () => {
  const goals = code(GOALS);

  it('is the house card, not a grey panel', () => {
    // The card is the DS recipe now — one card for the whole app (components/ds/ui/card.tsx).
    expect(goals).toMatch(/<article className=\{cardClass\(\)\}>/);
    expect(goals).not.toMatch(/background: 'var\(--paper-2\)'/);
  });

  it('draws its progress once, as a glyph', () => {
    expect(goals).toMatch(/<CircularProgress value=\{frac \* 100\} size=\{16\}/);
    expect(goals).not.toMatch(/function Ring\(/);
    // The 16px glyph is an outline and a pie — no number crammed inside, and no arc that reads as a spinner.
    const glyph = renderToStaticMarkup(React.createElement(CircularProgress, { value: 60, size: 16 }));
    expect(glyph).toMatch(/aria-valuenow="60"/);
    expect(glyph).not.toMatch(/data-numeric/);
    expect(glyph.match(/<circle/g)?.length).toBe(2);
  });

  it('never fades its text; a dropped goal is struck through in ink', () => {
    expect(goals).not.toMatch(/opacity: goal\.status === 'dropped'/);
    expect(goals).toMatch(/dropped \? 'text-ink-500 line-through'/);
  });

  it('uses the design system’s menu and select', () => {
    expect(goals).not.toMatch(/onMouseLeave=\{\(\) => setMenu\(false\)\}/);
    expect(goals).not.toMatch(/<select\b/);
    expect(goals).toMatch(/<DropdownMenu>/);
    expect(goals).toMatch(/<MenuSelect\b/);
  });

  it('reads the answer to every save, and puts the old value back when refused', () => {
    // Every write goes through `save` (or the step writes), each of which awaits and reverts with a toast.
    const writes = goals.match(/\bupdateGoal\(/g)?.length ?? 0;
    expect(writes, 'one updateGoal call, inside save()').toBe(1);
    expect(goals).toMatch(/if \('error' in res\) \{ patch\(id, prev\); toastReverted\(res\.error\); \}/);
    expect(goals.match(/toastReverted\(res\.error\)/g)?.length).toBeGreaterThanOrEqual(3);
  });
});

describe('the client portal', () => {
  const portal = code(PORTAL);

  it('draws every card as the house card', () => {
    expect(portal).toMatch(/const CARD = CARD_CLASS;/);
    expect(portal).not.toMatch(/background: 'var\(--paper-2\)'/);
    expect(portal).not.toMatch(/--r-2xl|borderRadius: 'var\(--r-xl\)'/);
  });

  it('keeps filled buttons to the two form submits — never one per card', () => {
    // RequestForm's Send and the approval's change-request Send are the only filled buttons; Approve, Request
    // changes, Open the form and Reply sit in lists of cards and are secondary.
    expect(portal.match(/variant="primary"/g)?.length).toBe(2);
    expect(portal).toMatch(/variant="secondary" size="sm" onClick=\{approve\}/);
  });
});

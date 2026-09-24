import { describe, it, expect } from 'vitest';
import { focusOpensTooltip } from './tooltip';

// A tooltip names a control for someone ARRIVING at it. When a menu or a dialog
// closes, Radix hands focus back to the control that opened it — and the tooltip
// used to open on that returned focus, where it took the next Escape. In a peek,
// after its mode menu, Escape closed the menu, then the tooltip, and only a third
// press closed the page (measured with real keys: scripts/verify/verify-open-pages-in.mjs).
const from = (...roles: string[]) => ({
  closest: (selectors: string) =>
    ([...selectors.matchAll(/role="?([a-z]+)"?/g)].some((m) => roles.includes(m[1])) ? {} : null),
});

describe('focusOpensTooltip — arriving at a control, not being handed back to it', () => {
  it('opens when focus arrives from another control (Tab)', () => {
    expect(focusOpensTooltip(from())).toBe(true);
  });

  it('stays shut when a menu hands focus back to its trigger', () => {
    expect(focusOpensTooltip(from('menu'))).toBe(false);
    expect(focusOpensTooltip(from('menuitem'))).toBe(false);
  });

  it('stays shut when a dialog or a listbox hands focus back', () => {
    expect(focusOpensTooltip(from('dialog'))).toBe(false);
    expect(focusOpensTooltip(from('listbox'))).toBe(false);
  });

  it('stays shut when the element focus left is gone — an overlay that unmounted', () => {
    expect(focusOpensTooltip(null)).toBe(false);
  });
});

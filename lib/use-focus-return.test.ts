import { describe, it, expect } from 'vitest';
import { focusFellNowhere } from './use-focus-return';

// The hook itself is three lines around this rule: remember who had focus, and
// on close hand it back — but only if the close left focus nowhere.
describe('focus is handed back only when it fell nowhere', () => {
  it('nowhere is the body, the root, or nothing at all', () => {
    expect(focusFellNowhere(null)).toBe(true);
    expect(focusFellNowhere({ tagName: 'BODY' })).toBe(true);
    expect(focusFellNowhere({ tagName: 'HTML' })).toBe(true);
  });

  it('leaves a deliberate claim alone', () => {
    expect(focusFellNowhere({ tagName: 'INPUT' })).toBe(false);
    expect(focusFellNowhere({ tagName: 'BUTTON' })).toBe(false);
    expect(focusFellNowhere({ tagName: 'DIV' })).toBe(false);
  });
});

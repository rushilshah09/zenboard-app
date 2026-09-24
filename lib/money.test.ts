import { describe, it, expect } from 'vitest';
import { formatMoney, formatMoneyCompact } from './money';

// Pin a locale so these assert OUR logic, not the runner's environment.
// Real client call sites pass no locale on purpose — see the locale rule.
const L = { locale: 'en-US' };

describe('formatMoney', () => {
  it('rounds to whole dollars by default', () => {
    expect(formatMoney(3600, L)).toBe('$3,600');
    expect(formatMoney(3600.42, L)).toBe('$3,600');
  });

  it('keeps cents only when asked, and only when there are any', () => {
    expect(formatMoney(3600.42, { ...L, exact: true })).toBe('$3,600.42');
    // The point of the `exact` guard: a whole amount must not become "$3,600.00".
    expect(formatMoney(3600, { ...L, exact: true })).toBe('$3,600');
  });

  it('groups by the reader’s locale, not always the US one', () => {
    // The bug this replaces: three call sites hardcoded 'en-US' and one didn't,
    // so the same figure was punctuated two ways in one session.
    expect(formatMoney(3600, { locale: 'de-DE' })).toBe('$3.600');
  });

  it('renders a dash for absent or non-numeric input', () => {
    for (const v of [null, undefined, NaN]) expect(formatMoney(v, L)).toBe('—');
  });

  it('keeps the sign on a negative', () => {
    expect(formatMoney(-250, L)).toBe('$-250');
  });
});

describe('formatMoneyCompact', () => {
  it('abbreviates thousands and millions', () => {
    expect(formatMoneyCompact(37000, L)).toBe('$37k');
    expect(formatMoneyCompact(37500, L)).toBe('$37.5k');
    expect(formatMoneyCompact(1_200_000, L)).toBe('$1.2M');
  });

  it('falls through to the full figure below a thousand', () => {
    expect(formatMoneyCompact(950, L)).toBe('$950');
  });

  it('chooses the suffix on magnitude, so negatives abbreviate too', () => {
    expect(formatMoneyCompact(-37000, L)).toBe('$-37k');
  });
});

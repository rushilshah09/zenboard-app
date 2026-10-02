import { describe, it, expect } from 'vitest';
import { sheetRelease, rubberBand, FLICK_VELOCITY } from './drawer';

// Emil Kowalski's gesture rules for a sheet, as arithmetic. A phone is where these
// are felt; this is where they are held.
describe('a released sheet drag', () => {
  const H = 600; // the sheet's height at its detent

  it('uses Emil’s flick threshold', () => {
    expect(FLICK_VELOCITY).toBe(0.11);
  });

  it('dismisses on a quick flick down, however short', () => {
    // 60px in 200ms is 0.3px/ms - far under 25% of the sheet, clearly meant.
    expect(sheetRelease(60, 200, H)).toBe('down');
  });

  it('stays put on a slow short drag', () => {
    // 60px over 2s is 0.03px/ms: someone adjusting their grip, not dismissing.
    expect(sheetRelease(60, 2000, H)).toBe('stay');
  });

  it('still moves down on a slow drag past a quarter of the sheet', () => {
    expect(sheetRelease(160, 3000, H)).toBe('down');
  });

  it('expands on a quick flick up — the branch a zero clamp used to make unreachable', () => {
    expect(sheetRelease(-50, 150, H)).toBe('up');
  });

  it('does not treat a jittery tap as a flick', () => {
    // 6px in 10ms measures 0.6px/ms, but it is a tap.
    expect(sheetRelease(6, 10, H)).toBe('stay');
    expect(sheetRelease(-6, 10, H)).toBe('stay');
  });
});

describe('rubber band past the top edge', () => {
  it('moves less the further it is pulled, and never past its dimension', () => {
    const a = rubberBand(50, 600), b = rubberBand(200, 600), c = rubberBand(5000, 600);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(b - a).toBeLessThan(200 - 50);    // damped: less travel than the finger
    expect(c).toBeLessThan(600);
  });

  it('is zero at rest', () => {
    expect(rubberBand(0, 600)).toBe(0);
  });
});

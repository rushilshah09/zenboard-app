import { describe, it, expect } from 'vitest';
import { decideNav, type PendingNav } from './use-nav-once';

/** Walk a sequence of onValueChange events and record what would be pushed. */
function run(steps: { current: string; value: string }[]) {
  let pending: PendingNav = null;
  const pushed: string[] = [];
  for (const s of steps) {
    const r = decideNav(pending, s.current, s.value);
    pending = r.pending;
    if (r.push) pushed.push(s.value);
  }
  return pushed;
}

describe('decideNav', () => {
  it('pushes once for a normal click', () => {
    expect(run([{ current: 'build', value: 'share' }])).toEqual(['share']);
  });

  it('DROPS the duplicate that focus-then-click produces', () => {
    // THE BUG. Radix activates on focus and again on click, and `current` is
    // still the old tab both times because the URL has not changed yet.
    expect(run([
      { current: 'build', value: 'share' },   // focus
      { current: 'build', value: 'share' },   // click, same stale `current`
    ])).toEqual(['share']);
  });

  it('still lets you move on once the navigation lands', () => {
    expect(run([
      { current: 'build', value: 'share' },
      { current: 'build', value: 'share' },
      { current: 'share', value: 'insights' },   // arrived, then clicked again
    ])).toEqual(['share', 'insights']);
  });

  it('does NOT swallow arrowing along the strip', () => {
    // Not a debounce: three different destinations in one tick are three real
    // navigations, and collapsing them would break keyboard tabbing.
    expect(run([
      { current: 'build', value: 'share' },
      { current: 'build', value: 'insights' },
      { current: 'build', value: 'responses' },
    ])).toEqual(['share', 'insights', 'responses']);
  });

  it('ignores a click on the tab you are already on', () => {
    expect(run([{ current: 'share', value: 'share' }])).toEqual([]);
  });

  it('recovers if the user navigates away by some other route', () => {
    // Marker set for `share`, but the URL went somewhere else entirely (a rail
    // click, the back button). The stale marker must not block anything.
    expect(run([
      { current: 'build', value: 'share' },
      { current: 'settings', value: 'share' },
    ])).toEqual(['share', 'share']);
  });

  it('lets you go back to where you came from', () => {
    expect(run([
      { current: 'build', value: 'share' },
      { current: 'share', value: 'build' },
    ])).toEqual(['share', 'build']);
  });
});

import { describe, it, expect } from 'vitest';
import { decideSnapshot, versionsToPrune, versionBucket, SNAPSHOT_WINDOW_MIN } from './version-policy';

const at = (min: number) => new Date(Date.UTC(2026, 7, 1, 12, 0, 0) + min * 60000);
const base = at(0).toISOString();

describe('decideSnapshot — the coalescing window', () => {
  it('takes a first version as soon as anything changes', () => {
    expect(decideSnapshot({ lastVersionAt: null, changed: true })).toEqual({
      snapshot: true, reason: 'first-version',
    });
  });

  it('never snapshots unchanged content, however long it has been', () => {
    expect(decideSnapshot({ lastVersionAt: null, changed: false }).snapshot).toBe(false);
    // The important one: time passing must not manufacture entries for an idle doc.
    expect(decideSnapshot({ lastVersionAt: base, changed: false, now: at(60 * 24) })).toEqual({
      snapshot: false, reason: 'unchanged',
    });
  });

  it('coalesces edits inside the window into the existing version', () => {
    expect(decideSnapshot({ lastVersionAt: base, changed: true, now: at(1) })).toEqual({
      snapshot: false, reason: 'within-window',
    });
    expect(decideSnapshot({ lastVersionAt: base, changed: true, now: at(SNAPSHOT_WINDOW_MIN - 1) }).snapshot).toBe(false);
  });

  it('starts a new version once the window has elapsed', () => {
    expect(decideSnapshot({ lastVersionAt: base, changed: true, now: at(SNAPSHOT_WINDOW_MIN) })).toEqual({
      snapshot: true, reason: 'window-elapsed',
    });
    expect(decideSnapshot({ lastVersionAt: base, changed: true, now: at(120) }).snapshot).toBe(true);
  });

  it('treats an unparseable timestamp as due rather than wedging history shut', () => {
    expect(decideSnapshot({ lastVersionAt: 'not-a-date', changed: true }).snapshot).toBe(true);
  });
});

describe('versionsToPrune', () => {
  const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `v${i}`, created_at: at(i).toISOString() }));

  it('keeps everything under the cap', () => {
    expect(versionsToPrune(mk(3), 5)).toEqual([]);
    expect(versionsToPrune(mk(5), 5)).toEqual([]);
  });

  it('drops the OLDEST beyond the cap', () => {
    // v0 is oldest, v6 newest. Cap 5 keeps v6..v2, prunes v1 and v0.
    expect(versionsToPrune(mk(7), 5).sort()).toEqual(['v0', 'v1']);
  });

  it('does not assume input order', () => {
    const shuffled = [...mk(7)].reverse();
    expect(versionsToPrune(shuffled, 5).sort()).toEqual(['v0', 'v1']);
  });
});

describe('versionBucket', () => {
  const now = new Date(2026, 7, 1, 12, 0, 0);
  it('buckets today, yesterday and earlier', () => {
    expect(versionBucket(new Date(2026, 7, 1, 9, 0, 0).toISOString(), now)).toBe('Today');
    expect(versionBucket(new Date(2026, 6, 31, 23, 0, 0).toISOString(), now)).toBe('Yesterday');
    expect(versionBucket(new Date(2026, 6, 20).toISOString(), now)).toBe('Earlier');
  });
});

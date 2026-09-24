import { describe, it, expect } from 'vitest';
import { shouldAutoSync, AUTO_SYNC_FRESH_MS } from './gcal-auto-sync';

const NOW = Date.parse('2026-09-14T10:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('shouldAutoSync', () => {
  it('syncs when it has never synced', () => {
    expect(shouldAutoSync(null, NOW)).toBe(true);
  });

  it('trusts a sync from a few minutes ago', () => {
    // The whole point: Home visited again shortly after must not call Google,
    // write events and re-render itself for nothing.
    expect(shouldAutoSync(ago(60_000), NOW)).toBe(false);
    expect(shouldAutoSync(ago(AUTO_SYNC_FRESH_MS - 1), NOW)).toBe(false);
  });

  it('syncs again once the last sync is old', () => {
    expect(shouldAutoSync(ago(AUTO_SYNC_FRESH_MS), NOW)).toBe(true);
    expect(shouldAutoSync(ago(6 * 3600_000), NOW)).toBe(true);
  });

  it('treats small clock skew as fresh, but not a corrupt future stamp', () => {
    expect(shouldAutoSync(new Date(NOW + 5_000).toISOString(), NOW)).toBe(false);
    expect(shouldAutoSync(new Date(NOW + 30 * 86400_000).toISOString(), NOW)).toBe(true);
  });

  it('syncs when the stamp is unreadable', () => {
    expect(shouldAutoSync('not a date', NOW)).toBe(true);
  });
});

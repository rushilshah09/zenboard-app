import { beforeEach, describe, expect, it, vi } from 'vitest';

// Focus sessions from before signing in, arriving in the account. Run against a recording fake of the
// database: what it is asked, and what it is given to insert.

const calls: { inserted: unknown[]; existing: string[]; failRead: boolean } = { inserted: [], existing: [], failRead: false };

function fakeClient() {
  const query = {
    select: () => query,
    eq: () => query,
    in: (_: string, starts: string[]) => Promise.resolve(
      calls.failRead
        ? { data: null, error: { message: 'down' } }
        : { data: calls.existing.filter((s) => starts.includes(s)).map((started_at) => ({ started_at })), error: null },
    ),
    insert: (rows: unknown[]) => { calls.inserted.push(...rows); return Promise.resolve({ error: null }); },
  };
  return { from: (table: string) => { expect(table).toBe('time_entries'); return query; } };
}

vi.mock('@/lib/auth', () => ({ requireSession: async () => ({ supabase: fakeClient(), user: { id: 'me' } }) }));

const { importGuestFocus } = await import('./guest-focus');

const at = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString();

beforeEach(() => { calls.inserted = []; calls.existing = []; calls.failRead = false; });

describe('bringing the website\'s focus sessions into the account', () => {
  it('adds each as the account\'s own focus time: from the timer, not billable, with a note', async () => {
    const start = at(2);
    expect(await importGuestFocus([{ startedAt: start, minutes: 25, what: 'Logo' }])).toEqual({ imported: 1 });
    expect(calls.inserted).toEqual([{
      user_id: 'me', source: 'timer', billable: false, minutes: 25, started_at: start,
      ended_at: new Date(Date.parse(start) + 25 * 60_000).toISOString(), note: 'Focus session · Logo',
    }]);
  });

  it('never adds one twice: a session already there is skipped', async () => {
    const a = at(3);
    const b = at(1);
    calls.existing = [a];
    expect(await importGuestFocus([{ startedAt: a, minutes: 25, what: '' }, { startedAt: b, minutes: 15, what: '' }])).toEqual({ imported: 1 });
    expect(calls.inserted).toHaveLength(1);
  });

  it('trusts nothing it is handed: only what the rules keep reaches the database', async () => {
    expect(await importGuestFocus([{ startedAt: at(1), minutes: 900 }, { startedAt: 'soon', minutes: 25 }, 'x'])).toEqual({ imported: 0 });
    expect(await importGuestFocus('not a list')).toEqual({ imported: 0 });
    expect(calls.inserted).toEqual([]);
  });

  it('says so when it cannot read the account, and adds nothing', async () => {
    calls.failRead = true;
    expect(await importGuestFocus([{ startedAt: at(1), minutes: 25, what: '' }])).toEqual({ error: 'down' });
    expect(calls.inserted).toEqual([]);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { describeDbFailure } from './database-failure';
import { FAILURE_COPY } from './action-failure';

// What a database block says when it cannot be shown or cannot be made. Before
// this rule the block printed whatever the server said, and a failed save wrote
// that text into the document, where it stayed.
describe('describeDbFailure', () => {
  it('never shows the server’s own words', () => {
    // Exactly what a database block said, as its whole body, on screen.
    const f = describeDbFailure('duplicate key value violates unique constraint "collections_pkey"', 'create');
    expect(f).toEqual({ title: 'This database couldn’t be created', retry: true });
  });

  it('keeps a reason that was written for people', () => {
    expect(describeDbFailure(FAILURE_COPY.unreachable, 'create')).toEqual({
      title: 'This database couldn’t be created', detail: FAILURE_COPY.unreachable, retry: true,
    });
    expect(describeDbFailure(FAILURE_COPY.stale, 'create').detail).toBe(FAILURE_COPY.stale);
  });

  it('says loaded, not created, for a database that exists but would not load', () => {
    expect(describeDbFailure('Failed to fetch', 'load')).toEqual({ title: 'This database couldn’t be loaded', retry: true });
    expect(describeDbFailure('Failed to fetch', 'list')).toEqual({ title: 'Your databases couldn’t be loaded', retry: true });
  });

  it('tells the PERSON it is unavailable, the DEVELOPER which migration, and offers no retry that cannot help', () => {
    // Supabase words the missing tables two ways; both mean 0013 is not applied.
    //
    // This used to assert the opposite: that the user-facing detail named
    // "0013_databases.sql" — an instruction to paste SQL into Supabase, shown to customers, who
    // cannot (user, 2026-09-30: developer copy "looks amateur"). The migration number is the
    // developer's, so it goes to the developer's channel, and this proves it arrives there.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const m of ["Could not find the table 'public.collections' in the schema cache", 'relation "public.collections" does not exist']) {
      for (const when of ['create', 'load'] as const) {
        warn.mockClear();
        const f = describeDbFailure(m, when);
        expect(f.retry, m).toBe(false);
        expect(`${f.title} ${f.detail ?? ''}`, m).not.toMatch(/migration|\.sql|supabase/i);
        expect(warn.mock.calls.flat().join(' '), 'the developer is told which migration').toMatch(/0013/);
      }
    }
    warn.mockRestore();
  });

  it('writes its titles in sentence case, without a trailing period', () => {
    // The line appends the period itself, after the title and before the detail.
    const titles = [
      describeDbFailure('x', 'create'), describeDbFailure('x', 'load'), describeDbFailure('x', 'list'),
      describeDbFailure('schema cache', 'load'),
    ].map((f) => f.title);
    for (const t of titles) {
      expect(t, t).toMatch(/^[A-Z][^A-Z]*$/);
      expect(t.endsWith('.'), t).toBe(false);
    }
  });
});

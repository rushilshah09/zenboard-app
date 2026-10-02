import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Home is the most-visited page in the app, so its loader is the one place where
// an oversized query costs the most. These guard the two optimisations that are
// invisible from the UI and fail SILENTLY rather than loudly.
const src = readFileSync('lib/today-data.ts', 'utf8');
const waiting = readFileSync('lib/waiting.ts', 'utf8');

describe('Home loader — the content payload', () => {
  // `content` is the whole document body. `readContent()` reads one key out of
  // it. Selecting the sub-object turns "every block of every content piece" into
  // a ~30-byte object per row.
  it('selects the pipeline sub-object, never the whole document body', () => {
    expect(src, 'Home must not pull full document bodies')
      .not.toMatch(/from\('pages'\)\s*\n?\s*\.select\('id, title, content'\)/);
    expect(src).toMatch(/\.select\('id, title, content->pipeline'\)/);
  });

  it('hands readContent the shape it expects', () => {
    // The row key is `pipeline`, but readContent takes the content ROOT and
    // reads `.pipeline` off it — so the sub-object has to be re-wrapped. Getting
    // this wrong yields a default 'idea' stage for every piece, with no error.
    expect(src).toMatch(/readContent\(\{\s*pipeline:\s*r\.pipeline\s*\}\)/);
  });

  it('the jsonb path is spelled exactly — a typo returns 200, not an error', () => {
    // VERIFIED AGAINST THE LIVE DB: `content->nonexistent_key_xyz` responds 200
    // with the key `null` on every row. There is no failure mode to catch at
    // runtime, so the spelling is pinned here instead.
    const m = src.match(/content->(\w+)/g) ?? [];
    expect(m.length, 'expected exactly one jsonb path in the Home loader').toBe(1);
    expect(m[0]).toBe('content->pipeline');
  });
});

describe('Home loader — the waiting sources are filtered in SQL', () => {
  // waitingOn() discards every row that is not open. Fetching them anyway means
  // Home downloads every paid invoice and every decided approval a studio has
  // ever had. These assertions keep the SQL predicate and the JS predicate in
  // step — if one moves without the other, the section silently loses rows.
  it('approvals: only the status waitingOn() keeps', () => {
    expect(waiting, 'waiting.ts changed its approval predicate').toMatch(/a\.status !== 'awaiting'/);
    expect(src).toMatch(/from\('approvals'\)[\s\S]{0,220}?\.eq\('status', 'awaiting'\)/);
  });

  it('client requests: needs_info only — `pending` waits on US, the opposite list', () => {
    expect(waiting).toMatch(/!== 'needs_info'/);
    expect(src).toMatch(/from\('client_requests'\)[\s\S]{0,240}?\.eq\('status', 'needs_info'\)/);
  });

  it('invoices: sent + overdue, the two names for one unpaid fact', () => {
    expect(waiting).toMatch(/i\.status !== 'sent' && i\.status !== 'overdue'/);
    expect(src).toMatch(/from\('invoices'\)[\s\S]{0,240}?\.in\('status', \['sent', 'overdue'\]\)/);
  });

  it('every waiting source is bounded, and bounded deterministically', () => {
    // An unordered LIMIT drops arbitrary rows; this list is read oldest-first,
    // so a bound without an order could hide the most urgent item.
    for (const table of ['approvals', 'client_requests', 'invoices']) {
      const q = src.match(new RegExp(`from\\('${table}'\\)[\\s\\S]{0,300}?\\.limit\\((\\d+)\\)`));
      expect(q, `${table} is unbounded on Home`).not.toBeNull();
      expect(src).toMatch(new RegExp(`from\\('${table}'\\)[\\s\\S]{0,300}?\\.order\\([^)]*\\)[\\s\\S]{0,40}?\\.limit\\(`));
    }
  });
});

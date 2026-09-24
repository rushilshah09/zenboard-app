import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BUCKETS, FORMATS } from '@/lib/content';

// ── A FIXTURE THAT ONLY SHOWS THE HAPPY CASE HIDES THE BUG ─────────────────
//
// Two real defects shipped on 2026-09-09, and BOTH were invisible for the same
// reason: the harness fixture contained only one value of a union.
//
//   1. `references()` was exported, tested, and rendered by NOTHING — you could
//      save a competitor's reel, press "Keep as reference", and never see it
//      again. The content fixture had no `bucket: 'reference'` row, so no
//      screenshot ever showed the hole.
//   2. `ProjectDocs` rendered content pieces as documents — "4 docs" for three
//      docs and a case study, and clicking one handed a content piece to the
//      DOCUMENT editor. The projects fixture had no `type: 'content'` row.
//
// The harness exists so a screen can be verified without a session. A screen
// can only be verified against data that exercises it. So: every value of a
// union that CHANGES WHAT A SCREEN RENDERS must appear in at least one fixture.
//
// This is the cheapest guard in the repo and it would have caught both.
const ROOT = join(__dirname);

function fixtures(): string {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const full = join(dir, e);
      if (statSync(full).isDirectory()) walk(full);
      else if (full.endsWith('.dev.tsx')) out.push(readFileSync(full, 'utf8'));
    }
  };
  walk(ROOT);
  return out.join('\n');
}

const ALL = fixtures();

/** Does any fixture set `key` to `value`? */
const covers = (key: string, value: string) =>
  new RegExp(`${key}:\\s*['"]${value}['"]`).test(ALL);

describe('the harness exercises every value a screen can branch on', () => {
  it('has fixtures at all', () => {
    expect(ALL.length).toBeGreaterThan(5000);
  });

  it.each([...BUCKETS])('a content fixture exists with bucket %s', (bucket) => {
    // `piece` is the DEFAULT — a row with no bucket is a piece — so it may be
    // covered implicitly. The other two must be explicit or their screens are
    // never seen: `inbox` is the triage pile, `reference` is the saved shelf
    // that went unrendered for weeks.
    if (bucket === 'piece') return;
    expect(covers('bucket', bucket), `no fixture has bucket: '${bucket}'`).toBe(true);
  });

  it.each(['doc', 'content', 'template'])('a page fixture exists with type %s', (type) => {
    // A `pages` row's type decides which module owns it (lib/page-kinds.ts).
    // A type with no fixture is a type whose screens nobody has looked at.
    expect(covers('type', type), `no fixture has type: '${type}'`).toBe(true);
  });

  it('covers the formats that change the pipeline shape', () => {
    // A format decides which stages exist (`stagesFor`). A board of only
    // videos never shows what a post-only board looks like — which is how
    // three dead columns went unnoticed.
    const missing = FORMATS.filter((f) => !covers('format', f));
    // Not every format needs a fixture, but the two SHAPES do: something
    // filmed, and something merely written.
    expect(FORMATS.some((f) => covers('format', f) && ['video', 'short', 'podcast'].includes(f)),
      'no filmed format in any fixture').toBe(true);
    expect(FORMATS.some((f) => covers('format', f) && ['post', 'carousel', 'article', 'newsletter'].includes(f)),
      'no written format in any fixture — the dead-column bug is invisible again').toBe(true);
    expect(missing.length, `formats with no fixture: ${missing.join(', ')}`).toBeLessThanOrEqual(3);
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { AUTOMATIONS, CLERK_MOMENTS, STATUS_LABEL, liveCount } from './automations';

const ROOT = join(__dirname, '..');

// §7P's promise is that the list of things Zenboard does behind your back is
// short, fixed, and WRITTEN DOWN. A written-down list only keeps that promise
// while it is true — and the version this replaced was not: it marked the
// morning digest "Planned" on the day it shipped, and omitted six behaviours
// that really do run.
//
// A page that documents the product cannot be checked by a type, so it is
// checked here instead.

describe('the automations list is about real code', () => {
  it('points every built behaviour at a file that exists', () => {
    // The weakest link in a doctrine page is a claim with nothing behind it.
    // Every `on` or `gated` entry names its implementation; this walks the
    // reference and fails if the file has moved or gone.
    const missing: string[] = [];
    for (const a of AUTOMATIONS) {
      if (a.status === 'planned') continue;
      for (const ref of a.source.split('·').map((x) => x.trim())) {
        // A bare directory reference (an API route) is checked as a directory.
        const candidates = [ref, `${ref}.ts`, `${ref}/route.ts`];
        if (!candidates.some((c) => existsSync(join(ROOT, c)))) missing.push(`${a.id}: ${ref}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('names a migration for every gated behaviour, and only those', () => {
    // "Ready" is a specific claim — built, waiting on one applied migration. An
    // entry that says `gated` without saying what it waits for cannot be acted
    // on, and one that names a migration while claiming to be on is confused.
    for (const a of AUTOMATIONS) {
      if (a.status === 'gated') expect(a.needs, a.id).toMatch(/^\d{4}$/);
      else expect(a.needs, a.id).toBeUndefined();
    }
  });

  it('keeps the migration files it points at', () => {
    for (const a of AUTOMATIONS.filter((x) => x.needs)) {
      const found = readFileSync(join(ROOT, 'supabase/migrations', listing(a.needs!)), 'utf8');
      expect(found.length, a.id).toBeGreaterThan(0);
    }
  });

  it('has a unique id per behaviour', () => {
    expect(new Set(AUTOMATIONS.map((a) => a.id)).size).toBe(AUTOMATIONS.length);
  });

  it('writes triggers in the user\'s words, not in events', () => {
    // "When you complete one", never "on task.update". §7P's whole argument is
    // that automation becomes a haunted house the moment it is described in
    // the vocabulary of the system rather than of the person.
    for (const a of AUTOMATIONS) {
      expect(a.trigger, a.id).toMatch(/^(When|At|Once)\b/);
      expect(a.trigger, a.id).not.toMatch(/\.(created|updated|deleted)|on [a-z]+\./);
    }
  });

  it('counts what is actually running', () => {
    expect(liveCount()).toBe(AUTOMATIONS.filter((a) => a.status === 'on').length);
    expect(liveCount()).toBeGreaterThan(0);
  });

  it('keeps the clerk separate from the designed behaviours', () => {
    // §7P (designed behaviours, no rule builder) and §7Q (the clerk) are
    // different doctrines. Merging them is how the previous version came to
    // list four AI moments under an "Automations" heading and nothing else.
    const titles = new Set(AUTOMATIONS.map((a) => a.title));
    for (const m of CLERK_MOMENTS) expect(titles.has(m.title)).toBe(false);
  });

  it('labels all three statuses', () => {
    for (const s of ['on', 'gated', 'planned'] as const) expect(STATUS_LABEL[s]).toBeTruthy();
  });
});

/** The migration filename for a number like "0031". */
function listing(num: string): string {
  const f = readdirSync(join(ROOT, 'supabase/migrations')).find((n) => n.startsWith(`${num}_`));
  if (!f) throw new Error(`no migration ${num}`);
  return f;
}

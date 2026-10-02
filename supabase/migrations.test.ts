import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// ── THE MIGRATION QUEUE IS AN INSTRUCTION, SO IT HAS TO BE UNAMBIGUOUS ───────
//
// This project has no migration runner. The user applies DDL BY HAND, in order, by pasting each
// file into Supabase's SQL editor ([[zenboard-pending-migrations]]) — so this directory is not a
// set of files, it is a numbered list of instructions to a person.
//
// On 2026-09-30 it held TWO files numbered 0044: `0044_message_reactions.sql` (chat's reactions,
// written 09-25) and `0044_ask_conversations.sql` (Ask's history, written 09-29). Nothing broke,
// which is the point — the failure of an ambiguous instruction is not an error, it is somebody
// running one file, recording "0044 applied", and the other one never being run at all. Ask's was
// renumbered 0049.
//
// A name is the only record of what has been applied here, so a name that cannot be read two ways
// is the whole of the safety. That is what this file checks, and it is checked mechanically because
// two people writing migrations in the same week cannot see each other's drafts.
const DIR = join(__dirname, 'migrations');
const NAME = /^(\d{4})_[a-z0-9_]+\.sql$/;

/**
 * A rollback SHARES its migration's number, on purpose — `0028_rows_are_pages_rollback.sql` is the
 * undo for `0028_rows_are_pages.sql`, not a second thing to run. It is not a queue entry at all,
 * so it is neither a collision nor allowed to fill a gap; the suffix is what says which it is.
 *
 * Named as a suffix rather than by listing the one file that has it: the next rollback should
 * inherit the exemption by being called what this one is called.
 */
const ROLLBACK = /_rollback\.sql$/;

const files = readdirSync(DIR).filter((f) => f.endsWith('.sql') && !ROLLBACK.test(f)).sort();

describe('supabase/migrations', () => {
  it('has migrations to check', () => {
    // A guard that silently passes on an empty list is not a guard. If the directory is ever moved,
    // this is the assertion that says so instead of everything below quietly agreeing.
    expect(files.length).toBeGreaterThan(40);
  });

  it('names every file `NNNN_lower_snake.sql`', () => {
    expect(files.filter((f) => !NAME.test(f))).toEqual([]);
  });

  // THE ONE THIS FILE EXISTS FOR.
  it('gives every migration its own number', () => {
    const byNumber = new Map<string, string[]>();
    for (const f of files) {
      const n = NAME.exec(f)?.[1];
      if (!n) continue;
      byNumber.set(n, [...(byNumber.get(n) ?? []), f]);
    }

    const collisions = [...byNumber].filter(([, names]) => names.length > 1);
    expect(collisions.map(([n, names]) => `${n}: ${names.join(' · ')}`)).toEqual([]);
  });

  // A gap is not dangerous the way a collision is — nothing is lost, and a number that was drafted
  // and abandoned leaves one. But a gap IS how a collision usually starts: the next person counts
  // the files instead of reading the last name. Failing on it keeps the list countable.
  it('leaves no gap in the sequence', () => {
    const numbers = files.map((f) => Number(NAME.exec(f)?.[1])).filter(Number.isFinite).sort((a, b) => a - b);
    const missing = [];
    for (let n = numbers[0]; n < numbers[numbers.length - 1]; n += 1) {
      if (!numbers.includes(n)) missing.push(String(n).padStart(4, '0'));
    }
    expect(missing).toEqual([]);
  });
});

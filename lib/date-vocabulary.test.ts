import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// `lib/date.ts` opens by explaining that `toLocaleDateString` was once called at
// 31 sites and that the vocabulary exists to stop it. It stopped it once. By
// 2026-08-05 nineteen call sites had drifted back out — four hand-rolled copies
// of `formatAgo`, two of `formatDay` (one reproducing its drop-the-year rule
// exactly), and a `fmtDate` in Finance rendering "Sep 4" beside Tasks' "4 Sep".
//
// A rule enforced by a comment is enforced once. This is the same rule as a
// test, so the file's opening paragraph stays true.
//
// The stakes are not only consistency: a `'use client'` component is
// server-rendered first, so any ambient-locale call renders one string on the
// server and another in the browser — a hydration error on every page carrying
// a date, which is exactly how this was found.

const ROOT = join(__dirname, '..');
const SKIP = new Set(['node_modules', '.next', '.open-next', '.git', 'out', 'build']);

/**
 * The allowed exceptions, each with the reason it is not a display string.
 * An entry here is a claim that the call does not render a date to a person.
 */
const ALLOWED: Record<string, string> = {
  // THE vocabulary itself. This is the one file allowed to call Intl directly.
  'lib/date.ts': 'the vocabulary',
  // Money has its own formatter for the same reasons, and its own rules.
  'lib/money.ts': 'the money vocabulary',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

interface Offence { file: string; line: number; code: string }

/**
 * Prose is not code. Blanking comments — rather than dropping the lines — keeps
 * every line number pointing at the real file. Without this the scan reports
 * the comment that *explains* a rule as a violation of it, which is how a
 * codebase loses the ability to describe its own history.
 */
function codeOnly(src: string): string[] {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'));
}

function findOffences(pattern: RegExp): Offence[] {
  const out: Offence[] = [];
  for (const file of walk(ROOT)) {
    const rel = file.slice(ROOT.length + 1);
    if (ALLOWED[rel]) continue;
    codeOnly(readFileSync(file, 'utf8')).forEach((code, i) => {
      if (pattern.test(code)) out.push({ file: rel, line: i + 1, code: code.trim().slice(0, 110) });
    });
  }
  return out;
}

const show = (o: Offence[]) => o.map((x) => `${x.file}:${x.line}  ${x.code}`);

describe('the date vocabulary is the only way to render a date', () => {
  it('finds source files at all (guards the scan)', () => {
    expect(walk(ROOT).length).toBeGreaterThan(100);
  });

  it('has no toLocaleDateString / toLocaleTimeString outside lib/date.ts', () => {
    expect(show(findOffences(/\.toLocale(?:Date|Time)String\s*\(/))).toEqual([]);
  });

  it('has no Intl.DateTimeFormat used to FORMAT a date either', () => {
    // The hole this closes: `new Intl.DateTimeFormat(undefined, …).format(d)`
    // is the same thing as `toLocaleDateString`, and the rule above could not
    // see it. Four of them were sitting in the DS date-picker, so a date typed
    // into the picker read "Sep 4" while the same date in a task row read
    // "4 Sep".
    //
    // Reading the runtime's own settings is NOT formatting —
    // `Intl.DateTimeFormat().resolvedOptions().timeZone` is how a browser
    // reports where it is, which <TimezoneSync> legitimately needs. So this
    // matches construction that is not immediately followed by resolvedOptions.
    const offences = findOffences(/Intl\.DateTimeFormat\s*\((?![^)]*\)\s*\.resolvedOptions)/)
      .filter((o) => !/resolvedOptions/.test(o.code));
    expect(show(offences)).toEqual([]);
  });

  it('keeps every allowed exception honest', () => {
    // If an exemption's file stops calling Intl, the exemption should go too —
    // otherwise this list slowly becomes a place to hide things.
    for (const [rel, why] of Object.entries(ALLOWED)) {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      expect(/toLocale(?:Date|Time)?String\s*\(/.test(src), `${rel} no longer needs its exemption (${why})`).toBe(true);
    }
  });

  it('has no hand-rolled 12-hour clock', () => {
    // `schedule-section` carried one — `9:00 – 9:30pm`, meridiem on the end only,
    // written "like the HiFi" before the house clock was pinned to 24-hour
    // (`CLOCK = 'en-GB'`). The result was the same event reading "13:30" in the
    // time picker directly above it and on the calendar beside it, and "1:30pm"
    // in the list. It slipped past every check here because it never called
    // `toLocaleTimeString` — it did the arithmetic itself.
    //
    // The signature: converting to a 12-hour hand with `% 12`, or picking a
    // meridiem off `getHours()`. `formatClock` / `formatClockRange` are this.
    const offences = findOffences(/getHours\(\)\s*%\s*12|getHours\(\)\s*<\s*12\s*\?/);
    expect(show(offences)).toEqual([]);
  });

  it('has no hand-rolled relative-time ladder', () => {
    // The shape of all four copies that existed: a chain of thresholds ending
    // in a raw date. `formatAgo(v, { precise: true })` is this, once.
    const offences = findOffences(/return\s+['"`]just now['"`]/);
    expect(show(offences)).toEqual([]);
  });

  it('has no hand-rolled minutes→"1h 30m" formatter', () => {
    // SIX copies of this existed on 2026-08-05 — tasks/task-row (exported),
    // calendar/task-rail, week/week-view, task-detail/task-detail-drawer,
    // money/money-view (also exported) and rituals/ritual-flow — and they
    // disagreed: three rendered a negative estimate as "-30m", and the drawer's
    // returned null. A duration in minutes is a number a person READS, so it
    // belongs to the vocabulary exactly as a date does; it simply had no entry
    // here, which is why everyone wrote their own.
    //
    // The signature of every copy: dividing by 60 inside a template literal to
    // build an "h" part. That is deliberately narrower than "any division by
    // 60" — `lib/text-stats.ts` spells its own reading-time duration out as
    // "1 hr 5 min", which is a different vocabulary entry for a different
    // reader, and it already lives in lib/ rather than in a component. What
    // this catches is a COMPONENT doing hour arithmetic, which is how all seven
    // copies started.
    const offences = findOffences(/Math\.floor\(\s*\w+\s*\/\s*60\s*\)\s*\}?\s*h/);
    expect(show(offences)).toEqual([]);
  });
});

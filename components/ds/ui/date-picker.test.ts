import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The sibling of time-picker.test.ts, and the same defect one axis over: a raw
// <input type="date"> renders the BROWSER's calendar, formatted to the OS
// locale, out of shadow DOM our CSS cannot reach. There were THIRTEEN of them
// against six uses of the DS picker — so the app's most common way to pick a
// date was not the app's.
//
// Three of the thirteen went further and hid a native input UNDER our own UI —
// `opacity-0` stretched over a chip, a grid cell and a triage button — which is
// why <DatePicker> now takes a `trigger`: the need was real and four screens
// had each invented the same workaround for it.

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (/\.tsx$/.test(path)) out.push(path);
  }
  return out;
}

/** Blank comments rather than dropping them, so line numbers stay honest. */
const code = (file: string) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => (l.trim().startsWith('//') || l.trim().startsWith('*') ? '' : l));

const files = walk('components').concat(walk('app')).filter((f) => !f.endsWith('.test.tsx'));

describe('one date picker', () => {
  it('nobody ships a native date input', () => {
    const offenders: string[] = [];
    for (const file of files) {
      code(file).forEach((line, i) => {
        if (/type=["']date["']/.test(line)) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('there is only one date picker to import', () => {
    const pickers = walk('components').filter((f) => /date-picker\.tsx$/.test(f));
    expect(pickers).toEqual(['components/ds/ui/date-picker.tsx']);
  });

  it('nobody re-derives Date → YYYY-MM-DD', () => {
    // FOUR copies existed: lib/date's `isoDateIn`, lib/calendar's
    // `localISODate`, and a private `dateToISO` each in projects-workspace and
    // new-project-modal. Two of them only existed to talk to <DatePicker>, which
    // speaks ISO strings now. The remaining risk is the UTC-date trap this
    // codebase has already paid for: `toISOString()` on a local Date names the
    // previous day for anyone west of UTC.
    const offenders: string[] = [];
    for (const file of walk('components')) {
      code(file).forEach((line, i) => {
        if (/const\s+\w*[dD]ateToISO\s*=/.test(line)) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('scanned a believable number of files', () => {
    expect(files.length).toBeGreaterThan(50);
  });
});

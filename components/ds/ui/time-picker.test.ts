import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseTime, parseDuration } from './time-picker';

// ── The parser, which is what makes this a FIELD and not just a list ────────
// A list-only picker means a keyboard user scrolls to 14:45. Typing has to work,
// and it has to accept what people actually type.
describe('parseTime', () => {
  it('takes the four shapes the field advertises', () => {
    expect(parseTime('15:30')).toBe(15 * 60 + 30);
    expect(parseTime('3pm')).toBe(15 * 60);
    expect(parseTime('9')).toBe(9 * 60);
    expect(parseTime('9:05am')).toBe(9 * 60 + 5);
  });

  it('handles the two midnights, which is where 12-hour clocks break', () => {
    expect(parseTime('12am')).toBe(0);
    expect(parseTime('12pm')).toBe(12 * 60);
    expect(parseTime('12:30am')).toBe(30);
  });

  it('is forgiving about spacing and case', () => {
    expect(parseTime('  3 PM ')).toBe(15 * 60);
    expect(parseTime('9:05 Am')).toBe(9 * 60 + 5);
  });

  it('refuses what is not a time, rather than guessing', () => {
    // A wrong guess here silently reschedules something.
    for (const bad of ['', 'lunch', '25:00', '10:60', '13pm', '0pm', '3:5x']) {
      expect(parseTime(bad)).toBeNull();
    }
  });
});

describe('parseDuration', () => {
  it('takes minutes, h:mm, decimal hours and "1h 30m"', () => {
    expect(parseDuration('90')).toBe(90);
    expect(parseDuration('1:30')).toBe(90);
    expect(parseDuration('1.5h')).toBe(90);
    expect(parseDuration('1h 30m')).toBe(90);
  });
  it('refuses nonsense', () => {
    expect(parseDuration('soon')).toBeNull();
  });
});

// ── The system rule ────────────────────────────────────────────────────────
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

describe('one time picker', () => {
  it('nobody ships a native time input', () => {
    // This is the bug that started it: a raw <input type="time"> renders the
    // BROWSER's picker — three columns, hard blue selection, `--:--` empty state
    // — out of UA shadow DOM our CSS cannot reach, formatted to the OS locale.
    // It appeared on Home's Schedule, in Settings (×3), in Content and in
    // Onboarding, so the most-seen time control in Zenboard was not Zenboard's
    // and could not be made to be. There is nothing to restyle here; the rule is
    // simply that the DS component is the only way to ask for a time.
    const offenders: string[] = [];
    for (const file of walk('components').concat(walk('app'))) {
      code(file).forEach((line, i) => {
        if (/type=["']time["']/.test(line)) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('there is only one time picker to import', () => {
    // Two custom pickers existed alongside the native inputs: this one (with
    // zero importers) and components/calendar/time-picker.tsx (with one). Two
    // implementations do not stay alike — they had already diverged on chrome,
    // on selected state, on numerals and on positioning.
    const pickers = walk('components').filter((f) => /time-picker\.tsx$/.test(f));
    expect(pickers).toEqual(['components/ds/ui/time-picker.tsx']);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as chrono from 'chrono-node';
import { createNaturalDate, parseNaturalDate } from './natural-date';

// Tuesday 15 September 2026, 10:00 local.
const REF = new Date(2026, 8, 15, 10, 0);

describe('parseNaturalDate', () => {
  it('reads what people type, relative to when they typed it', async () => {
    const d = await parseNaturalDate('tomorrow', REF);
    expect(d && [d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 8, 16]);
  });

  it('keeps forwardDate: an hour already gone today means tomorrow', async () => {
    const d = await parseNaturalDate('8am', REF, { forwardDate: true });
    expect(d && [d.getDate(), d.getHours()]).toEqual([16, 8]);
  });

  it('returns null for text that is not a date', async () => {
    expect(await parseNaturalDate('banana', REF)).toBeNull();
  });
});

describe('createNaturalDate', () => {
  it('loads the parser once, then hands it over synchronously', async () => {
    const load = vi.fn(async () => chrono);
    const nd = createNaturalDate(load);
    expect(nd.naturalDateParser()).toBeNull();
    await nd.loadNaturalDate();
    expect(nd.naturalDateParser()).toBe(chrono);
    await nd.parseNaturalDate('tomorrow', REF);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('retries after a failed load instead of failing for the rest of the visit', async () => {
    const load = vi.fn<() => Promise<typeof chrono>>()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValue(chrono);
    const nd = createNaturalDate(load);
    expect(await nd.parseNaturalDate('tomorrow', REF)).toBeNull();
    expect(await nd.parseNaturalDate('tomorrow', REF)).toBeInstanceOf(Date);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('chrono-node stays out of first-load JavaScript', () => {
  // A static import puts ~78 KB on every screen that can show a date field, and
  // nothing fails when that happens, so it is guarded here.
  const ROOT = join(__dirname, '..');
  const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((e) => {
      if (e === 'node_modules' || e.startsWith('.')) return [];
      const full = join(dir, e);
      if (statSync(full).isDirectory()) return sources(full);
      return /\.tsx?$/.test(e) && !/\.test\./.test(e) ? [full] : [];
    });

  it('is imported only by lib/natural-date.ts, and only dynamically', () => {
    const own = join(__dirname, 'natural-date.ts');
    const offenders = ['app', 'components', 'lib']
      .flatMap((d) => sources(join(ROOT, d)))
      .filter((f) => f !== own && /from\s+['"]chrono-node['"]|import\(\s*['"]chrono-node['"]\s*\)|require\(\s*['"]chrono-node['"]\s*\)/.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => f.slice(ROOT.length + 1))).toEqual([]);

    const src = readFileSync(own, 'utf8');
    expect(src).toMatch(/import\(\s*['"]chrono-node['"]\s*\)/);
    expect(src).not.toMatch(/from\s+['"]chrono-node['"]/);
  });
});

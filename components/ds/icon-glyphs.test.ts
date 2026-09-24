import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Ph from '@phosphor-icons/react';
import * as Seam from './icons';
import { GLYPHS } from './icon-glyphs.generated';

// The icon seam draws from a generated two-weight table instead of shipping
// Phosphor's six-weight components (see the header of components/ds/icons.ts).
// That is only safe if NOTHING ON SCREEN MOVED — so every glyph is rendered
// both ways, with the exact props the DS <Icon> passes, and the markup must be
// byte-identical.

const ROOT = join(__dirname, '..', '..');
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
const seamSrc = strip(readFileSync(join(ROOT, 'components/ds/icons.ts'), 'utf8'));
const pickerStart = seamSrc.indexOf('export const PICKER_ICONS');
const pickerEnd = seamSrc.indexOf('\n};', pickerStart);

/** `export const Name = glyph("PhName")` — the interface glyphs. */
const exported = [...seamSrc.matchAll(/export const (\w+) = glyph\("(\w+)"\)/g)].map((m) => ({ name: m[1], ph: m[2] }));
/** `Key: glyph("PhName")` inside the picker catalogue. */
const picker = [...seamSrc.slice(pickerStart, pickerEnd).matchAll(/(\w+): glyph\("(\w+)"\)/g)].map((m) => ({ key: m[1], ph: m[2] }));

type AnyIcon = React.ComponentType<Record<string, unknown>>;
const ph = (name: string) => (Ph as unknown as Record<string, AnyIcon>)[name];
const seamIcon = (name: string) => (Seam as unknown as Record<string, AnyIcon>)[name];
const html = (C: AnyIcon, props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(C, props));

// What the DS <Icon> hands a glyph: see components/ds/ui/icon.tsx.
const DS = { size: 16, strokeWidth: 1.75, className: 'shrink-0', 'aria-hidden': true };

describe('the generated table and the seam agree', () => {
  it('found the glyphs — the scan is not reading an empty file', () => {
    expect(exported.length).toBeGreaterThan(150);
    expect(picker.length).toBeGreaterThan(100);
  });

  it('has an entry for every glyph the seam asks for, and nothing it does not', () => {
    const asked = new Set([...exported.map((e) => e.ph), ...picker.map((p) => p.ph)]);
    for (const n of asked) expect(GLYPHS[n], `${n} missing — run node scripts/gen-icon-glyphs.mjs`).toBeDefined();
    for (const n of Object.keys(GLYPHS)) expect(asked.has(n), `${n} is dead data in the table`).toBe(true);
  });

  it('carries the fill weight exactly where the interface can ask for it', () => {
    const iface = new Set(exported.map((e) => e.ph));
    for (const [n, def] of Object.entries(GLYPHS)) {
      expect(!!def.f, `${n}: fill ${def.f ? 'present but never drawn' : 'missing but drawn'}`).toBe(iface.has(n));
    }
  });
});

describe('every glyph draws exactly what Phosphor drew', () => {
  it('interface glyphs, regular weight', () => {
    for (const { name, ph: p } of exported) {
      const ours = html(seamIcon(name), { ...DS, fill: 'none' });
      const theirs = html(ph(p), { size: 16, className: 'shrink-0', 'aria-hidden': true, weight: 'regular' });
      expect(ours, name).toBe(theirs);
    }
  });

  it('interface glyphs, fill weight — the selected nav row and every weight="fill"', () => {
    for (const { name, ph: p } of exported) {
      const ours = html(seamIcon(name), { ...DS, fill: 'currentColor' });
      const theirs = html(ph(p), { size: 16, className: 'shrink-0', 'aria-hidden': true, weight: 'fill' });
      expect(ours, name).toBe(theirs);
    }
  });

  it('picker glyphs, as a stored record icon is drawn', () => {
    for (const { key, ph: p } of picker) {
      const ours = html(Seam.PICKER_ICONS[key] as AnyIcon, { ...DS, fill: 'none' });
      const theirs = html(ph(p), { size: 16, className: 'shrink-0', 'aria-hidden': true, weight: 'regular' });
      expect(ours, key).toBe(theirs);
    }
  });

  it('keeps Phosphor’s defaults when a caller passes nothing', () => {
    // A glyph rendered bare (outside <Icon>) must still be 1em and inherit colour.
    const [{ name, ph: p }] = exported;
    expect(html(seamIcon(name), {})).toBe(html(ph(p), {}));
    expect(html(seamIcon(name), { color: 'red' })).toBe(html(ph(p), { color: 'red' }));
  });
});

describe('the six-weight components never ship again', () => {
  it('no runtime module imports the icon package', () => {
    // The generator (scripts/) reads it at dev time and this test compares
    // against it; nothing that reaches a bundle may.
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir)) {
        if (['node_modules', '.next', '.open-next'].includes(e)) continue;
        const full = join(dir, e);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx|js|mjs)$/.test(e) && !/\.test\./.test(e) && /['"]@phosphor-icons\//.test(readFileSync(full, 'utf8'))) {
          offenders.push(full.slice(ROOT.length + 1));
        }
      }
    };
    for (const d of ['app', 'components', 'lib']) walk(join(ROOT, d));
    expect(offenders).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// ── ONE OPTICAL SCALE ──────────────────────────────────────────────────────
//
// Zenboard carries TWO type-token families: the Tailwind-v4 pairs in `ds-theme.css`
// (`--text-ui--letter-spacing`) and the role tokens in `globals.css` (`--text-h1-tracking`).
// They overlap at the same pixel sizes, and on 2026-09-24 they DISAGREED there — measured in the
// browser:
//
//   12px  `caption` +0.02em   vs  `meta` normal
//   16px  `editor` −0.0144em  vs  `lead` normal
//   24px  `title-2` normal    vs  its neighbours at −0.018
//   30px  `title-1` −0.0143em vs  `h1` −0.01em
//
// Same size, different letter-spacing depending on which class a component happened to use. That
// is what makes an interface look like several hands built it, and no screenshot review finds it.
// Tracking is a function of SIZE — one curve, both families.

const ds = readFileSync('app/ds-theme.css', 'utf8');
const globals = readFileSync('app/globals.css', 'utf8');

/** Letter-spacing in em, whatever unit it was written in. */
function toEm(value: string, sizePx: number): number | null {
  const v = value.trim();
  if (v === 'normal') return 0;
  if (v.endsWith('em')) return parseFloat(v);
  if (v.endsWith('px')) return parseFloat(v) / sizePx;
  if (parseFloat(v) === 0) return 0;
  return null;
}

type Role = { name: string; size: number; em: number; source: string };

function rolesFromDsTheme(): Role[] {
  const out: Role[] = [];
  for (const m of ds.matchAll(/--text-([a-z0-9-]+):\s*(\d+(?:\.\d+)?)px;/g)) {
    const [, name, size] = m;
    const ls = new RegExp(`--text-${name}--letter-spacing:\\s*([^;]+);`).exec(ds)?.[1];
    if (!ls) continue;
    const em = toEm(ls, Number(size));
    if (em !== null) out.push({ name, size: Number(size), em, source: 'ds-theme.css' });
  }
  return out;
}

function rolesFromGlobals(): Role[] {
  const out: Role[] = [];
  for (const m of globals.matchAll(/--text-([a-z0-9-]+)-size:\s*(\d+(?:\.\d+)?)px;/g)) {
    const [, name, size] = m;
    const ls = new RegExp(`--text-${name}-tracking:\\s*([^;]+);`).exec(globals)?.[1];
    if (!ls) continue;
    const em = toEm(ls, Number(size));
    if (em !== null) out.push({ name, size: Number(size), em, source: 'globals.css' });
  }
  return out;
}

// Roles that are SMALL CAPS by design — a label, a badge, a 10px stamp. Capitals need the air;
// this is the tracking CLAUDE.md kept when it dropped the rest (2026-09-08).
const CAPS_ROLES = new Set(['label', 'micro', 'nano']);
// Monospace sets its own advance; tracking it fights the grid.
const MONO_ROLES = new Set(['mono-sm', 'mono-md', 'code']);

const roles = [...rolesFromDsTheme(), ...rolesFromGlobals()].filter((r) => !CAPS_ROLES.has(r.name));

describe('the optical scale', () => {
  it('reads both token families', () => {
    expect(roles.length, 'roles parsed').toBeGreaterThan(10);
    expect(roles.some((r) => r.source === 'ds-theme.css')).toBe(true);
    expect(roles.some((r) => r.source === 'globals.css')).toBe(true);
  });

  it('gives every role at one size the same tracking', () => {
    const bySize = new Map<number, Role[]>();
    for (const r of roles.filter((x) => !MONO_ROLES.has(x.name))) {
      bySize.set(r.size, [...(bySize.get(r.size) ?? []), r]);
    }
    // The two files express the SAME curve in different units (px there, em here), so a rounding
    // difference of half a thousandth of an em — 0.007px at 14px — is the same decision written
    // twice, not a disagreement. Anything larger is.
    const SAME = 0.0005;
    const disagreements = [...bySize.entries()]
      .filter(([, rs]) => Math.max(...rs.map((r) => r.em)) - Math.min(...rs.map((r) => r.em)) > SAME)
      .map(([size, rs]) => `${size}px: ${rs.map((r) => `${r.name} ${r.em.toFixed(4)}em`).join(' vs ')}`);
    expect(disagreements, 'one size, one tracking').toEqual([]);
  });

  it('tightens as it grows, and never loosens', () => {
    // Optical sizing: the bigger the type, the tighter it sets. A role that loosens as it grows
    // is the tell that it was typed rather than derived.
    const sizes = [...new Set(roles.filter((r) => !MONO_ROLES.has(r.name)).map((r) => r.size))].sort((a, b) => a - b);
    const em = (s: number) => roles.find((r) => r.size === s && !MONO_ROLES.has(r.name))!.em;
    for (let i = 1; i < sizes.length; i++) {
      expect(em(sizes[i]), `${sizes[i]}px vs ${sizes[i - 1]}px`).toBeLessThanOrEqual(em(sizes[i - 1]) + 1e-9);
    }
  });

  it('never spaces body text out', () => {
    // Positive tracking on running text is the capitals era. 12px `caption` carried +0.02em —
    // on a size that renders as sentence-case meta everywhere in the app.
    for (const r of roles.filter((x) => x.size >= 12)) {
      expect(r.em, `${r.name} (${r.size}px)`).toBeLessThanOrEqual(0);
    }
  });

  it('sets the biggest type tightest', () => {
    const biggest = roles.reduce((a, b) => (b.size > a.size ? b : a));
    expect(biggest.em, `${biggest.name} at ${biggest.size}px`).toBeLessThanOrEqual(-0.02);
  });
});

describe('the specular edge', () => {
  it('exists in both themes, and is a SHADOW in both', () => {
    // `none` inside a box-shadow list invalidates the whole declaration — a light theme that
    // wrote `--edge-light: none` would silently lose every shadow that composes it.
    const dark = /--edge-light:\s*([^;]+);/.exec(globals)?.[1]?.trim();
    const light = /--edge-light:\s*([^;]+);/.exec(readFileSync('app/tokens-light.css', 'utf8'))?.[1]?.trim();
    expect(dark).toMatch(/^inset 0 1px 0 0 rgb\(255 255 255 \/ 0\.04\d?\)$/);
    expect(light, 'a pale surface catches no highlight — but it must still be a shadow').toBe('inset 0 0 0 0 transparent');
    expect(light).not.toBe('none');
  });

  it('is carried by the surfaces that are made of something', () => {
    expect(globals).toMatch(/--shadow-md:[^;]*var\(--edge-light\)/);
    expect(globals).toMatch(/--shadow-panel:[^;]*var\(--edge-light\)/);
    expect(ds).toMatch(/@utility surface-edge \{\s*box-shadow: var\(--edge-light\);/);
    expect(readFileSync('components/ds/ui/card.tsx', 'utf8')).toMatch(/CARD_CLASS = "[^"]*surface-edge"/);
  });
});

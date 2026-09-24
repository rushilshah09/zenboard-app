import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { join } from 'node:path';
import { tempId, isTempId, mintUuid } from './temp-id';

describe('tempId', () => {
  // THE BUG. Every call site used to be `'tmp-' + Date.now()`, which is unique
  // only per millisecond — and these ids are React keys. Two optimistic rows
  // created in the same tick (a loop, a fast double-click, two composers
  // submitted together) collided, so React reconciled one row onto the other's
  // DOM node and the server's reply replaced the wrong one.
  it('is unique even when a thousand are minted in the same millisecond', () => {
    const ids = Array.from({ length: 1000 }, () => tempId());
    expect(new Set(ids).size).toBe(1000);
  });

  it('is recognisable as temporary, which is what the prefix is for', () => {
    expect(isTempId(tempId())).toBe(true);
  });

  it('does not mistake a real id for a temporary one', () => {
    // A server id is a uuid; nothing about it starts with the prefix.
    for (const real of ['9f8b1c2d-0000-4a1b-8c3d-1e2f3a4b5c6d', 'INV-001', 'temporary', 'tmp', '']) {
      expect(isTempId(real), real).toBe(false);
    }
  });

  it('tolerates the absent id, because callers hold nullable ids', () => {
    expect(isTempId(null)).toBe(false);
    expect(isTempId(undefined)).toBe(false);
  });
});

describe('mintUuid', () => {
  // An id the server keeps, minted before the server is asked — so a database
  // block holds its collection id from the first frame. Postgres rejects anything
  // that is not a uuid, so the shape IS the contract.
  const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it('is a version-4 uuid, and never mistaken for a temporary id', () => {
    const id = mintUuid();
    expect(id).toMatch(V4);
    expect(isTempId(id)).toBe(false);
  });

  it('keeps that shape where randomUUID does not exist (plain http on a LAN address)', () => {
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => webcrypto.getRandomValues(a) });
    try {
      expect(typeof crypto.randomUUID).toBe('undefined');
      const ids = Array.from({ length: 200 }, () => mintUuid());
      for (const id of ids) expect(id).toMatch(V4);
      expect(new Set(ids).size).toBe(200);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// The prefix is load-bearing: twelve call sites use it to decide whether an id
// may be sent to the server. That decision should read as a question, not as a
// string comparison repeated from memory.
describe('the convention has one home', () => {
  const ROOT = join(__dirname, '..');
  const SKIP = new Set(['node_modules', '.next', '.open-next', '.git', 'out', 'build']);

  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      if (SKIP.has(name)) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p);
    }
    return out;
  }

  const files = walk(ROOT).filter((f) => !f.endsWith(join('lib', 'temp-id.ts')));

  it('finds source files at all (guards the scan)', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('nobody mints a temp id by hand', () => {
    const offences: string[] = [];
    for (const f of files) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (/['"`]tmp-?['"`]?\s*\+\s*Date\.now\(\)|`tmp-\$\{Date\.now\(\)\}`/.test(line)) {
          offences.push(`${f.slice(ROOT.length + 1)}:${i + 1}  ${line.trim().slice(0, 90)}`);
        }
      });
    }
    expect(offences).toEqual([]);
  });

  it('nobody asks "is this saved yet?" with a string comparison', () => {
    const offences: string[] = [];
    for (const f of files) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (/\.startsWith\(\s*['"`]tmp-['"`]\s*\)/.test(line)) {
          offences.push(`${f.slice(ROOT.length + 1)}:${i + 1}  ${line.trim().slice(0, 90)}`);
        }
      });
    }
    expect(offences).toEqual([]);
  });
});

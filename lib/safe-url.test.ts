import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { safeHref, safeEmbedSrc, safeNextPath, EMBED_SANDBOX } from './safe-url';

describe('safeNextPath — where a person goes after signing in', () => {
  it('keeps a path on this site, query and fragment included', () => {
    expect(safeNextPath('/projects/abc')).toBe('/projects/abc');
    expect(safeNextPath('/tasks?task=1&view=week')).toBe('/tasks?task=1&view=week');
    expect(safeNextPath('/documents?page=9#block-2')).toBe('/documents?page=9#block-2');
  });

  it('falls back when there is nothing to go to', () => {
    for (const v of [null, undefined, '', '   ', 42, {}]) expect(safeNextPath(v)).toBe('/today');
    expect(safeNextPath(null, '/onboarding')).toBe('/onboarding');
  });

  // THE open redirect. Every one of these is a real phishing-kit spelling.
  it('never leaves the site', () => {
    for (const evil of [
      'https://evil.example/login',
      'http://evil.example',
      '//evil.example/path',          // protocol-relative: absolute, off-origin
      '/\\evil.example',               // browsers treat a backslash as a slash
      '\\\\evil.example',
      ' //evil.example',              // leading whitespace
      '/\t/evil.example',             // a tab the browser ignores when resolving
      'javascript:alert(document.cookie)',
      'java\tscript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'evil.example',                 // no slash at all
      // Dot segments that NORMALISE to `//evil.example` — they pass any check
      // made on the input alone, which is how the first version let them by.
      '/.//evil.example',
      '/x/..//evil.example',
      '/./\\evil.example',
    ]) {
      const out = safeNextPath(evil);
      expect(out, evil).toBe('/today');
    }
  });

  it('is what the login page redirects through, and the page renders without the query hook', () => {
    const login = readFileSync('app/login/page.tsx', 'utf8').replace(/\/\/.*$/gm, '');
    expect(login).toMatch(/safeNextPath\(raw\)/);
    // `useSearchParams` in a statically built page bails the whole screen out
    // to client rendering — production served an empty canvas.
    expect(login).not.toMatch(/useSearchParams/);
    expect(login).not.toMatch(/<Suspense/);
  });
});

describe('safeHref', () => {
  it('passes the schemes a click may follow', () => {
    expect(safeHref('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(safeHref('http://example.com/')).toBe('http://example.com/');
    expect(safeHref('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(safeHref('tel:+15551234')).toBe('tel:+15551234');
  });

  // An internal mention IS a link (lib/connected.ts recordHref).
  it('passes an internal route and an in-page anchor', () => {
    expect(safeHref('/projects/abc')).toBe('/projects/abc');
    expect(safeHref('/tasks?task=1')).toBe('/tasks?task=1');
    expect(safeHref('#block-9')).toBe('#block-9');
  });

  // The whole point: this runs script in OUR origin with the reader's session,
  // and the reader is often a client looking at a shared doc.
  it('refuses script-bearing schemes', () => {
    for (const bad of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      '  javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
    ]) expect(safeHref(bad)).toBeNull();
  });

  // Hidden with a control character — the oldest trick against a prefix check.
  it('refuses a scheme split by a control character', () => {
    expect(safeHref('java\tscript:alert(1)')).toBeNull();
    expect(safeHref('java\u0000script:alert(1)')).toBeNull();
    expect(safeHref('\njavascript:alert(1)')).toBeNull();
  });

  // Looks like a path, behaves like an absolute off-origin URL.
  it('refuses a protocol-relative URL', () => {
    expect(safeHref('//evil.example/x')).toBeNull();
  });

  it('refuses junk', () => {
    for (const bad of ['', '   ', 'not a url', null, undefined, 42, {}]) expect(safeHref(bad)).toBeNull();
  });
});

describe('safeEmbedSrc', () => {
  it('is https only — a frame runs without a click', () => {
    expect(safeEmbedSrc('https://www.youtube.com/embed/x')).toBe('https://www.youtube.com/embed/x');
    expect(safeEmbedSrc('http://example.com/')).toBeNull();
    expect(safeEmbedSrc('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeEmbedSrc('javascript:alert(1)')).toBeNull();
    expect(safeEmbedSrc('/local/thing')).toBeNull();
  });
});

describe('EMBED_SANDBOX', () => {
  // An embed that can navigate the top frame can replace a client portal with a
  // lookalike. Nothing else in the token list is worth having without this.
  it('never grants top-level navigation', () => {
    expect(EMBED_SANDBOX).not.toContain('allow-top-navigation');
  });
  it('grants what a real embed needs', () => {
    for (const t of ['allow-scripts', 'allow-same-origin', 'allow-popups', 'allow-forms']) {
      expect(EMBED_SANDBOX).toContain(t);
    }
  });
});

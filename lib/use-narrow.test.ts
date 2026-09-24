import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// The one viewport hook. Two rules it must keep, pinned because each is the
// kind that erodes quietly: a hand-rolled effect copy creeps back, or someone
// "fixes" the server default and every page hydrates against the wrong layout.
const src = readFileSync('lib/use-narrow.ts', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

describe('useNarrow', () => {
  it('reads the viewport through a store, so a client-side mount is right on its first render', () => {
    expect(src).toMatch(/useSyncExternalStore\(subscribe, \(\) => window\.matchMedia\(query\)\.matches, SERVER_SNAPSHOT\)/);
    expect(src, 'not an effect that corrects after paint').not.toMatch(/useEffect/);
  });

  it('answers WIDE on the server, so hydration matches the server markup', () => {
    expect(src).toMatch(/const SERVER_SNAPSHOT = \(\) => false;/);
  });

  it('subscribes to resize as well as the media query — change alone misses emulated resizes', () => {
    expect(src).toMatch(/addEventListener\('resize', onChange\)/);
    expect(src).toMatch(/mq\.addEventListener\('change', onChange\)/);
  });

  it('keeps the subscription stable, or React would resubscribe on every render', () => {
    expect(src).toMatch(/useCallback\(\(onChange: \(\) => void\) => \{[\s\S]*\}, \[query\]\)/);
  });
});

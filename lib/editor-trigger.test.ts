import { describe, it, expect } from 'vitest';
import { triggerAt } from './editor-trigger';

// `@` as the block editor configures it; `/` uses the same function uncapped.
const at = (text: string, caret = text.length) => triggerAt(text, caret, '@', { maxQuery: 32 });

describe('triggerAt', () => {
  it('opens on the trigger at the start of a line', () => {
    expect(at('@')).toEqual({ at: 0, query: '' });
    expect(at('@acme')).toEqual({ at: 4 - 4, query: 'acme' });
  });

  it('opens mid-line after whitespace', () => {
    expect(at('ship @acme')).toEqual({ at: 5, query: 'acme' });
    expect(at('line\n@acme')).toEqual({ at: 5, query: 'acme' });
  });

  it('does not open mid-word — which is what keeps email addresses out', () => {
    expect(at('sarah@example.com')).toBeNull();
    expect(at('a@b')).toBeNull();
  });

  it('closes when whitespace immediately follows the trigger', () => {
    expect(at('email @ sarah')).toBeNull();
    expect(at('@ ')).toBeNull();
  });

  it('keeps spaces INSIDE the query — record titles have them', () => {
    expect(at('see @Acme rebrand')).toEqual({ at: 4, query: 'Acme rebrand' });
  });

  it('closes past the query cap, so a stray @ cannot hold a menu open', () => {
    const long = '@' + 'x'.repeat(32);
    expect(at(long)).toEqual({ at: 0, query: 'x'.repeat(32) });
    expect(at('@' + 'x'.repeat(33))).toBeNull();
  });

  it('closes across a line break', () => {
    expect(at('@acme\nnext', 10)).toBeNull();
  });

  it('reads the query up to the CARET, not the end of the text', () => {
    expect(at('@acme rebrand', 5)).toEqual({ at: 0, query: 'acme' });
    // Caret moved back before the trigger: no menu.
    expect(at('hello @acme', 3)).toBeNull();
  });

  it('takes the last trigger, so a second @ hands over', () => {
    expect(at('@one @two')).toEqual({ at: 5, query: 'two' });
  });

  it('closes rather than falling back to an earlier @ — typing an address is not picking a record', () => {
    // Verified in the browser 2026-08-03: the menu opens on "ship @", stays
    // open through "@mail", and closes the moment "sarah@" is typed.
    expect(at('ship @mail sarah@example.com')).toBeNull();
  });

  it('clamps an out-of-range caret instead of throwing', () => {
    expect(at('@acme', 99)).toEqual({ at: 0, query: 'acme' });
    expect(at('@acme', -5)).toBeNull();
  });

  it('is uncapped for the slash menu, and still word-anchored', () => {
    expect(triggerAt('/img', 4, '/')).toEqual({ at: 0, query: 'img' });
    expect(triggerAt('Hello /img', 10, '/')).toEqual({ at: 6, query: 'img' });
    expect(triggerAt('and/or', 6, '/')).toBeNull();
    expect(triggerAt('/' + 'x'.repeat(80), 81, '/')).toEqual({ at: 0, query: 'x'.repeat(80) });
  });
});

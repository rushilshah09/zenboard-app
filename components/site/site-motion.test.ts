import { describe, expect, it } from 'vitest';
import { arrivals } from './site-motion';

// The arrival controller, run against a small fake page: which parts wait, in what order they arrive,
// and that nothing of an arrival outlives it. A fake rather than a DOM library, because what matters
// here is only what it reads (position, whether a part is drawn) and what it writes (two attributes
// and one number).

type Listener = (e: { target: unknown; propertyName?: string; pseudoElement?: string }) => void;

class Part {
  attrs = new Map<string, string>();
  props = new Map<string, string>();
  listeners: Listener[] = [];
  parent: Part | null = null;
  words: Part[] = [];
  style = {
    setProperty: (k: string, v: string) => { this.props.set(k, v); },
    removeProperty: (k: string) => { this.props.delete(k); },
  };
  constructor(public top: number, attrs: Record<string, string> = {}, public drawn = true, words = 0) {
    for (const [k, v] of Object.entries(attrs)) this.attrs.set(k, v);
    this.words = Array.from({ length: words }, () => new Part(top));
  }
  get dataset() { return { reveal: this.attrs.get('data-reveal') }; }
  getAttribute(n: string) { return this.attrs.get(n) ?? null; }
  setAttribute(n: string, v: string) { this.attrs.set(n, v); }
  removeAttribute(n: string) { this.attrs.delete(n); }
  hasAttribute(n: string) { return this.attrs.has(n); }
  closest(sel: string): Part | null {
    if (this.attrs.has(sel.slice(1, -1))) return this;
    return this.parent ? this.parent.closest(sel) : null;
  }
  getBoundingClientRect() { return { top: this.top, left: 0 }; }
  getClientRects() { return this.drawn ? [{}] : []; }
  querySelectorAll() { return this.words; }
  addEventListener(_: string, fn: Listener) { this.listeners.push(fn); }
  removeEventListener(_: string, fn: Listener) { this.listeners = this.listeners.filter((l) => l !== fn); }
  land(propertyName = 'opacity', target: unknown = this, pseudoElement = '') {
    for (const l of [...this.listeners]) l({ target, propertyName, pseudoElement });
  }
  get shown() { return this.attrs.get('data-shown') ?? null; }
  get step() { return this.props.get('--reveal-i') ?? null; }
}

function page(parts: Part[], fold = 800) {
  const frames: (() => void)[] = [];
  const made: { cb: (e: { isIntersecting: boolean; target: Part }[]) => void; watched: Set<Part> }[] = [];
  class IO {
    watched = new Set<Part>();
    constructor(public cb: (e: { isIntersecting: boolean; target: Part }[]) => void) { made.push(this); }
    observe(p: Part) { this.watched.add(p); }
    unobserve(p: Part) { this.watched.delete(p); }
    disconnect() { this.watched.clear(); }
  }
  const win = {
    innerHeight: fold,
    IntersectionObserver: IO,
    requestAnimationFrame: (f: () => void) => { frames.push(f); return frames.length; },
    cancelAnimationFrame: () => {},
  };
  const doc = { defaultView: win, querySelectorAll: () => parts };
  const stop = arrivals(doc as unknown as Document);
  return {
    stop,
    watched: () => [...(made[0]?.watched ?? [])],
    /** These come into view in one frame. */
    enter: (...ps: Part[]) => {
      made[0].cb(ps.map((target) => ({ isIntersecting: true, target })));
      while (frames.length) frames.shift()!();
    },
  };
}

describe('what waits', () => {
  it('leaves what is on screen, or above it, alone, and holds back what is below', () => {
    const above = new Part(-400, { 'data-reveal': 'rise' });
    const onScreen = new Part(300, { 'data-reveal': 'rise' });
    const below = new Part(1200, { 'data-reveal': 'rise' });
    const p = page([above, onScreen, below]);
    expect([above.shown, onScreen.shown, below.shown]).toEqual([null, null, 'false']);
    expect(p.watched()).toEqual([below]);
  });

  it('holds a group back as one, and watches only the group', () => {
    const group = new Part(1200, { 'data-reveal-group': '' });
    const name = new Part(1200, { 'data-reveal': 'rise' });
    const title = new Part(1240, { 'data-reveal': 'words' }, true, 6);
    name.parent = group;
    title.parent = group;
    const p = page([name, title]);
    expect([name.shown, title.shown]).toEqual(['false', 'false']);
    expect(p.watched()).toEqual([group]);
  });
});

describe('how it arrives', () => {
  it('brings a group in, in order, with a heading taking a step for every two of its words', () => {
    const group = new Part(1200, { 'data-reveal-group': '' });
    const name = new Part(1200, { 'data-reveal': 'rise' });
    const title = new Part(1240, { 'data-reveal': 'words' }, true, 6);
    const list = new Part(1400, { 'data-reveal': 'rise' });
    for (const x of [name, title, list]) x.parent = group;
    const p = page([name, title, list]);
    p.enter(group);
    expect([name.shown, title.shown, list.shown]).toEqual(['true', 'true', 'true']);
    // name 0; the title 1 (six words: it takes 1 + 3 steps); the list after it.
    expect([name.step, title.step, list.step]).toEqual(['0', '1', '5']);
  });

  it('brings what came into view together in reading order, each a step behind the one before', () => {
    const right = new Part(1200, { 'data-reveal': 'lift' });
    right.getBoundingClientRect = () => ({ top: 1200, left: 600 });
    const left = new Part(1204, { 'data-reveal': 'lift' });
    const p = page([right, left]);
    p.enter(right, left);
    // Tops within a row count as one row, so left comes before right.
    expect([left.step, right.step]).toEqual(['0', '1']);
  });

  it('caps the wait, so a long list never keeps its last part standing', () => {
    const group = new Part(1200, { 'data-reveal-group': '' });
    const rows = Array.from({ length: 20 }, (_, i) => Object.assign(new Part(1200 + i * 40, { 'data-reveal': 'rise' }), { parent: group }));
    const p = page(rows);
    p.enter(group);
    expect(rows.at(-1)!.step).toBe('12');
  });

  it('lets a part that is not drawn simply be there', () => {
    const hidden = new Part(1200, { 'data-reveal': 'rise' }, false);
    const p = page([hidden]);
    expect(hidden.shown).toBe('false');
    p.enter(hidden);
    expect(hidden.shown).toBeNull();
  });
});

describe('after it lands', () => {
  it('takes every mark of the arrival off, and only once the part has landed', () => {
    const part = new Part(1200, { 'data-reveal': 'rise' });
    const p = page([part]);
    p.enter(part);
    part.land('transform');
    expect(part.shown).toBe('true');
    part.land('opacity');
    expect([part.shown, part.step]).toEqual([null, null]);
  });

  it('waits for a heading\'s LAST word, and for a rule\'s line rather than its stars', () => {
    const title = new Part(1200, { 'data-reveal': 'words' }, true, 3);
    const rule = new Part(1300, { 'data-reveal': 'rule' });
    const p = page([title, rule]);
    p.enter(title, rule);
    title.land('opacity', title.words[0]);
    expect(title.shown).toBe('true');
    title.land('opacity', title.words[2]);
    expect(title.shown).toBeNull();
    rule.land('opacity', {});
    expect(rule.shown).toBe('true');
    rule.land('transform', rule, '::before');
    expect(rule.shown).toBeNull();
  });
});

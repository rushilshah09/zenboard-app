import { describe, it, expect } from 'vitest';
import { installInputModality, lastInput, modalityOf, ENTERED_ATTR, ENTRANCES, INPUT_ATTR } from './input-modality';

describe('the hand that drove the last interaction', () => {
  it('a key is the keyboard, a press is the pointer', () => {
    expect(modalityOf({ type: 'keydown', key: 'k' })).toBe('keyboard');
    expect(modalityOf({ type: 'keydown', key: 'Enter' })).toBe('keyboard');
    expect(modalityOf({ type: 'keydown', key: 'Escape' })).toBe('keyboard');
    expect(modalityOf({ type: 'pointerdown' })).toBe('pointer');
  });

  it('a modifier on its own says nothing, so a ⌘-click stays a click', () => {
    for (const key of ['Shift', 'Meta', 'Control', 'Alt']) expect(modalityOf({ type: 'keydown', key })).toBeNull();
  });

  it('other events say nothing, including a pointer that only moves', () => {
    expect(modalityOf({ type: 'pointermove' })).toBeNull();
    expect(modalityOf({ type: 'keyup', key: 'k' })).toBeNull();
  });

  it('stamps <html> only when the hand changes, and uninstalls', () => {
    // A document shaped just enough for the installer: vitest runs in Node, no DOM.
    const listeners = new Map<string, (e: Event) => void>();
    const attrs = new Map<string, string>();
    let writes = 0;
    const root = {
      getAttribute: (k: string) => attrs.get(k) ?? null,
      setAttribute: (k: string, v: string) => { writes++; attrs.set(k, v); },
    };
    const win = {
      addEventListener: (t: string, fn: (e: Event) => void) => listeners.set(t, fn),
      removeEventListener: (t: string) => listeners.delete(t),
    };
    const doc = { defaultView: win, documentElement: root, querySelectorAll: () => [] } as unknown as Document;

    const uninstall = installInputModality(doc);
    expect(installInputModality(doc)).toBeTypeOf('function');   // a second install is a no-op
    listeners.get('keydown')!({ type: 'keydown', key: 's' } as unknown as Event);
    listeners.get('keydown')!({ type: 'keydown', key: 'j' } as unknown as Event);
    expect(attrs.get(INPUT_ATTR)).toBe('keyboard');
    expect(writes).toBe(1);
    listeners.get('keydown')!({ type: 'keydown', key: 'Meta' } as unknown as Event);
    expect(attrs.get(INPUT_ATTR)).toBe('keyboard');
    listeners.get('pointerdown')!({ type: 'pointerdown' } as unknown as Event);
    expect(attrs.get(INPUT_ATTR)).toBe('pointer');
    expect(writes).toBe(2);
    uninstall();
    expect(listeners.size).toBe(0);
  });

  it('a key and then a press never replays an entrance: what is on screen is settled BEFORE the hand changes', () => {
    // 2026-09-21: Escape in a task chip's menu, then a click on another chip — lifting the keyboard's
    // `animation: none` restarted the open side panel's slide-in from its first frame (off-screen), under the
    // press, and the click landed on the page behind.
    const listeners = new Map<string, (e: Event) => void>();
    const attrs = new Map<string, string>();
    const order: string[] = [];
    const entrance = (name: string) => ({ setAttribute: (k: string) => order.push(`${name} ${k}`) });
    const root = {
      getAttribute: (k: string) => attrs.get(k) ?? null,
      setAttribute: (k: string, v: string) => { order.push(`html ${v}`); attrs.set(k, v); },
    };
    const win = {
      addEventListener: (t: string, fn: (e: Event) => void) => listeners.set(t, fn),
      removeEventListener: (t: string) => listeners.delete(t),
    };
    const doc = {
      defaultView: win, documentElement: root,
      querySelectorAll: (sel: string) => { order.push(`find ${sel}`); return [entrance('panel'), entrance('menu')]; },
    } as unknown as Document;
    const uninstall = installInputModality(doc);

    // The very first press settles nothing — no keyboard rule is being lifted, so nothing could replay.
    listeners.get('pointerdown')!({ type: 'pointerdown' } as unknown as Event);
    expect(order).toEqual(['html pointer']);

    order.length = 0;
    listeners.get('keydown')!({ type: 'keydown', key: 'Escape' } as unknown as Event);
    listeners.get('pointerdown')!({ type: 'pointerdown' } as unknown as Event);
    expect(order).toEqual([
      'html keyboard',
      `find ${ENTRANCES}`, `panel ${ENTERED_ATTR}`, `menu ${ENTERED_ATTR}`,
      'html pointer',
    ]);

    // A second press is not a change of hand: nothing is looked for again.
    order.length = 0;
    listeners.get('pointerdown')!({ type: 'pointerdown' } as unknown as Event);
    expect(order).toEqual([]);
    uninstall();
  });

  it('reads as a pointer where there is no document (server render)', () => {
    expect(lastInput()).toBe('pointer');
  });
});

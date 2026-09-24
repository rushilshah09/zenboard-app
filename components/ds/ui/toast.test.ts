import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { toast, dismissToast, getToasts, expiredIds, toastLife, liveFor, lifeTick, type ToastData } from './toast';

// The store is module state, so every case starts from empty and ends there.
// Fake timers because the whole point of this file is WHEN a toast leaves.
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  getToasts().forEach((t) => dismissToast(t.id));
  vi.advanceTimersByTime(1000);
  vi.useRealTimers();
});

describe('a toast leaves instead of vanishing', () => {
  it('stays on screen while it exits, then goes', () => {
    const id = toast({ message: 'Saved' });
    expect(getToasts()).toHaveLength(1);

    dismissToast(id);
    // Still rendered — this is the frame budget the exit animation runs in.
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0].leaving).toBe(true);

    vi.advanceTimersByTime(399);
    expect(getToasts(), 'removed before the floor - the exit had no time to run').toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(getToasts(), 'the floor never fired, so a card with no animation would stay forever').toEqual([]);
  });

  it('ignores a second dismissal rather than restarting the exit', () => {
    const id = toast({ message: 'Saved' });
    dismissToast(id);
    vi.advanceTimersByTime(200);
    dismissToast(id);
    vi.advanceTimersByTime(200);
    expect(getToasts(), 'the second press pushed the removal out by another floor').toEqual([]);
  });

  it('treats a repeat of a leaving message as a new toast, not a count on a dying one', () => {
    const first = toast({ message: 'Saved' });
    dismissToast(first);
    const second = toast({ message: 'Saved' });

    expect(second).not.toBe(first);
    expect(getToasts()).toHaveLength(2);
    expect(getToasts()[1].count, 'the new toast inherited a count from the corpse').toBe(1);
  });

  it('still counts up an identical message that is very much alive', () => {
    toast({ message: 'Task added' });
    toast({ message: 'Task added' });
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0].count).toBe(2);
  });
});

describe('the clocks in §4.41, as a pure rule', () => {
  const at = (over: Partial<ToastData>): ToastData =>
    ({ id: 1, variant: 'success', message: 'm', count: 1, createdAt: 0, bornAt: 0, ...over }) as ToastData;

  it('gives a plain toast 4s and one with an action 8s', () => {
    const plain = at({ id: 1 });
    const withAction = at({ id: 2, action: { label: 'Undo', onAction: () => {} } });
    expect(expiredIds([plain, withAction], 3999)).toEqual([]);
    expect(expiredIds([plain, withAction], 4000)).toEqual([1]);
    expect(expiredIds([plain, withAction], 8000)).toEqual([1, 2]);
  });

  it('never expires an error, and never dismisses one already leaving', () => {
    const err = at({ id: 3, variant: 'error' });
    const going = at({ id: 4, leaving: true });
    expect(expiredIds([err, going], 60_000)).toEqual([]);
  });
});

describe('a pause pauses', () => {
  // Measured before this existed, on the Undo toast in /dev-preview/confirm: nine
  // seconds resting on it, then gone 700ms after the pointer left; nine seconds in a
  // hidden tab, then gone on return. Expiry ran on the wall clock, so "pause" only
  // postponed. Emil Kowalski, from Sonner: pause toast timers when the tab is hidden.
  it('counts no time while the stack is held or the tab is hidden', () => {
    expect(lifeTick(250, { held: true, visible: true })).toBe(0);
    expect(lifeTick(250, { held: false, visible: false })).toBe(0);
    expect(lifeTick(250, { held: false, visible: true })).toBe(250);
    expect(lifeTick(-5, { held: false, visible: true }), 'a clock that runs backwards is not time').toBe(0);
  });

  it('gives back exactly the life that was left, however long the pause', () => {
    const id = toast({ message: 'Removed', action: { label: 'Undo', onAction: () => {} } });
    liveFor(3000);
    // …held for as long as the reader likes: the Toaster adds nothing meanwhile…
    vi.advanceTimersByTime(60_000);
    liveFor(4999);
    expect(expiredIds(getToasts(), toastLife()), 'the pause was spent from its life').not.toContain(id);
    liveFor(1);
    expect(expiredIds(getToasts(), toastLife())).toContain(id);
  });

  it('restarts the life of a message that repeats', () => {
    const id = toast({ message: 'Task added' });
    liveFor(3000);
    toast({ message: 'Task added' });
    liveFor(3999);
    expect(expiredIds(getToasts(), toastLife()), 'the ×2 inherited the first one\'s age').not.toContain(id);
  });

  it('never feeds the wall clock to expiry', () => {
    const src = readFileSync('components/ds/ui/toast.tsx', 'utf8');
    expect(src).not.toMatch(/expiredIds\([^)]*Date\.now\(\)/);
    expect(src).toMatch(/expiredIds\(toasts, toastLife\(\)\)/);
    expect(src, 'a hidden tab must restart the count, or the first tick back carries the absence').toMatch(/addEventListener\("visibilitychange"/);
  });
});

describe('the stack has no gaps for the pointer to fall through', () => {
  // Measured: walking the pointer down an expanded stack of five, each 8px gap counted
  // as leaving the stack, which resumed every clock and collapsed it to three mid-reach.
  // Each card's `before:` bridges the gap above it (Sonner fills its gaps the same way).
  it('bridges the gap-2 above every card', () => {
    const src = readFileSync('components/ds/ui/toast.tsx', 'utf8');
    expect(src).toMatch(/gap-2/);
    expect(src).toMatch(/before:absolute before:inset-x-0 before:-top-2 before:h-2 before:content-\[''\]/);
  });
});

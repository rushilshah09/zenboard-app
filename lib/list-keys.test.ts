import { describe, it, expect } from 'vitest';
import { listKeysActive, nextIndex, isTypingTarget, type ListKeyContext } from './list-keys';

const ok: ListKeyContext = {
  target: null,
  metaKey: false, ctrlKey: false, altKey: false,
  goChord: false, popperOpen: false, recordOpen: false, suspended: false,
};

describe('listKeysActive — every clause is a bug somebody already hit', () => {
  it('handles a plain key', () => {
    expect(listKeysActive(ok)).toBe(true);
  });

  it('yields to modified keys', () => {
    // ⌘K is the command palette; ⌥/Ctrl combos belong to the OS.
    expect(listKeysActive({ ...ok, metaKey: true })).toBe(false);
    expect(listKeysActive({ ...ok, ctrlKey: true })).toBe(false);
    expect(listKeysActive({ ...ok, altKey: true })).toBe(false);
  });

  it('yields to the "g" navigation chord', () => {
    // Without this, `g t` navigates to Today AND fires the row-level `t`
    // (schedule for today) on whatever row the cursor was on.
    expect(listKeysActive({ ...ok, goChord: true })).toBe(false);
  });

  it('yields while typing', () => {
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
      expect(listKeysActive({ ...ok, target: { tagName: tag } as unknown as EventTarget })).toBe(false);
    }
    expect(listKeysActive({ ...ok, target: { tagName: 'DIV', isContentEditable: true } as unknown as EventTarget })).toBe(false);
  });

  it('yields to an open menu and to an open record', () => {
    // Both own the keyboard while they are up; the list underneath must not
    // also act on Enter or Escape.
    expect(listKeysActive({ ...ok, popperOpen: true })).toBe(false);
    expect(listKeysActive({ ...ok, recordOpen: true })).toBe(false);
  });

  it('yields to the view\'s own suspensions', () => {
    expect(listKeysActive({ ...ok, suspended: true })).toBe(false);
  });
});

describe('isTypingTarget', () => {
  it('is false for nothing and for an ordinary element', () => {
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget({ tagName: 'DIV' } as unknown as EventTarget)).toBe(false);
  });
});

describe('nextIndex', () => {
  it('enters the list at the TOP from either direction', () => {
    // Pressing ↑ with no cursor to land at the bottom of a list you have not
    // entered is a surprise. Both arrows start you at the first row.
    expect(nextIndex(-1, 5, 1)).toBe(0);
    expect(nextIndex(-1, 5, -1)).toBe(0);
  });

  it('moves and clamps at both ends', () => {
    expect(nextIndex(0, 5, 1)).toBe(1);
    expect(nextIndex(4, 5, 1)).toBe(4);
    expect(nextIndex(0, 5, -1)).toBe(0);
  });

  it('has nowhere to go in an empty list', () => {
    expect(nextIndex(-1, 0, 1)).toBe(-1);
    expect(nextIndex(2, 0, -1)).toBe(-1);
  });
});

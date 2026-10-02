import { describe, it, expect } from 'vitest';
import { isFocusMode, FOCUS_PATH, FOCUS_EXIT_PATH } from './focus-mode';

describe('isFocusMode', () => {
  it('is on at /focus and below it', () => {
    expect(isFocusMode('/focus')).toBe(true);
    expect(isFocusMode('/focus/')).toBe(true);
    expect(isFocusMode('/focus/abc')).toBe(true);
  });

  it('is off everywhere else', () => {
    for (const p of ['/', '/today', '/tasks', '/tasks?view=board', '/settings']) {
      expect(isFocusMode(p)).toBe(false);
    }
  });

  it('does NOT match a sibling route that merely starts with the word', () => {
    // The reason this is a function and not `startsWith('/focus')`: the day
    // someone adds /focus-settings, a bare prefix test strips the sidebar off
    // a page that never asked to be a mode.
    expect(isFocusMode('/focus-settings')).toBe(false);
    expect(isFocusMode('/focused-work')).toBe(false);
  });

  it('is off for a missing pathname rather than throwing', () => {
    // The safe failure is CHROME STAYS. Guessing "focus" from no information
    // would hide every way to navigate.
    expect(isFocusMode(null)).toBe(false);
    expect(isFocusMode(undefined)).toBe(false);
    expect(isFocusMode('')).toBe(false);
  });

  it('exits somewhere that is not itself', () => {
    expect(FOCUS_EXIT_PATH).not.toBe(FOCUS_PATH);
    expect(isFocusMode(FOCUS_EXIT_PATH)).toBe(false);
  });
});

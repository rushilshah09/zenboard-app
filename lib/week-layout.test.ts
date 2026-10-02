import { describe, it, expect } from 'vitest';
import {
  COL_INBOX, COL_INBOX_COLLAPSED, COL_DAY_MIN,
  daysWidth, weekFits, collapseWouldHelp, boardMinWidth,
} from './week-layout';

// The two machines the numbers were chosen against. These are MEASURED in the
// browser (`scroller.clientWidth`), not computed from the window width — the
// first version of this file assumed 1280 for the 15" pane, the browser
// reported 1276, and the week overflowed by four pixels.
const PANE_13IN = 1044;   // a 1280px laptop
const PANE_15IN = 1276;   // a 1512px laptop
const WEEK = 7;

describe('the defect this file exists for', () => {
  it('the OLD fixed layout needed 2196px for a week', () => {
    // 320 + 268 * 7. Recorded as a test so the number that caused this is not
    // lost to the commit log: with the 232px rail beside it, that is a ~2500px
    // window before you could see seven days.
    expect(320 + 268 * WEEK).toBe(2196);
    expect(2196).toBeGreaterThan(PANE_15IN);
  });

  it('the new floor is smaller than both real panes', () => {
    expect(boardMinWidth(WEEK, true)).toBeLessThanOrEqual(PANE_13IN);
    expect(boardMinWidth(WEEK, false)).toBeLessThanOrEqual(PANE_15IN);
  });
});

describe('weekFits', () => {
  it('fits a 15" pane with the staging column OPEN, with headroom to spare', () => {
    expect(weekFits(PANE_15IN, WEEK, false)).toBe(true);
    // Headroom is the point: exact-fit is what broke it the first time.
    expect(daysWidth(PANE_15IN, false) - COL_DAY_MIN * WEEK).toBeGreaterThan(0);
  });

  it('fits a 13" pane only once the staging column is COLLAPSED', () => {
    expect(weekFits(PANE_13IN, WEEK, false)).toBe(false);
    expect(weekFits(PANE_13IN, WEEK, true)).toBe(true);
  });

  it('a week with no days trivially fits', () => {
    // Guards the divide: an empty `days` array must not report "does not fit"
    // and render a hint about a week that is not there.
    expect(weekFits(0, 0, false)).toBe(true);
  });

  it('never reports a negative amount of room', () => {
    expect(daysWidth(100, false)).toBe(0);
  });
});

describe('collapseWouldHelp', () => {
  it('offers the collapse only when it would actually deliver', () => {
    expect(collapseWouldHelp(PANE_13IN, WEEK)).toBe(true);
  });

  it('stays quiet when the week already fits', () => {
    // Nothing to gain — pointing at a control that changes nothing is noise.
    expect(collapseWouldHelp(PANE_15IN, WEEK)).toBe(false);
  });

  it('stays quiet when collapsing would NOT be enough either', () => {
    // An offer that does not deliver is worse than no offer: you take the
    // advice, lose your staging column, and still cannot see the week.
    const tiny = COL_INBOX_COLLAPSED + COL_DAY_MIN * WEEK - 1;
    expect(weekFits(tiny, WEEK, true)).toBe(false);
    expect(collapseWouldHelp(tiny, WEEK)).toBe(false);
  });
});

describe('boardMinWidth', () => {
  it('reserves the floor, not the ideal', () => {
    expect(boardMinWidth(WEEK, false)).toBe(COL_INBOX + COL_DAY_MIN * WEEK);
    expect(boardMinWidth(WEEK, true)).toBe(COL_INBOX_COLLAPSED + COL_DAY_MIN * WEEK);
  });
});

import { describe, it, expect } from 'vitest';
import { layoutDay, CASCADE_MIN, MAX_DEPTH } from './calendar-layout';
import type { CalEvent } from './calendar';

// Local wall-clock times on one day, so the layout reads the same in every time zone the suite runs in.
const at = (h: number, m = 0) => new Date(2026, 8, 21, h, m).toISOString();
const ev = (id: string, sh: number, sm: number, eh: number, em: number): CalEvent =>
  ({ id, title: id, starts_at: at(sh, sm), ends_at: at(eh, em), all_day: false, source: null });
const place = (events: CalEvent[]) => Object.fromEntries(layoutDay(events).map((p) => [p.e.id, { col: p.col, cols: p.cols, span: p.span, depth: p.depth }]));

describe('layoutDay — where each timed event sits in its column', () => {
  it('an event with nothing beside it has the whole column', () => {
    expect(place([ev('a', 9, 0, 10, 0), ev('b', 11, 0, 12, 0)])).toEqual({
      a: { col: 0, cols: 1, span: 1, depth: 0 },
      b: { col: 0, cols: 1, span: 1, depth: 0 },
    });
  });

  it('a standup half an hour into a meeting stacks on it, and the meeting keeps the whole column (the report)', () => {
    // Design review 9:30–10:30 and a 15-minute standup at 10:00 split the column in two, and the review's title —
    // clear of the standup the whole time — was cut to "Des…".
    expect(place([ev('review', 9, 30, 10, 30), ev('standup', 10, 0, 10, 15)])).toEqual({
      review: { col: 0, cols: 1, span: 1, depth: 0 },
      standup: { col: 0, cols: 1, span: 1, depth: 1 },
    });
  });

  it('events that start together sit side by side — neither title would show under the other', () => {
    expect(place([ev('a', 10, 0, 11, 0), ev('b', 10, 0, 11, 0)])).toEqual({
      a: { col: 0, cols: 2, span: 1, depth: 0 },
      b: { col: 1, cols: 2, span: 1, depth: 0 },
    });
  });

  it(`a start less than ${CASCADE_MIN} minutes after another is still too close to stack`, () => {
    expect(place([ev('a', 9, 30, 10, 30), ev('b', 9, 45, 10, 15)])).toMatchObject({
      a: { col: 0, cols: 2, depth: 0 },
      b: { col: 1, cols: 2, depth: 0 },
    });
  });

  it('a long block takes every meeting inside it as a stack, one level deep', () => {
    const p = place([ev('focus', 9, 0, 17, 0), ev('m1', 10, 0, 10, 30), ev('m2', 13, 0, 14, 0), ev('m3', 15, 0, 15, 45)]);
    expect(p.focus).toEqual({ col: 0, cols: 1, span: 1, depth: 0 });
    for (const id of ['m1', 'm2', 'm3']) expect(p[id]).toEqual({ col: 0, cols: 1, span: 1, depth: 1 });
  });

  it('stacks deepen one level per event still running underneath, and stop at the cap', () => {
    const chain = [ev('a', 8, 0, 14, 0), ev('b', 9, 0, 14, 0), ev('c', 10, 0, 14, 0), ev('d', 11, 0, 14, 0), ev('e', 12, 0, 14, 0)];
    const p = place(chain);
    expect([p.a.depth, p.b.depth, p.c.depth, p.d.depth, p.e.depth]).toEqual([0, 1, 2, MAX_DEPTH, MAX_DEPTH]);
    expect(new Set(Object.values(p).map((x) => x.cols))).toEqual(new Set([1]));
  });

  it('an event takes the free column before it would stack over another', () => {
    // a and b start together (two columns); b ends at 9:30, so c at 10:00 goes into b's empty column rather than
    // on top of a.
    expect(place([ev('a', 9, 0, 12, 0), ev('b', 9, 0, 9, 30), ev('c', 10, 0, 11, 0)])).toMatchObject({
      a: { col: 0, depth: 0 },
      b: { col: 1, depth: 0 },
      c: { col: 1, depth: 0 },
    });
  });

  it('an event widens into columns to its right that are free for its whole span', () => {
    // Three things start at 9 and two are over by half past. The long one takes the left column (on a tied start
    // the longer goes first, as Google lays it); a 10:00 meeting lands in the first FREE column rather than on top
    // of it, and takes the column beside that too — nothing else is running there.
    const p = place([ev('a', 9, 0, 9, 30), ev('b', 9, 0, 9, 30), ev('c', 9, 0, 12, 0), ev('d', 10, 0, 11, 0)]);
    expect(p.c).toEqual({ col: 0, cols: 3, span: 1, depth: 0 });
    expect(p.d).toEqual({ col: 1, cols: 3, span: 2, depth: 0 });
  });

  it('a gap starts a new group: what comes after it is not narrowed by what came before', () => {
    const p = place([ev('a', 9, 0, 10, 0), ev('b', 9, 0, 10, 0), ev('later', 14, 0, 15, 0)]);
    expect(p.later).toEqual({ col: 0, cols: 1, span: 1, depth: 0 });
  });

  it('an event with no end is an hour long', () => {
    const open: CalEvent = { id: 'open', title: 'open', starts_at: at(9, 0), ends_at: null, all_day: false, source: null };
    expect(place([open, ev('b', 9, 15, 9, 45)])).toMatchObject({ open: { cols: 2 }, b: { cols: 2 } });
  });
});

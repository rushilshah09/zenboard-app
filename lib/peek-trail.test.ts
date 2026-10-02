import { describe, it, expect } from 'vitest';
import { back, backTo, deeper, forward, startTrail } from './peek-trail';

// Pages open inside pages in ONE peek (the user, 2026-09-15: pages "nested into
// nested"). Its header is a trail with Back and Forward, and these are its rules.
describe('the trail of pages in a peek', () => {
  const start = startTrail('row:1', 'row');

  it('goes deeper one page at a time', () => {
    expect(deeper(deeper(start, 'brief'), 'notes').stack).toEqual(['row', 'brief', 'notes']);
  });

  it('goes back and forward through the pages it came through', () => {
    const t = deeper(deeper(start, 'brief'), 'notes');
    const b = back(back(t));
    expect(b.stack).toEqual(['row']);
    expect(b.ahead).toEqual(['brief', 'notes']);
    expect(forward(b).stack).toEqual(['row', 'brief']);
    expect(forward(forward(b)).stack).toEqual(['row', 'brief', 'notes']);
  });

  it('never goes back past the page it opened on, nor forward past the end', () => {
    expect(back(start)).toBe(start);
    expect(forward(start)).toBe(start);
  });

  it('forgets the way forward once a new page is opened', () => {
    const t = back(deeper(start, 'brief'));
    expect(deeper(t, 'other')).toMatchObject({ stack: ['row', 'other'], ahead: [] });
  });

  it('jumps back along the breadcrumb, and ignores the crumb of the page showing', () => {
    const t = deeper(deeper(start, 'brief'), 'notes');
    expect(backTo(t, 0)).toMatchObject({ stack: ['row'], ahead: [] });
    expect(backTo(t, 2)).toBe(t);
    expect(backTo(t, -1)).toBe(t);
  });
});

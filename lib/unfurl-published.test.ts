import { describe, it, expect } from 'vitest';
import { fromOembed, publishedDay } from './unfurl';

// COLLECTION_VIEW_PLAN C3 (brief §6): a collected article or video fills its Published date
// from what the page, or the platform, says.
describe('publishedDay — the day a page says it was published', () => {
  it("keeps the day in the publisher's own calendar, whatever it is in UTC", () => {
    expect(publishedDay('2024-03-05T23:30:00-08:00')).toBe('2024-03-05');
    expect(publishedDay('2024-03-05')).toBe('2024-03-05');
    expect(publishedDay(' 2014-02-18 10:38:31 ')).toBe('2014-02-18');
  });

  it('says nothing for what is not a real day', () => {
    expect(publishedDay(undefined)).toBeUndefined();
    expect(publishedDay('')).toBeUndefined();
    expect(publishedDay('yesterday')).toBeUndefined();
    expect(publishedDay('2024-02-30')).toBeUndefined();
    expect(publishedDay('2024-13-01')).toBeUndefined();
    // The zero time some systems write when they have no date at all.
    expect(publishedDay('0001-01-01T00:00:00Z')).toBeUndefined();
  });
});

describe('fromOembed — the published day a platform gives', () => {
  it("reads Vimeo's upload_date", () => {
    const meta = fromOembed({ title: 'A film', upload_date: '2014-02-18 10:38:31', thumbnail_url: 'https://i.vimeocdn.com/video/1.jpg' }, 'https://vimeo.com/86825455');
    expect(meta?.published).toBe('2014-02-18');
  });

  it('has no published day when the platform gives none', () => {
    const meta = fromOembed({ title: 'Me at the zoo', author_name: 'jawed' }, 'https://www.youtube.com/watch?v=jNQXAC9IVRw');
    expect(meta?.published).toBeUndefined();
  });
});

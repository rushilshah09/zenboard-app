import { describe, it, expect } from 'vitest';
import {
  newFeedToken, looksLikeFeedToken, feedWindow, tasksAsIcsEvents, mergeFeed, type FeedTask,
} from './calendar-feed';
import { eventsToIcs, type IcsEvent } from './ics';

const NOW = new Date('2026-08-04T12:00:00.000Z');
const WIN = feedWindow(NOW);

const task = (over: Partial<FeedTask> = {}): FeedTask =>
  ({ id: 't1', title: 'Draft the brief', scheduled_date: '2026-08-06', event_id: null, ...over });

describe('feed token', () => {
  it('is long, url-safe, and different every time', () => {
    const a = newFeedToken(); const b = newFeedToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it('recognises its own tokens and rejects junk before any query runs', () => {
    expect(looksLikeFeedToken(newFeedToken())).toBe(true);
    for (const bad of ['', null, undefined, 'short', 'has spaces in it here', '../../etc/passwd', 'a'.repeat(65)]) {
      expect(looksLikeFeedToken(bad), String(bad)).toBe(false);
    }
  });
});

describe('feedWindow', () => {
  it('is bounded in both directions — a feed is fetched forever', () => {
    expect(WIN.from < NOW.toISOString()).toBe(true);
    expect(WIN.to > NOW.toISOString()).toBe(true);
    const days = (Date.parse(WIN.to) - Date.parse(WIN.from)) / 86400000;
    expect(Math.round(days)).toBe(730);
  });
});

describe('tasksAsIcsEvents', () => {
  it('turns a scheduled task into an all-day entry', () => {
    expect(tasksAsIcsEvents([task()], WIN)).toEqual([{
      id: 'zb-task-t1', title: 'Draft the brief',
      starts_at: '2026-08-06T00:00:00.000Z', ends_at: null, all_day: true,
    }]);
  });

  // The reason the feed is a merge rather than a second copy of the calendar
  // tab — and the reason it cannot simply concatenate the two tables.
  it('SKIPS a task that already has a timebox twin', () => {
    expect(tasksAsIcsEvents([task({ event_id: 'ev-1' })], WIN)).toEqual([]);
  });

  it('skips an unscheduled task', () => {
    expect(tasksAsIcsEvents([task({ scheduled_date: null })], WIN)).toEqual([]);
  });

  it('keeps a finished task, and says that it is finished', () => {
    // A calendar is a record of what happened, not only of what is left.
    expect(tasksAsIcsEvents([task({ done: true })], WIN)[0].title).toBe('✓ Draft the brief');
  });

  it('drops anything outside the window', () => {
    expect(tasksAsIcsEvents([task({ scheduled_date: '2019-01-01' })], WIN)).toEqual([]);
    expect(tasksAsIcsEvents([task({ scheduled_date: '2099-01-01' })], WIN)).toEqual([]);
  });

  // A task id and an event id could collide, and a calendar client resolves a
  // duplicate UID by silently overwriting one entry with the other.
  it('namespaces task UIDs away from event UIDs', () => {
    const shared = 'same-id-as-an-event';
    expect(tasksAsIcsEvents([task({ id: shared })], WIN)[0].id).toBe(`zb-task-${shared}`);
  });
});

describe('mergeFeed', () => {
  const ev: IcsEvent = { id: 'e1', title: 'Client call', starts_at: '2026-08-05T09:00:00.000Z', ends_at: null, all_day: false };

  it('orders everything chronologically', () => {
    const merged = mergeFeed([ev], tasksAsIcsEvents([task({ scheduled_date: '2026-08-04' })], WIN));
    expect(merged.map((x) => x.id)).toEqual(['zb-task-t1', 'e1']);
  });

  it('keeps both sources', () => {
    expect(mergeFeed([ev], tasksAsIcsEvents([task()], WIN))).toHaveLength(2);
  });
});

describe('the serialized feed', () => {
  const ics = () => eventsToIcs(
    mergeFeed(
      [{ id: 'e1', title: 'Client call; with, punctuation', starts_at: '2026-08-05T09:00:00.000Z', ends_at: null, all_day: false }],
      tasksAsIcsEvents([task()], WIN),
    ),
    'Zenboard', NOW, { refreshMinutes: 60 },
  );

  it('tells a subscribing client how often to poll, in both spellings', () => {
    // RFC 7986 for modern clients, the Microsoft property for Outlook. Without
    // these each client invents its own interval and a plan changed at 09:00
    // can surface hours later.
    expect(ics()).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT60M');
    expect(ics()).toContain('X-PUBLISHED-TTL:PT60M');
  });

  it('omits the polling hints for a plain download, where they mean nothing', () => {
    expect(eventsToIcs([], 'Zenboard', NOW)).not.toContain('REFRESH-INTERVAL');
  });

  it('escapes text and uses CRLF, so real clients parse it', () => {
    const out = ics();
    expect(out).toContain('SUMMARY:Client call\\; with\\, punctuation');
    expect(out).toContain('\r\n');
    expect(out.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(out.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  });

  it('gives the task an all-day DATE and the event a UTC timestamp', () => {
    const out = ics();
    expect(out).toContain('DTSTART;VALUE=DATE:20260806');
    expect(out).toContain('DTSTART:20260805T090000Z');
  });

  it('emits exactly one VEVENT per entry', () => {
    expect(ics().match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
});

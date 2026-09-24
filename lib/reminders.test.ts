import { describe, it, expect } from 'vitest';
import {
  reminderPresets, reminderStatus, reminderLabel, partitionDue, nextWakeMs, isFresh,
  BLOCK_LEAD_MINUTES, MORNING_HOUR, EVENING_HOUR, HEARTBEAT_MS, FRESH_WINDOW_MS,
  workerDeliverable, reminderEmail, WORKER_MAX_LATE_MS,
} from './reminders';

// Local time throughout — the module works in the runtime's zone on purpose
// (see its header), so the fixtures are built with the local Date constructor
// rather than with `Z` instants, which would make every assertion depend on
// where the test runs.
const at = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi, 0, 0);
const ids = (ps: { id: string }[]) => ps.map((p) => p.id);
const byId = (ps: { id: string; at: string }[], id: string) => ps.find((p) => p.id === id);
/** Local wall-clock hour of an ISO instant — what the user would read. */
const hourOf = (iso: string) => new Date(iso).getHours();

describe('reminderPresets', () => {
  it('offers the elapsed-time list in a stable order', () => {
    // A Wednesday morning: every "soon" preset is still in the future.
    const now = at(2026, 8, 5, 9, 0);
    expect(ids(reminderPresets(now))).toEqual(['30m', '1h', 'evening', 'tomorrow', 'nextweek']);
  });

  it('drops a preset once it would fire in the past, without reordering the rest', () => {
    // 19:00 — "Later today" (18:00) has gone. Everything else keeps its place.
    const now = at(2026, 8, 5, 19, 0);
    expect(ids(reminderPresets(now))).toEqual(['30m', '1h', 'tomorrow', 'nextweek']);
  });

  it('lands morning presets at 9:00 and the evening one at 18:00, local', () => {
    const ps = reminderPresets(at(2026, 8, 5, 9, 0));
    expect(hourOf(byId(ps, 'evening')!.at)).toBe(EVENING_HOUR);
    expect(hourOf(byId(ps, 'tomorrow')!.at)).toBe(MORNING_HOUR);
    expect(hourOf(byId(ps, 'nextweek')!.at)).toBe(MORNING_HOUR);
  });

  it('puts next week on the following Monday — and a Monday means seven days later', () => {
    // Wed 5 Aug 2026 → Mon 10 Aug.
    const wed = byId(reminderPresets(at(2026, 8, 5, 9, 0)), 'nextweek')!;
    expect(new Date(wed.at).getDay()).toBe(1);
    expect(new Date(wed.at).getDate()).toBe(10);
    // Mon 10 Aug → Mon 17 Aug, never "today".
    const mon = byId(reminderPresets(at(2026, 8, 10, 9, 0)), 'nextweek')!;
    expect(new Date(mon.at).getDate()).toBe(17);
  });

  it('anchors to the calendar block first, ten minutes ahead of it', () => {
    const now = at(2026, 8, 5, 9, 0);
    const blockStart = at(2026, 8, 5, 14, 0).toISOString();
    const ps = reminderPresets(now, { blockStart });
    expect(ids(ps)[0]).toBe('block');
    expect(Date.parse(byId(ps, 'block')!.at)).toBe(Date.parse(blockStart) - BLOCK_LEAD_MINUTES * 60_000);
  });

  it('drops the block preset once the lead time has already passed', () => {
    // Block at 14:00, and it is 13:55 — "10 minutes before" was five minutes ago.
    const ps = reminderPresets(at(2026, 8, 5, 13, 55), { blockStart: at(2026, 8, 5, 14, 0).toISOString() });
    expect(ids(ps)).not.toContain('block');
  });

  it('offers the scheduled morning for a future day and not for one that has started', () => {
    const now = at(2026, 8, 5, 12, 0);
    expect(ids(reminderPresets(now, { scheduledDate: '2026-08-07' }))).toContain('day');
    // Today's 9:00 is in the past by noon.
    expect(ids(reminderPresets(now, { scheduledDate: '2026-08-05' }))).not.toContain('day');
  });

  it('spells out the day for presets that could be more than a week out', () => {
    const ps = reminderPresets(at(2026, 8, 5, 9, 0), { scheduledDate: '2026-08-20' });
    // Not a bare clock time — "9:00 AM" alone would not say which morning.
    expect(byId(ps, 'day')!.at).toBeTruthy();
    expect(ps.find((p) => p.id === 'day')!.detail).toMatch(/,/);
  });

  it('never offers a time inside the one-minute floor', () => {
    // 17:59:30 — "Later today" is 30s away and would fire before the popover closes.
    const now = new Date(2026, 7, 5, 17, 59, 30);
    expect(ids(reminderPresets(now))).not.toContain('evening');
  });

  it('ignores an unparseable block start rather than emitting an Invalid Date', () => {
    const ps = reminderPresets(at(2026, 8, 5, 9, 0), { blockStart: 'not-a-date' });
    expect(ids(ps)).not.toContain('block');
    expect(ps.every((p) => !Number.isNaN(Date.parse(p.at)))).toBe(true);
  });
});

describe('reminderStatus', () => {
  const now = at(2026, 8, 5, 12, 0);
  it('reads none / scheduled / due / delivered', () => {
    expect(reminderStatus({}, now)).toBe('none');
    expect(reminderStatus({ remind_at: null }, now)).toBe('none');
    expect(reminderStatus({ remind_at: at(2026, 8, 5, 13, 0).toISOString() }, now)).toBe('scheduled');
    expect(reminderStatus({ remind_at: at(2026, 8, 5, 11, 0).toISOString() }, now)).toBe('due');
    expect(reminderStatus({
      remind_at: at(2026, 8, 5, 11, 0).toISOString(),
      reminded_at: at(2026, 8, 5, 11, 0).toISOString(),
    }, now)).toBe('delivered');
  });

  it('treats the exact moment as due, not scheduled', () => {
    expect(reminderStatus({ remind_at: now.toISOString() }, now)).toBe('due');
  });
});

describe('reminderLabel', () => {
  const now = at(2026, 8, 5, 9, 0);
  it('drops the day when the reminder is today', () => {
    const label = reminderLabel(at(2026, 8, 5, 18, 0).toISOString(), now)!;
    expect(label).not.toMatch(/Today/);
    expect(label).toMatch(/6|18/);
  });
  it('leads with the day when it is not', () => {
    expect(reminderLabel(at(2026, 8, 6, 9, 0).toISOString(), now)).toMatch(/^Tomorrow, /);
    // The day's own spelling belongs to the locale (lib/date.ts), so assert the
    // shape — a day part, a comma, a clock part — rather than "20 Aug".
    expect(reminderLabel(at(2026, 8, 20, 9, 0).toISOString(), now)).toMatch(/^[^,]*20[^,]*, .+/);
  });
  it('returns undefined for nothing set', () => {
    expect(reminderLabel(null, now)).toBeUndefined();
    expect(reminderLabel(undefined, now)).toBeUndefined();
    expect(reminderLabel('nonsense', now)).toBeUndefined();
  });
});

describe('partitionDue', () => {
  const now = at(2026, 8, 5, 12, 0);
  it('splits on the clock and drops unparseable rows', () => {
    const rows = [
      { id: 'past', remind_at: at(2026, 8, 5, 11, 0).toISOString() },
      { id: 'now', remind_at: now.toISOString() },
      { id: 'future', remind_at: at(2026, 8, 5, 13, 0).toISOString() },
      { id: 'junk', remind_at: 'nope' },
      { id: 'empty', remind_at: null },
    ];
    const { due, upcoming } = partitionDue(rows, now);
    expect(due.map((r) => r.id)).toEqual(['past', 'now']);
    expect(upcoming.map((r) => r.id)).toEqual(['future']);
  });
});

describe('isFresh', () => {
  const now = at(2026, 8, 5, 12, 0);
  it('is fresh inside the window and stale outside it', () => {
    expect(isFresh(at(2026, 8, 5, 11, 30).toISOString(), now)).toBe(true);
    expect(isFresh(new Date(now.getTime() - FRESH_WINDOW_MS).toISOString(), now)).toBe(true);
    expect(isFresh(at(2026, 8, 5, 9, 0).toISOString(), now)).toBe(false);
  });
});

describe('nextWakeMs', () => {
  const now = at(2026, 8, 5, 12, 0);
  it('sleeps until the next reminder when that is soon', () => {
    expect(nextWakeMs(at(2026, 8, 5, 12, 1).toISOString(), now)).toBe(60_000);
  });
  it('caps at the heartbeat so another device is noticed and setTimeout never overflows', () => {
    expect(nextWakeMs(at(2026, 8, 5, 23, 0).toISOString(), now)).toBe(HEARTBEAT_MS);
    expect(nextWakeMs(at(2030, 1, 1, 9, 0).toISOString(), now)).toBe(HEARTBEAT_MS);
  });
  it('never returns a negative delay for something already due', () => {
    expect(nextWakeMs(at(2026, 8, 5, 11, 0).toISOString(), now)).toBe(0);
  });
  it('falls back to the heartbeat with nothing pending or with junk', () => {
    expect(nextWakeMs(null, now)).toBe(HEARTBEAT_MS);
    expect(nextWakeMs('nope', now)).toBe(HEARTBEAT_MS);
  });
});

describe('workerDeliverable', () => {
  const now = at(2026, 8, 5, 12, 0);
  const r = (id: string, mins: number) => ({ id, remind_at: new Date(now.getTime() + mins * 60_000).toISOString() });

  it('takes what is due and not yet stale', () => {
    const rows = [r('just-now', -1), r('an-hour-late', -60), r('future', 30)];
    expect(workerDeliverable(rows, now).map((x) => x.id)).toEqual(['just-now', 'an-hour-late']);
  });

  it('LEAVES a stale reminder alone rather than emailing about last week', () => {
    // The returning-user case: untouched here, so the in-app scheduler still
    // claims it into the bell on the next open. Nothing is lost.
    expect(workerDeliverable([r('ancient', -60 * 24 * 7)], now)).toEqual([]);
  });

  it('treats the window edge as deliverable, not stale', () => {
    const edge = { id: 'edge', remind_at: new Date(now.getTime() - WORKER_MAX_LATE_MS).toISOString() };
    expect(workerDeliverable([edge], now).map((x) => x.id)).toEqual(['edge']);
  });

  it('skips junk and missing timestamps rather than throwing', () => {
    expect(workerDeliverable([{ id: 'a', remind_at: 'nope' }, { id: 'b', remind_at: null }], now)).toEqual([]);
  });
});

describe('reminderEmail', () => {
  const item = (id: string, title: string) => ({ id, title, remind_at: '2026-08-05T12:00:00.000Z' });

  it('names the task when there is one', () => {
    const mail = reminderEmail([item('t1', 'Send the invoice')], 'https://z.app')!;
    expect(mail.subject).toBe('Reminder: Send the invoice');
    expect(mail.text).toContain('https://z.app/tasks?task=t1');
  });

  it('counts them when there are several — ONE email, never one each', () => {
    const mail = reminderEmail([item('a', 'A'), item('b', 'B'), item('c', 'C')], 'https://z.app')!;
    expect(mail.subject).toBe('3 reminders');
    for (const id of ['a', 'b', 'c']) expect(mail.text).toContain(`task=${id}`);
  });

  it('returns null for an empty batch, so the caller cannot send a blank email', () => {
    expect(reminderEmail([], 'https://z.app')).toBeNull();
  });

  it('bakes no clock time into the body — the server is UTC and not the reader', () => {
    const mail = reminderEmail([item('t1', 'Send the invoice')], 'https://z.app')!;
    expect(mail.text).not.toMatch(/\d{1,2}:\d{2}/);
  });
});

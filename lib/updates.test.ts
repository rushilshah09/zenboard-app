import { describe, it, expect } from 'vitest';
import { isUpdate, isAddressedToClient, typeFor, clientUpdates, allUpdates, NOTE, CLIENT_UPDATE } from './updates';
import type { ShareChannels } from './visibility';

const row = (id: string, type: string, body: string | null, created_at: string) => ({ id, type, body, created_at });

const ON: ShareChannels = { timeline: true };
const OFF: ShareChannels = { timeline: false };

describe('isUpdate', () => {
  it('is a written note or client update, and nothing else', () => {
    expect(isUpdate(row('a', NOTE, 'hello', 'x'))).toBe(true);
    expect(isUpdate(row('b', CLIENT_UPDATE, 'hello', 'x'))).toBe(true);
    // Derived and system events are not updates — they are things that
    // happened, not things somebody said.
    expect(isUpdate(row('c', 'status_change', 'Active → Paused', 'x'))).toBe(false);
    expect(isUpdate(row('d', 'accepted', 'Priya accepted the proposal', 'x'))).toBe(false);
  });

  it('an empty body is not an update', () => {
    // A row with no words cannot be news, and an empty card in the portal
    // reads as a bug.
    expect(isUpdate(row('a', CLIENT_UPDATE, '   ', 'x'))).toBe(false);
    expect(isUpdate(row('b', CLIENT_UPDATE, null, 'x'))).toBe(false);
  });
});

describe('typeFor', () => {
  it('is the only place the two names are chosen', () => {
    expect(typeFor(true)).toBe(CLIENT_UPDATE);
    expect(typeFor(false)).toBe(NOTE);
  });

  it('round-trips through isAddressedToClient', () => {
    expect(isAddressedToClient(row('a', typeFor(true), 'x', 'y'))).toBe(true);
    expect(isAddressedToClient(row('a', typeFor(false), 'x', 'y'))).toBe(false);
  });
});

describe('clientUpdates', () => {
  const rows = [
    row('old', CLIENT_UPDATE, 'Kickoff done', '2026-08-01'),
    row('mine', NOTE, 'Chase the unpaid invoice', '2026-08-02'),
    row('new', CLIENT_UPDATE, 'Logo routes are with you', '2026-08-03'),
    row('sys', 'status_change', 'Active → Paused', '2026-08-04'),
  ];

  it('returns only addressed updates, newest first', () => {
    expect(clientUpdates(rows, ON).map((r) => r.id)).toEqual(['new', 'old']);
  });

  it('never leaks a private note', () => {
    // THE ONE THAT MATTERS: "Chase the unpaid invoice" is the sentence this
    // whole type split exists to keep out of the portal.
    expect(clientUpdates(rows, ON).some((r) => r.id === 'mine')).toBe(false);
  });

  it('is silenced entirely by the channel', () => {
    // Turning Timeline off must stop everything of this kind instantly,
    // without touching a single row.
    expect(clientUpdates(rows, OFF)).toEqual([]);
    expect(clientUpdates(rows, {})).toEqual([]);
  });
});

describe('allUpdates', () => {
  it('keeps BOTH audiences in one column, newest first', () => {
    // "What did I last say about this project?" must have one answer, so the
    // owner's list is not split by audience.
    const rows = [
      row('a', NOTE, 'internal', '2026-08-01'),
      row('b', CLIENT_UPDATE, 'to the client', '2026-08-02'),
      row('c', 'invoiced', 'INV-002 drafted', '2026-08-03'),
    ];
    expect(allUpdates(rows).map((r) => r.id)).toEqual(['b', 'a']);
  });
});

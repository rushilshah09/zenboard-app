import { describe, it, expect } from 'vitest';
import {
  isClientVisible, clientVisible, channelFor, hiddenReason, hiddenLabel,
  readChannels, sharesAnything, type ShareChannels,
} from './visibility';

const ALL_ON: ShareChannels = {
  openTasks: true, completedTasks: true, files: true,
  invoices: true, timeline: true, progress: true,
};

describe('the two gates', () => {
  it('needs BOTH the channel and the mark', () => {
    expect(isClientVisible('task', { client_visible: true }, ALL_ON)).toBe(true);
    expect(isClientVisible('task', { client_visible: true }, { ...ALL_ON, openTasks: false })).toBe(false);
    expect(isClientVisible('task', { client_visible: false }, ALL_ON)).toBe(false);
  });

  it('keeps the gates independent — turning a channel off does not unmark rows', () => {
    // The reason these are two flags and not one. Switching Files off is "not
    // this project"; it must silence everything instantly without touching a
    // single row, so that switching it back on restores exactly what was
    // marked — no re-ticking, and nothing re-exposed that was never marked.
    const item = { client_visible: true };
    expect(isClientVisible('file', item, { ...ALL_ON, files: false })).toBe(false);
    expect(isClientVisible('file', item, ALL_ON)).toBe(true);
  });
});

describe('the default is hidden', () => {
  it('treats a MISSING mark as private', () => {
    // Covers the case that matters most: the migration adding the column is not
    // applied yet, so the field is `undefined` on every row.
    expect(isClientVisible('file', {}, ALL_ON)).toBe(false);
    expect(isClientVisible('file', { client_visible: undefined }, ALL_ON)).toBe(false);
    expect(isClientVisible('file', { client_visible: null }, ALL_ON)).toBe(false);
  });

  it('treats a MISSING channel as off', () => {
    expect(isClientVisible('task', { client_visible: true }, {})).toBe(false);
  });

  it('never accepts a truthy non-true value', () => {
    // `=== true` everywhere. A string "false" out of a jsonb column is truthy,
    // and the cost of a false positive here is showing a client someone else's
    // work — which cannot be undone.
    const sneaky = { client_visible: 'false' as unknown as boolean };
    expect(isClientVisible('task', sneaky, ALL_ON)).toBe(false);
    expect(isClientVisible('task', { client_visible: 1 as unknown as boolean }, ALL_ON)).toBe(false);
  });
});

describe('channelFor', () => {
  it('routes a task by whether it is finished', () => {
    // Agencies routinely show what is DONE without showing what is still in
    // flight, so these are two switches, decided by the row.
    expect(channelFor('task', { done: false })).toBe('openTasks');
    expect(channelFor('task', { done: true })).toBe('completedTasks');
  });

  it('routes docs and files down the same channel, and updates down the timeline', () => {
    expect(channelFor('doc', {})).toBe('files');
    expect(channelFor('file', {})).toBe('files');
    // Not a channel of their own: "Timeline" already means "tell the client
    // what has been happening", and an authored update is the better answer to
    // that switch than the derived task events it replaces.
    expect(channelFor('update', {})).toBe('timeline');
  });

  it('honours the completed-task channel independently', () => {
    const done = { client_visible: true, done: true };
    expect(isClientVisible('task', done, { ...ALL_ON, openTasks: false })).toBe(true);
    expect(isClientVisible('task', done, { ...ALL_ON, completedTasks: false })).toBe(false);
  });
});

describe('clientVisible', () => {
  it('keeps only what passes both gates, in order', () => {
    const items = [
      { id: 'a', client_visible: true, done: false },
      { id: 'b', client_visible: false, done: false },
      { id: 'c', client_visible: true, done: true },
      { id: 'd', done: false },
    ];
    const out = clientVisible('task', items, { ...ALL_ON, completedTasks: false });
    expect(out.map((x) => x.id)).toEqual(['a']);
  });

  it('is empty when the channel is off, whatever is marked', () => {
    const items = [{ client_visible: true }, { client_visible: true }];
    expect(clientVisible('file', items, { ...ALL_ON, files: false })).toEqual([]);
  });
});

describe('hiddenReason / hiddenLabel — owner-facing only', () => {
  it('is null when the client can see it', () => {
    expect(hiddenReason('task', { client_visible: true }, ALL_ON)).toBeNull();
    expect(hiddenLabel(null, 'task')).toBeNull();
  });

  it('blames the MARK first, even when the channel is also off', () => {
    // Telling someone to go and flip a project switch when they simply have not
    // ticked the item would send them to the wrong screen.
    const r = hiddenReason('file', { client_visible: false }, { ...ALL_ON, files: false });
    expect(r).toBe('not-marked');
    expect(hiddenLabel(r, 'file')).toBe('Internal');
  });

  it('blames the channel when the item WAS marked', () => {
    const r = hiddenReason('file', { client_visible: true }, { ...ALL_ON, files: false });
    expect(r).toBe('channel-off');
    expect(hiddenLabel(r, 'file')).toBe('Files are switched off for this project');
  });

  it('names the right channel per kind', () => {
    const marked = { client_visible: true };
    expect(hiddenLabel(hiddenReason('task', marked, {}), 'task')).toMatch(/^Tasks are/);
    expect(hiddenLabel(hiddenReason('update', marked, {}), 'update')).toMatch(/^Updates are/);
  });
});

describe('readChannels', () => {
  it('reads the project row', () => {
    expect(readChannels({ share_open_tasks: true, share_files: true })).toMatchObject({
      openTasks: true, files: true, completedTasks: false, invoices: false,
    });
  });

  it('reads a missing or broken row as sharing NOTHING', () => {
    for (const bad of [null, undefined, {}]) {
      expect(sharesAnything(readChannels(bad))).toBe(false);
    }
  });

  it('does not accept truthy non-true column values', () => {
    expect(readChannels({ share_files: 'yes' }).files).toBe(false);
    expect(readChannels({ share_files: 1 }).files).toBe(false);
  });
});

describe('sharesAnything', () => {
  it('spots a portal link that would lead to an empty room', () => {
    // The most embarrassing failure this feature has, and the easiest to catch
    // before the owner presses send.
    expect(sharesAnything({})).toBe(false);
    expect(sharesAnything({ openTasks: false, files: false })).toBe(false);
    expect(sharesAnything({ files: true })).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import {
  parseActionLines, meetingActions, promotable, meetingDestination,
  actionsSummary, actionKey, type MeetingTask,
} from './meeting-actions';

const task = (over: Partial<MeetingTask> & Pick<MeetingTask, 'title'>): MeetingTask => ({
  taskId: 't', done: false, projectId: null, ...over,
});

describe('what counts as an action item', () => {
  it('every bracket form the document editor accepts', () => {
    const notes = '[] one\n[ ] two\n- [ ] three\n* [ ] four\n+ [ ] five';
    expect(parseActionLines(notes).map((l) => l.text)).toEqual(['one', 'two', 'three', 'four', 'five']);
  });

  it('a ticked line is an action item that is already done', () => {
    expect(parseActionLines('[x] sent it\n[X] and this')).toEqual([
      { index: 0, text: 'sent it', checked: true },
      { index: 1, text: 'and this', checked: true },
    ]);
  });

  // The whole trustworthiness of the list rests on this: prose that SOUNDS like a
  // commitment is not one. If ordinary sentences leaked in, the list would need
  // reading rather than acting on, which is the job it exists to remove.
  it('prose is never an action item, however much it sounds like one', () => {
    const notes = [
      'I will send the palette on Friday.',
      'TODO: book the photographer',
      'Action items:',
      '- send the deck',
      'we agreed to move the launch',
    ].join('\n');
    expect(parseActionLines(notes)).toEqual([]);
  });

  it('an empty checkbox is not an action item', () => {
    expect(parseActionLines('[ ] \n[ ]\n[ ]   ')).toEqual([]);
  });

  it('no notes at all is no action items', () => {
    expect(parseActionLines(null)).toEqual([]);
    expect(parseActionLines('')).toEqual([]);
  });
});

describe('pairing a line with the task it became', () => {
  it('a promoted line shows the TASK state, not the checkbox', () => {
    // The notes still say unticked; the task is done. The task wins.
    const rows = meetingActions('[ ] Send the palette', [task({ title: 'Send the palette', done: true, taskId: 'x' })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].done).toBe(true);
    expect(rows[0].task?.taskId).toBe('x');
  });

  it('pairs across case and spacing, which are noise', () => {
    const rows = meetingActions('[ ]   send   the PALETTE  ', [task({ title: 'Send the palette' })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].task).toBeDefined();
    expect(rows[0].text).toBe('Send the palette');   // the task's title is what renders
  });

  // The failure this feature must never have: making a second task for a
  // commitment that already has one.
  it('a promoted item is never offered for promotion again', () => {
    const rows = meetingActions('[ ] Send the palette\n[ ] Book the photographer', [task({ title: 'Send the palette' })]);
    expect(promotable(rows).map((r) => r.text)).toEqual(['Book the photographer']);
  });

  it('the same line written twice is one commitment', () => {
    const rows = meetingActions('[ ] Send the palette\n[ ] send the palette', []);
    expect(rows).toHaveLength(1);
  });

  // Text is the only pairing key a textarea line can have, so an edit un-pairs.
  // The task must still be visible — a commitment may fall out of the notes, it
  // must not fall out of the list.
  it('a task whose line was edited away is kept, marked as an orphan', () => {
    const rows = meetingActions('[ ] Send the palette on Friday', [task({ title: 'Send the palette', taskId: 'x' })]);
    expect(rows.map((r) => [r.text, !!r.orphan, !!r.task])).toEqual([
      ['Send the palette on Friday', false, false],
      ['Send the palette', true, true],
    ]);
  });

  it('a meeting with tasks but no notes still lists them', () => {
    const rows = meetingActions(null, [task({ title: 'Send the palette', taskId: 'x' })]);
    expect(rows.map((r) => [r.text, !!r.orphan])).toEqual([['Send the palette', true]]);
  });

  it('an already-ticked line is not offered as a task', () => {
    expect(promotable(meetingActions('[x] Already sent', []))).toEqual([]);
  });

  it('keeps notes order, orphans last', () => {
    const rows = meetingActions('[ ] b\n[ ] c', [task({ title: 'a', taskId: '1' }), task({ title: 'c', taskId: '2' })]);
    expect(rows.map((r) => r.text)).toEqual(['b', 'c', 'a']);
  });
});

describe('where a meeting task is filed', () => {
  const proj = (id: string, name: string, status = 'active') => ({ id, name, status });

  it('one running project — file it there', () => {
    expect(meetingDestination([proj('p1', 'Balluji rebrand')]))
      .toEqual({ projectId: 'p1', label: 'Balluji rebrand' });
  });

  // Wrong project > Inbox in cost: it is counted in a progress bar and may be
  // published to a client portal.
  it('two running projects — Inbox, never a guess', () => {
    expect(meetingDestination([proj('p1', 'A'), proj('p2', 'B')]))
      .toEqual({ projectId: null, label: 'Inbox' });
  });

  it('no projects — Inbox', () => {
    expect(meetingDestination([])).toEqual({ projectId: null, label: 'Inbox' });
  });

  // The rule that makes this useful for a long-standing client rather than
  // merely safe. Without it, every action item goes to Inbox forever.
  it('finished work does not count against the one live project', () => {
    expect(meetingDestination([
      proj('p1', 'Rebrand 2024', 'completed'),
      proj('p2', 'Site', 'archived'),
      proj('p3', 'Rebrand 2026'),
    ])).toEqual({ projectId: 'p3', label: 'Rebrand 2026' });
  });

  it('a paused project is still a project you can file work in', () => {
    expect(meetingDestination([proj('p1', 'On hold', 'paused')]).projectId).toBe('p1');
  });

  it('only finished projects — Inbox', () => {
    expect(meetingDestination([proj('p1', 'Done', 'completed')]).projectId).toBeNull();
  });
});

describe('the summary line', () => {
  it('is null when there is nothing, so the section can be absent', () => {
    expect(actionsSummary([])).toBeNull();
  });
  it('counts done only when some are', () => {
    expect(actionsSummary(meetingActions('[ ] a', []))).toBe('1 action item');
    expect(actionsSummary(meetingActions('[ ] a\n[x] b', []))).toBe('2 action items · 1 done');
  });
});

describe('actionKey', () => {
  it('collapses case and whitespace and nothing else', () => {
    expect(actionKey('  Send   the Palette. ')).toBe('send the palette.');
  });
});

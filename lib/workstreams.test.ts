import { describe, it, expect } from 'vitest';
import {
  progressOf, groupByStream, boardGroups, landAt, rollUp, clientStreams, clientGroups, statusOf, NO_STREAM,
  type Workstream,
} from './workstreams';
import type { ShareChannels } from './visibility';

const ws = (id: string, over: Partial<Workstream> = {}): Workstream =>
  ({ id, project_id: 'P', name: id, sort_order: 0, ...over });

const task = (id: string, over: Partial<{ done: boolean; section_id: string | null; parent_task_id: string | null; client_visible: boolean }> = {}) =>
  ({ id, done: false, section_id: null, parent_task_id: null, ...over });

const OPEN: ShareChannels = { openTasks: true, completedTasks: true };

describe('progressOf', () => {
  it('counts top-level tasks only', () => {
    // A stream with one fiddly ten-subtask task must not read as more work than
    // a stream with nine real ones.
    const p = progressOf([
      task('a', { done: true }),
      task('b'),
      task('s1', { done: true, parent_task_id: 'a' }),
      task('s2', { done: true, parent_task_id: 'a' }),
    ]);
    expect(p).toEqual({ done: 1, total: 2, pct: 50 });
  });

  it('is 0% for an empty stream, never 100%', () => {
    // "Nothing to do" and "everything done" are different states, and an empty
    // stream showing a full bar is the kind of wrong that gets quoted back at
    // you in a client meeting.
    expect(progressOf([])).toEqual({ done: 0, total: 0, pct: 0 });
  });

  it('is 100% only when every top-level task is done', () => {
    expect(progressOf([task('a', { done: true }), task('b', { done: true })]).pct).toBe(100);
  });
});

describe('groupByStream', () => {
  const streams = [ws('logo', { sort_order: 1 }), ws('packaging', { sort_order: 0 })];

  it('orders by sort_order, then name', () => {
    expect(groupByStream([], streams).map((g) => g.key)).toEqual(['packaging', 'logo']);
    const tied = [ws('b', { sort_order: 0 }), ws('a', { sort_order: 0 })];
    expect(groupByStream([], tied).map((g) => g.key)).toEqual(['a', 'b']);
  });

  it('keeps an EMPTY stream as a group', () => {
    // You cannot drag the first task into a group that only exists once
    // something is in it.
    const g = groupByStream([], [ws('logo')]);
    expect(g).toHaveLength(1);
    expect(g[0].tasks).toEqual([]);
    expect(g[0].progress.pct).toBe(0);
  });

  it('adds "unfiled" only when something is actually unfiled', () => {
    expect(groupByStream([task('a', { section_id: 'logo' })], streams).map((g) => g.key))
      .toEqual(['packaging', 'logo']);
    const withLoose = groupByStream([task('a'), task('b', { section_id: 'logo' })], streams);
    expect(withLoose.map((g) => g.key)).toEqual(['packaging', 'logo', NO_STREAM]);
    expect(withLoose[2].tasks.map((t) => t.id)).toEqual(['a']);
  });

  it('treats a task pointing at a DELETED stream as unfiled, not lost', () => {
    const g = groupByStream([task('a', { section_id: 'gone' })], streams);
    expect(g.at(-1)!.key).toBe(NO_STREAM);
    expect(g.at(-1)!.tasks.map((t) => t.id)).toEqual(['a']);
  });

  it('never puts a subtask in a group of its own', () => {
    const g = groupByStream([
      task('a', { section_id: 'logo' }),
      task('s', { section_id: 'logo', parent_task_id: 'a' }),
    ], streams);
    expect(g.find((x) => x.key === 'logo')!.tasks.map((t) => t.id)).toEqual(['a']);
  });
});

describe('the Board’s columns (boardGroups)', () => {
  const streams = [ws('logo', { sort_order: 1 }), ws('packaging', { sort_order: 0 })];

  it('is every stream in order, then "No workstream" — even when nothing is unfiled', () => {
    // On a Board the unfiled column is how a card LEAVES a stream by dragging,
    // so it cannot wait for something to be in it before it exists.
    const g = boardGroups([task('a', { section_id: 'logo' })], streams);
    expect(g.map((x) => x.key)).toEqual(['packaging', 'logo', NO_STREAM]);
    expect(g.at(-1)!.tasks).toEqual([]);
    expect(g.at(-1)!.stream).toBeNull();
  });

  it('never adds a second unfiled column', () => {
    const g = boardGroups([task('a')], streams);
    expect(g.filter((x) => x.key === NO_STREAM)).toHaveLength(1);
    expect(g.at(-1)!.tasks.map((t) => t.id)).toEqual(['a']);
  });

  it('gives a project with no streams one column to add into', () => {
    expect(boardGroups([], []).map((x) => x.key)).toEqual([NO_STREAM]);
  });

  it('leaves the List’s grouping as it was', () => {
    // The List names unfiled work only when there is some; that rule is the
    // List's, and the Board's difference must not leak back into it.
    expect(groupByStream([task('a', { section_id: 'logo' })], streams).map((x) => x.key)).toEqual(['packaging', 'logo']);
  });
});

describe('where a dropped card lands (landAt)', () => {
  it('lands after the card it was dropped on when moving DOWN a column', () => {
    expect(landAt(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a']);
  });
  it('lands before it when moving UP', () => {
    expect(landAt(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b']);
  });
  it('lands before the card at that index when coming from another column', () => {
    expect(landAt(['a', 'b'], 'x', 1)).toEqual(['a', 'x', 'b']);
  });
  it('treats past the end as the end, and below zero as the start', () => {
    expect(landAt(['a', 'b'], 'x', 99)).toEqual(['a', 'b', 'x']);
    // -1, not -3: `splice` reads a negative start as counting back from the END,
    // and only a small one shows it — -3 on two items clamps to 0 by itself,
    // which is why the first version of this line could not fail.
    expect(landAt(['a', 'b'], 'x', -1)).toEqual(['x', 'a', 'b']);
  });
  it('never holds the card twice', () => {
    const out = landAt(['a', 'b', 'c'], 'b', 1);
    expect(out.filter((x) => x === 'b')).toHaveLength(1);
    expect(out).toHaveLength(3);
  });
});

describe('rollUp', () => {
  it('weights by task count, not by stream', () => {
    // THE BUG THIS PREVENTS: averaging the stream percentages would give a
    // 2-task stream the same weight as a 40-task one, so finishing the small
    // one would move the project bar further than finishing half the big one.
    const groups = groupByStream([
      task('a', { section_id: 's1', done: true }), task('b', { section_id: 's1', done: true }),
      ...Array.from({ length: 40 }, (_, i) => task(`x${i}`, { section_id: 's2' })),
    ], [ws('s1'), ws('s2', { sort_order: 1 })]);

    expect(groups[0].progress.pct).toBe(100);
    expect(groups[1].progress.pct).toBe(0);
    // Averaging would say 50%. The truth is 2 of 42.
    expect(rollUp(groups)).toEqual({ done: 2, total: 42, pct: 5 });
  });

  it('is 0% with nothing anywhere', () => {
    expect(rollUp(groupByStream([], []))).toEqual({ done: 0, total: 0, pct: 0 });
  });
});

describe('what the client sees', () => {
  const streams = [
    ws('shown', { client_visible: true }),
    ws('internal', { client_visible: false, sort_order: 1 }),
    ws('unmarked', { sort_order: 2 }),   // migration not applied / never marked
  ];

  it('shows only marked streams, and only when the channel is on', () => {
    expect(clientStreams(streams, OPEN).map((s) => s.id)).toEqual(['shown']);
    expect(clientStreams(streams, {})).toEqual([]);
  });

  it('HIDING A STREAM HIDES EVERYTHING IN IT, whatever the tasks say', () => {
    // The point of "keep this stream entirely internal": you should not also
    // have to un-mark forty tasks, and forgetting one must not leak the
    // stream's existence.
    const tasks = [
      task('a', { section_id: 'internal', client_visible: true }),
      task('b', { section_id: 'shown', client_visible: true }),
    ];
    const g = clientGroups(tasks, streams, OPEN);
    expect(g.map((x) => x.key)).toEqual(['shown']);
    expect(g[0].tasks.map((t) => t.id)).toEqual(['b']);
  });

  it('still requires each task to be marked inside a visible stream', () => {
    const tasks = [
      task('a', { section_id: 'shown', client_visible: true }),
      task('b', { section_id: 'shown' }),
    ];
    expect(clientGroups(tasks, streams, OPEN)[0].tasks.map((t) => t.id)).toEqual(['a']);
  });

  it('never shows the client an "unfiled" group', () => {
    // That heading would expose our filing rather than their project.
    const tasks = [task('loose', { client_visible: true }), task('b', { section_id: 'shown', client_visible: true })];
    expect(clientGroups(tasks, streams, OPEN).map((g) => g.key)).toEqual(['shown']);
  });

  it('honours the completed-task channel separately', () => {
    const tasks = [task('a', { section_id: 'shown', client_visible: true, done: true })];
    // Completed tasks are off, so the one task drops out — and with nothing
    // left the whole stream goes with it (see below).
    expect(clientGroups(tasks, streams, { openTasks: true, completedTasks: false })).toEqual([]);
  });

  it('drops a visible stream that has nothing visible in it', () => {
    // The owner keeps empty streams (you must be able to drag the first task
    // into one). The client must not: a named heading with nothing under it
    // tells them work exists that they are not being shown.
    expect(clientGroups([], streams, OPEN)).toEqual([]);
    const onlyInternal = [task('a', { section_id: 'shown' })];
    expect(clientGroups(onlyInternal, streams, OPEN)).toEqual([]);
  });
});

describe('statusOf', () => {
  it('lets an explicit status win', () => {
    // "Paused" is a fact about intent that progress cannot know.
    expect(statusOf(ws('a', { status: 'paused' }), { done: 2, total: 2, pct: 100 })).toBe('paused');
  });

  it('derives completed when everything is done', () => {
    expect(statusOf(ws('a'), { done: 3, total: 3, pct: 100 })).toBe('completed');
  });

  it('derives active once something has moved', () => {
    expect(statusOf(ws('a'), { done: 1, total: 3, pct: 33 })).toBe('active');
  });

  it('says nothing about a stream nobody has started', () => {
    // A grouping with untouched work is not "active" — claiming otherwise puts
    // a status badge on every heading and makes all of them meaningless.
    expect(statusOf(ws('a'), { done: 0, total: 3, pct: 0 })).toBeNull();
    expect(statusOf(ws('a'), { done: 0, total: 0, pct: 0 })).toBeNull();
  });
});

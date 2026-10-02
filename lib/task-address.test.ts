import { describe, it, expect } from 'vitest';
import { taskClosedHref, taskOpenHref } from './task-address';

// A task opens OVER the page you are on (2026-09-21). Every opener wrote `${pathname}?task=${id}`, which threw the
// page's own settings away: open a task from the Ridgeline project, close it, and you were in the Inbox.
describe('taskOpenHref — a task opens over the page, and the page stays as it was', () => {
  it('keeps every setting of the page behind it', () => {
    expect(taskOpenHref('/tasks', '?scope=project%3Ap1&view=today', 't4')).toBe('/tasks?scope=project%3Ap1&view=today&task=t4');
    expect(taskOpenHref('/projects/p1', '?tab=tasks', 't4')).toBe('/projects/p1?tab=tasks&task=t4');
  });

  it('on a page with no settings it is just the task', () => {
    expect(taskOpenHref('/tasks', '', 't4')).toBe('/tasks?task=t4');
    expect(taskOpenHref('/', '?', 't4')).toBe('/?task=t4');
  });

  it('opening another task swaps the task, never stacks a second', () => {
    expect(taskOpenHref('/tasks', '?scope=list%3AL1&task=t1', 't2')).toBe('/tasks?scope=list%3AL1&task=t2');
  });
});

describe('taskClosedHref — closing takes the task away and nothing else', () => {
  it('returns to the page exactly as it was', () => {
    expect(taskClosedHref('/tasks', '?scope=project%3Ap1&task=t4')).toBe('/tasks?scope=project%3Ap1');
    expect(taskClosedHref('/projects/p1', '?task=t4&tab=tasks')).toBe('/projects/p1?tab=tasks');
  });

  it('a page with no settings of its own is its bare address', () => {
    expect(taskClosedHref('/tasks', '?task=t4')).toBe('/tasks');
    expect(taskClosedHref('/tasks', '')).toBe('/tasks');
  });
});

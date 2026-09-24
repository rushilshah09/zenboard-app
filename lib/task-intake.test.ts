import { describe, it, expect } from 'vitest';
import { intakeTask, INTAKE_TITLE_MAX } from './task-intake';

const base = { userId: 'u', spaceId: 's', title: 'Send the palette', fallbackTitle: 'Follow up' };

describe('intakeTask', () => {
  it('files under the project when there is one, and not in Inbox', () => {
    expect(intakeTask({ ...base, projectId: 'p1' })).toEqual({
      user_id: 'u', space_id: 's', project_id: 'p1', title: 'Send the palette', is_inbox: false,
    });
  });

  // A task in no pile at all is invisible everywhere — the one outcome intake
  // must never produce.
  it('falls to Inbox when there is no project', () => {
    expect(intakeTask(base).is_inbox).toBe(true);
    expect(intakeTask({ ...base, projectId: null }).is_inbox).toBe(true);
  });

  it('never writes a blank title', () => {
    expect(intakeTask({ ...base, title: '   ' }).title).toBe('Follow up');
  });

  it('clamps a title taken from prose', () => {
    expect(intakeTask({ ...base, title: 'x'.repeat(500) }).title).toHaveLength(INTAKE_TITLE_MAX);
  });

  // Rule 1, asserted as an absence: nothing here may put a task on today.
  it('sets no scheduled date', () => {
    expect(Object.keys(intakeTask({ ...base, projectId: 'p1' })).sort())
      .toEqual(['is_inbox', 'project_id', 'space_id', 'title', 'user_id']);
  });
});

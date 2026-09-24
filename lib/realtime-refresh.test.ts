import { describe, it, expect } from 'vitest';
import { initialSync, onRowChange, onVisibilityChange, type SyncState, type Visibility } from './realtime-refresh';

/** Drive the rule the way the component does, counting refreshes. */
function run(steps: ({ kind: 'change' } | { kind: 'visibility'; to: Visibility })[], start: Visibility = 'visible') {
  let state: SyncState = initialSync;
  let visibility = start;
  let refreshes = 0;
  for (const s of steps) {
    if (s.kind === 'change') {
      const r = onRowChange(state, visibility);
      state = r.state;
      if (r.action === 'refresh') refreshes++;
    } else {
      visibility = s.to;
      const r = onVisibilityChange(state, visibility);
      state = r.state;
      if (r.action === 'refresh') refreshes++;
    }
  }
  return { refreshes, state };
}
const change = { kind: 'change' } as const;
const to = (v: Visibility) => ({ kind: 'visibility', to: v }) as const;

describe('realtime refresh gating', () => {
  it('refreshes immediately while the tab is visible', () => {
    expect(run([change]).refreshes).toBe(1);
  });

  it('does not refresh a hidden tab — it renders nothing', () => {
    expect(run([to('hidden'), change]).refreshes).toBe(0);
  });

  it('NEVER DROPS an update: a change while hidden refreshes on return', () => {
    expect(run([to('hidden'), change, to('visible')]).refreshes).toBe(1);
  });

  it('collapses many hidden changes into exactly ONE refresh', () => {
    // The whole point. A tab left open through a busy afternoon used to pay a
    // full server wave per edit; it now pays one when the user looks at it.
    const { refreshes } = run([to('hidden'), change, change, change, change, change, to('visible')]);
    expect(refreshes).toBe(1);
  });

  it('a tab switch with nothing missed costs nothing', () => {
    // The regression that would make this change a net loss.
    expect(run([to('hidden'), to('visible'), to('hidden'), to('visible')]).refreshes).toBe(0);
  });

  it('going hidden never refreshes, and never forgets what is owed', () => {
    const afterChange = onRowChange(initialSync, 'hidden');
    expect(afterChange.state.missed).toBe(true);
    const goHidden = onVisibilityChange(afterChange.state, 'hidden');
    expect(goHidden.action).toBe('none');
    expect(goHidden.state.missed, 'the pending refresh was forgotten').toBe(true);
  });

  it('resumes normal per-change refreshing once visible again', () => {
    expect(run([to('hidden'), change, to('visible'), change, change]).refreshes).toBe(3);
  });
});

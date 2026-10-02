import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// The New space dialog's Type picker was a hand-rolled segmented control: a raised
// track (`bg-paper-3`) holding a selected option in the darker BAND tone
// (`bg-paper-2`), so the chosen type read as pressed IN rather than lifted — in both
// themes — and it rendered the stored enum raw, shouting WORK / LIFE / SIDE with
// letter-spacing in an app whose every string is sentence case. The DS already has
// the control: `SegmentedControl` (Radix RadioGroup — a real radiogroup, one tab stop,
// arrows move and select) with its thumb on `--color-surface-thumb`, lifted out of a
// well in both themes. Settings → Appearance uses it for the same kind of choice.
const src = readFileSync('components/shell/new-space-modal.tsx', 'utf8');

describe('the New space type picker', () => {
  it('is the DS SegmentedControl, not a hand-rolled radio group', () => {
    expect(src).toMatch(/<SegmentedControl\b[\s\S]*?aria-label="Type"/);
    // No hand-rolled radio buttons anywhere in the dialog's Type field.
    expect(src).not.toMatch(/role="radio"[^>]*aria-checked=\{tag === t\}/);
  });

  it('shows sentence-case labels, never the stored enum', () => {
    // The values stay the enum (they are data); only what the reader sees changes.
    for (const label of ['Work', 'Life', 'Side']) expect(src).toContain(`'${label}'`);
    expect(src).not.toMatch(/tracking-\[0\.04em\]/);
    expect(src).not.toMatch(/>\s*\{t\}\s*</);
  });

  it('calls the thing a workspace, as the menu that opens it does', () => {
    // The account menu lists "Workspaces" and offers "New workspace"; breadcrumbs say
    // "Search workspaces…" and Settings has a "Workspace" section — and this dialog,
    // opened by that very item, was titled "New space" with a "Create space" button.
    // One concept, one name. (Code identifiers — `new-space-modal`, `spaces` — stay.)
    expect(src).toMatch(/title="New workspace"/);
    expect(src).not.toMatch(/New space|Create space/);
  });
});

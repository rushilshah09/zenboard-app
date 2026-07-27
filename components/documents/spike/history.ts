// M0 spike — unified app-level history (Gate B). One stack for BOTH text edits
// (coalesced typing runs) and structural ops (split/merge/move/convert). PM's
// own history is not installed; every mutation flows through here.
//
// Steps store shallow before/after snapshots of the whole block array. Blocks
// are immutable objects, so a snapshot is an array of references — cheap at
// 2k blocks, trivially correct. M1 can move to diffs if memory ever matters.
import type { SpikeBlock } from './rich';

export type Caret = { id: string; offset: number } | null;

export type Step = {
  label: string;               // 'typing' | 'convert' | 'split' | 'merge' | 'move' | …
  before: SpikeBlock[]; after: SpikeBlock[];
  caretBefore: Caret; caretAfter: Caret;
  blockId?: string;            // typing runs: which block, for coalescing
  ts: number;
};

const COALESCE_MS = 1000; // PRD §5.4: a pause > 1s breaks a typing run

export class History {
  private undoStack: Step[] = [];
  private redoStack: Step[] = [];

  get depth() { return this.undoStack.length; }
  get lastLabel() { return this.undoStack[this.undoStack.length - 1]?.label ?? '—'; }

  // Coalesced text edit: extends the top step when it's the same block's
  // typing run and the pause is under 1s; otherwise starts a new step.
  typing(blockId: string, before: SpikeBlock[], after: SpikeBlock[], caretBefore: Caret, caretAfter: Caret) {
    const now = performance.now();
    const top = this.undoStack[this.undoStack.length - 1];
    if (top && top.label === 'typing' && top.blockId === blockId && now - top.ts < COALESCE_MS) {
      top.after = after; top.caretAfter = caretAfter; top.ts = now;
    } else {
      this.undoStack.push({ label: 'typing', blockId, before, after, caretBefore, caretAfter, ts: now });
    }
    this.redoStack = [];
  }

  // Structural step — never coalesces (PRD §5.4: each exactly one step).
  push(label: string, before: SpikeBlock[], after: SpikeBlock[], caretBefore: Caret, caretAfter: Caret) {
    this.undoStack.push({ label, before, after, caretBefore, caretAfter, ts: performance.now() });
    this.redoStack = [];
  }

  // Any structural op also ends the current typing run.
  breakRun() {
    const top = this.undoStack[this.undoStack.length - 1];
    if (top) top.ts = -Infinity;
  }

  undo(): Step | null {
    const s = this.undoStack.pop();
    if (!s) return null;
    this.redoStack.push(s);
    return s;
  }

  redo(): Step | null {
    const s = this.redoStack.pop();
    if (!s) return null;
    this.undoStack.push(s);
    return s;
  }
}

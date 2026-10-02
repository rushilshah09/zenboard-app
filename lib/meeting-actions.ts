// THE one rule for "what did this meeting commit us to?" — PRODUCT_THINKING.md §8
// (meeting → notes → action items → tasks), read side.
//
// THE DECISION: an action item is not a new object. §8 says action items BECOME
// tasks, and the plan's own law is that information is never entered twice — so a
// staging row that exists only to be copied into `tasks` would be the second entry.
// An action item is therefore one of exactly two things:
//
//   a CHECKLIST LINE in the meeting's notes — written while you were listening,
//   or a TASK — the same commitment, once you have promoted it.
//
// Nothing else is guessed. A parser that also caught "I'll send the palette" would
// be right often enough to be trusted and wrong often enough to poison the list,
// and a list of commitments is worthless the moment it contains something you did
// not commit to. `[ ]` is the whole contract, and it is the SAME contract
// `lib/blocks.ts` already gives the word `[]` at the start of a document block —
// one vocabulary for a checkbox, wherever you type one.
//
// The pairing between the two halves is by NORMALISED TEXT, because a line in a
// textarea has no id to anchor to (a doc block would — see the note at the bottom
// of this file). Editing a promoted line therefore un-pairs it; that is why a task
// whose line has gone is APPENDED rather than dropped. A commitment may fall out
// of your notes; it must never fall out of this list.

/** A checklist line found in the notes. `index` is its line number in the notes. */
export type ActionLine = { index: number; text: string; checked: boolean };

/** A task this meeting has already produced. */
export type MeetingTask = {
  taskId: string;
  title: string;
  done: boolean;
  projectId: string | null;
};

/** A meeting→task edge as the Clients page loads it. */
export type MeetingTaskRow = MeetingTask & { meetingId: string };

/** One row of the Action items list — a commitment, in either of its two forms. */
export type MeetingAction = {
  /** Normalised text; also the React key and the pairing key. */
  key: string;
  /** What to render — the task's title once promoted, so a renamed task wins. */
  text: string;
  done: boolean;
  /** Set once this commitment is a task. Absent ⇒ it can still become one. */
  task?: MeetingTask;
  /** A task whose notes line is gone (edited or deleted) — kept, never dropped. */
  orphan?: boolean;
};

// Optional list marker, then `[]`, `[ ]`, `[x]` or `[X]`, then the text. The
// bracket forms are exactly the ones `markdownPrefix` accepts and `serialize`
// writes, so a checkbox pasted out of a Zenboard doc lands here as a checkbox.
const LINE = /^\s*(?:[-*+]\s+)?\[([ xX]?)\]\s+(\S.*)$/;

/** The pairing key. Case and spacing are noise; anything else is a different line. */
export function actionKey(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Task titles are clamped at the same 200 chars every other intake path uses. */
export const ACTION_TITLE_MAX = 200;

/** Every checklist line in the notes, in the order they were written. */
export function parseActionLines(notes: string | null | undefined): ActionLine[] {
  if (!notes) return [];
  const out: ActionLine[] = [];
  notes.split('\n').forEach((raw, index) => {
    const m = LINE.exec(raw);
    if (!m) return;
    out.push({ index, text: m[2].trim().slice(0, ACTION_TITLE_MAX), checked: m[1] === 'x' || m[1] === 'X' });
  });
  return out;
}

/**
 * The list the panel renders: notes order first, then any task whose line has
 * gone. A line already promoted shows the TASK's state, never the checkbox's —
 * the task is where the work actually lives, and two sources of truth for "is
 * this done" is how a list starts lying.
 */
export function meetingActions(notes: string | null | undefined, tasks: MeetingTask[]): MeetingAction[] {
  const byKey = new Map<string, MeetingTask>();
  for (const t of tasks) {
    const k = actionKey(t.title);
    if (!byKey.has(k)) byKey.set(k, t);   // first wins; a duplicate task is not a second row
  }

  const seen = new Set<string>();
  const rows: MeetingAction[] = [];
  for (const line of parseActionLines(notes)) {
    const key = actionKey(line.text);
    if (!key || seen.has(key)) continue;  // the same line twice is one commitment
    seen.add(key);
    const task = byKey.get(key);
    rows.push(task
      ? { key, text: task.title, done: task.done, task }
      : { key, text: line.text, done: line.checked });
  }

  for (const t of tasks) {
    const key = actionKey(t.title);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ key, text: t.title, done: t.done, task: t, orphan: true });
  }
  return rows;
}

/**
 * The notes with new action lines at the end — how an accepted suggestion (lib/meeting-suggest.ts)
 * becomes an action item. It is written as a line, in the one `[ ]` form this file parses, rather
 * than as a task or a side list: the notes stay the single place a commitment is written down, and
 * everything downstream (the list, "Make task", the pairing) already knows what to do with a line.
 */
export function appendActionLines(notes: string | null | undefined, texts: string[]): string {
  const lines = texts.map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean).map((t) => `[ ] ${t}`);
  const base = (notes ?? '').replace(/\s+$/, '');
  if (!lines.length) return notes ?? '';
  return base ? `${base}\n${lines.join('\n')}` : lines.join('\n');
}

/** The ones a click would turn into tasks: not yet a task, not already ticked. */
export function promotable(rows: MeetingAction[]): MeetingAction[] {
  return rows.filter((r) => !r.task && !r.done);
}

/**
 * Where a task from this meeting is filed.
 *
 * A meeting belongs to a CLIENT and a task is filed under a PROJECT, so the two
 * only line up when the client has exactly one project still running. Anything
 * else goes to Inbox, which is the one destination that is always correct and
 * always found — `lib/actions/forms.ts` and `lib/actions/portal.ts` already file
 * outside work this way. Guessing between three projects would be wrong two
 * times in three, and a task filed into the wrong project is worse than one in
 * Inbox: it is counted in that project's progress and may be published to that
 * client's portal.
 *
 * FINISHED PROJECTS DO NOT COUNT, which is what makes the rule useful rather
 * than merely safe: a client you have worked with for two years has one live
 * project and four finished ones, and "more than one project" would send every
 * action item to Inbox forever.
 *
 * The panel and the server BOTH call this. The browser's project list is a
 * snapshot, so the row that gets written is decided against the database — but
 * against the same rule, or the panel would promise a destination the server
 * would not honour.
 */
const RUNNING = (status: string) => status !== 'completed' && status !== 'archived';

export function meetingDestination(
  projects: { id: string; name: string; status: string }[],
): { projectId: string | null; label: string } {
  const live = projects.filter((p) => RUNNING(p.status));
  return live.length === 1
    ? { projectId: live[0].id, label: live[0].name }
    : { projectId: null, label: 'Inbox' };
}

/** "3 action items · 1 done" — the section's one-line summary, or null when empty. */
export function actionsSummary(rows: MeetingAction[]): string | null {
  if (!rows.length) return null;
  const done = rows.filter((r) => r.done).length;
  const items = `${rows.length} action item${rows.length === 1 ? '' : 's'}`;
  return done ? `${items} · ${done} done` : items;
}

// WHEN MEETING NOTES BECOME A DOC (MASTER_PRODUCT_PLAN §7D, Phase 4), the pairing
// key stops being text and becomes the block id — `comments.block_id` and
// `lib/block-link.ts` already anchor to blocks exactly that way, and `mentions`
// already carries an `anchor` column for it. Only `actionKey` and the two lookups
// above change; nothing that calls this file does.

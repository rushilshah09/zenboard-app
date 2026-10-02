// THE milestone rules — master plan §7E, migration 0036. Pure: no React, no
// Supabase, so the Overview card, the server action and (next sprint) the
// calendar all answer "what's next?" and "is this late?" the same way.
//
// A milestone is a DATED CHECKPOINT, which is what separates it from a task: it
// has no assignee, no estimate, no subtasks and no status beyond done. §7E calls
// the project a "memory surface", and a milestone is the part of that memory
// that says *when this was supposed to matter*.
import { todayISO } from '@/lib/date';

export type Milestone = {
  id: string;
  title: string;
  done: boolean;
  /** Calendar date (`YYYY-MM-DD`) or null — a checkpoint you haven't dated yet. */
  due_date: string | null;
  sort_order: number;
};

export type MilestoneState =
  /** Complete. Nothing about its date matters any more. */
  | 'done'
  /** Dated, past, not done. */
  | 'overdue'
  /** Dated today. */
  | 'today'
  /** Dated in the future. */
  | 'upcoming'
  /** No date yet — a checkpoint someone has not committed to. */
  | 'undated';

export function milestoneState(m: Milestone, today: string = todayISO()): MilestoneState {
  if (m.done) return 'done';
  if (!m.due_date) return 'undated';
  if (m.due_date < today) return 'overdue';
  if (m.due_date === today) return 'today';
  return 'upcoming';
}

/**
 * Reading order: soonest first, undated last, done at the bottom.
 *
 * Done milestones sink rather than disappear because a project's checkpoints are
 * its history — §7E's "what did we agree" — and a list that empties as you
 * finish it tells you nothing about the shape of the engagement.
 *
 * Comparisons on `due_date` are plain string comparisons: these are `YYYY-MM-DD`
 * calendar dates, which sort lexicographically, and parsing them into `Date`
 * would reintroduce the timezone question that lib/date.ts exists to end.
 */
export function sortMilestones(list: Milestone[]): Milestone[] {
  return [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.due_date && b.due_date) {
      if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
    } else if (a.due_date !== b.due_date) {
      return a.due_date ? -1 : 1;   // dated before undated
    }
    return a.sort_order - b.sort_order;
  });
}

/**
 * The one the Overview leads with: the soonest incomplete DATED checkpoint.
 *
 * Undated milestones can never be "next" — "next" is a claim about time, and an
 * undated checkpoint makes no claim. An overdue one still counts, and counts
 * first: the thing you have already missed is more urgent than the thing you
 * have not, and hiding it would make the line comforting instead of true.
 */
export function nextMilestone(list: Milestone[]): Milestone | null {
  const dated = list.filter((m) => !m.done && m.due_date);
  if (!dated.length) return null;
  return sortMilestones(dated)[0];
}

/** `{ done, total }` for the quiet count on the Overview. */
export function milestoneProgress(list: Milestone[]): { done: number; total: number } {
  return { done: list.filter((m) => m.done).length, total: list.length };
}

// ── The calendar projection (§7E: "dated checkpoints rendering on Overview +
// Calendar") ───────────────────────────────────────────────────────────────

/**
 * A milestone as the calendar needs it: its own fields plus the project it
 * belongs to, because on a calendar a checkpoint with no project is an orphan
 * date — "Design sign-off" means nothing without "Ridgeline rebrand" beside it.
 */
export type CalendarMilestone = Milestone & {
  /** Always present here: `milestonesForCalendar` drops undated ones. */
  due_date: string;
  projectId: string;
  projectName: string;
  projectColor: string | null;
};

/**
 * Bucket milestones by day for a grid.
 *
 * UNDATED CHECKPOINTS ARE DROPPED, not placed at some fallback date. A calendar
 * asserts "this is when"; a milestone with no date has no when, and putting it
 * on today would be inventing a commitment the user never made.
 *
 * `from`/`to` are inclusive/exclusive calendar dates. String comparison again —
 * these are `YYYY-MM-DD`, and `new Date(...)` here would reintroduce the
 * timezone question lib/date.ts exists to end.
 */
export function milestonesForCalendar(
  list: CalendarMilestone[],
  from: string,
  to: string,
): Map<string, CalendarMilestone[]> {
  const out = new Map<string, CalendarMilestone[]>();
  for (const m of list) {
    if (!m.due_date || m.due_date < from || m.due_date >= to) continue;
    const day = out.get(m.due_date);
    if (day) day.push(m);
    else out.set(m.due_date, [m]);
  }
  // Within a day: open before done, then by title, so a day with several reads
  // in a stable order rather than in whatever order the query returned.
  for (const day of out.values()) {
    day.sort((a, b) => (a.done !== b.done ? (a.done ? 1 : -1) : a.title.localeCompare(b.title)));
  }
  return out;
}

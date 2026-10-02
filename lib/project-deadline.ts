// THE one answer to "what is this project's next deadline?".
//
// ── WHY IT LEFT THE COMPONENT ──────────────────────────────────────────────
// This was eight lines inside `projects-workspace.tsx`, and it had two
// problems that only showed up when a third source of dates arrived.
//
// It was UNTESTABLE — a rule about precedence and time, buried in a 1600-line
// component behind a Supabase read. And it was NON-DETERMINISTIC on a tie:
// `sort((a, b) => (a.date < b.date ? -1 : 1))` never returns 0, so two
// candidates on the same day resolved in whatever order they were pushed,
// which is to say in whatever order the database returned them.
//
// Three kinds of thing now claim a date on a project, and they are not equally
// consequential:
//
//   PROJECT    the deadline for the whole engagement
//   WORKSTREAM a phase's own deadline (0040's `due_date`, wired 2026-09-10)
//   TASK       a scheduled piece of work
//
// On the same day the LARGEST container wins, because that is the one whose
// name means the most in a sentence like "next: 12 Sep — Ridgeline rebrand".
// A task called "Send file" beating "Project deadline" on the same date told
// you the least useful true thing available.
import { todayISO } from '@/lib/date';

/** Ranked most consequential first — this order IS the tie-break. */
export const DEADLINE_RANK = ['project', 'workstream', 'task'] as const;
export type DeadlineKind = (typeof DEADLINE_RANK)[number];

export type DeadlineCandidate = {
  /** A calendar date, `YYYY-MM-DD`. */
  date: string;
  label: string;
  kind: DeadlineKind;
};

export type NextDeadline = DeadlineCandidate | null;

/**
 * The soonest date still ahead of us, or null.
 *
 * PAST DATES ARE DROPPED, including today's? No — today COUNTS. A deadline
 * that is today is the most urgent thing a project has, and treating it as
 * gone would hide it on the one day it matters most. Yesterday is gone: it is
 * no longer a claim about the future, and the overdue work itself is what
 * surfaces then (see `projectHealth`).
 *
 * Comparisons are plain string comparisons: these are `YYYY-MM-DD` calendar
 * dates, which sort lexicographically. Parsing them into `Date` would
 * reintroduce the timezone question lib/date.ts exists to end.
 */
export function nextDeadline(candidates: DeadlineCandidate[], today: string = todayISO()): NextDeadline {
  const ahead = candidates.filter((c) => c.date >= today);
  if (ahead.length === 0) return null;
  return ahead.slice().sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return DEADLINE_RANK.indexOf(a.kind) - DEADLINE_RANK.indexOf(b.kind);
  })[0];
}

/**
 * Gather the candidates from a project's parts.
 *
 * Kept separate from `nextDeadline` so the SELECTION rule can be tested
 * without staging a project, and so a caller that already has candidates
 * (the calendar, later) does not have to invent tasks to pass in.
 *
 * A FINISHED workstream contributes nothing: its date stopped being a claim
 * about the future the moment the work under it was done. An EMPTY one still
 * counts — nothing has been done, so nothing has been finished, and a phase
 * you have not started is exactly the one whose deadline you want to see.
 */
export function deadlineCandidates(input: {
  project: { deadline?: string | null; deadline_label?: string | null };
  openTasks: { title: string; scheduled_date?: string | null }[];
  streams: { name: string; due_date?: string | null; done: number; total: number }[];
}): DeadlineCandidate[] {
  const out: DeadlineCandidate[] = [];
  if (input.project.deadline) {
    out.push({
      date: input.project.deadline,
      label: input.project.deadline_label?.trim() || 'Project deadline',
      kind: 'project',
    });
  }
  for (const s of input.streams) {
    if (!s.due_date) continue;
    if (s.total > 0 && s.done === s.total) continue;
    out.push({ date: s.due_date, label: s.name, kind: 'workstream' });
  }
  for (const t of input.openTasks) {
    if (!t.scheduled_date) continue;
    out.push({ date: t.scheduled_date, label: t.title, kind: 'task' });
  }
  return out;
}

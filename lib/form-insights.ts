// THE one projection of "how is this form doing?".
//
// Every number about a form is computed here and nowhere else. Before, the
// Responses screen worked five of them out inline while the Forms hub counted
// its own; the two already disagreed about what "responses" meant (the hub
// counted completes, the screen showed starts under a heading that said
// "Responses"). A number that means one thing on one screen and another thing
// two clicks away is worse than no number.
//
// WHAT EACH ONE HONESTLY MEANS is the whole difficulty, so it is written down:
//
//   visits      — link opens. A coarse +1 per server render, so it includes the
//                 owner testing their own form and double-counts a refresh. It
//                 is a scale, not a metric, and nothing is divided by it that
//                 gets called a conversion rate.
//   starts      — someone typed something. One row in `form_responses`, partial
//                 or complete. This is the honest denominator.
//   completed   — they pressed submit.
//   completion  — completed ÷ STARTS, never ÷ visits. Dividing by visits would
//                 quietly punish a form for being opened.
//   unique      — distinct people, best-effort (see `respondentKey`).
//   medianTime  — the middle completed response, not the mean: one person who
//                 left the tab open over lunch moves a mean by minutes.
//   dropOff     — where unfinished attempts stopped. The single most actionable
//                 thing this data can say.
import type { Answers, AnswerValue } from '@/lib/form-schema';

export type InsightResponse = {
  id: string;
  status: 'partial' | 'complete';
  answers: Answers;
  respondent: { name?: string; email?: string } | null;
  meta: { duration_s?: number; last_field_id?: string };
  createdAt: string;
};

export type FormInsights = {
  visits: number;
  starts: number;
  completed: number;
  partials: number;
  completion: number;      // 0–100, integer
  unique: number;
  medianTime: number;      // seconds; 0 when nothing has been timed
  dropOff: { fieldId: string; count: number }[];
};

/**
 * Who a response came from, for counting distinct people.
 *
 * Best-effort and deliberately conservative: an email identifies a person, a
 * trimmed lowercase name is the next best guess, and anything else counts as
 * its own person. Erring toward MORE uniques is the honest direction — merging
 * two real people because they share a first name would overstate reach, while
 * splitting one person who filled the form twice only understates it.
 */
export function respondentKey(r: InsightResponse): string {
  const email = r.respondent?.email?.trim().toLowerCase();
  if (email) return `e:${email}`;
  const name = r.respondent?.name?.trim().toLowerCase();
  if (name) return `n:${name}`;
  return `r:${r.id}`;
}

/** The median of a numeric list. Even lengths take the lower middle — with a
 *  handful of responses, averaging two real durations invents a third. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

export function formInsights(responses: InsightResponse[], visits: number): FormInsights {
  const completed: InsightResponse[] = [];
  const partials: InsightResponse[] = [];
  for (const r of responses) (r.status === 'complete' ? completed : partials).push(r);

  const durations = completed
    .map((r) => r.meta?.duration_s)
    .filter((d): d is number => typeof d === 'number' && Number.isFinite(d) && d > 0);

  const tally = new Map<string, number>();
  for (const r of partials) {
    const id = r.meta?.last_field_id;
    if (!id) continue;
    tally.set(id, (tally.get(id) ?? 0) + 1);
  }

  return {
    visits,
    starts: responses.length,
    completed: completed.length,
    partials: partials.length,
    completion: responses.length ? Math.round((completed.length / responses.length) * 100) : 0,
    unique: new Set(responses.map(respondentKey)).size,
    medianTime: median(durations),
    dropOff: [...tally.entries()]
      .map(([fieldId, count]) => ({ fieldId, count }))
      // Ties broken by field id so the order is stable between renders — a list
      // that reshuffles on every refresh reads as data changing when it hasn't.
      .sort((a, b) => b.count - a.count || a.fieldId.localeCompare(b.fieldId)),
  };
}

/** One question's answers, newest first — the per-question read the Insights
 *  tab shows under the headline numbers. */
export type AnswerRow = { responseId: string; text: string; at: string };

/**
 * Every non-empty answer to one question.
 *
 * Blanks are dropped rather than shown as "–": the count beside the question
 * ("9 answers") has to mean nine people said something, or an optional field
 * looks as answered as a required one.
 */
export function answersFor(
  responses: InsightResponse[],
  fieldId: string,
  toText: (value: AnswerValue) => string,
): AnswerRow[] {
  const rows: AnswerRow[] = [];
  for (const r of responses) {
    if (r.status !== 'complete') continue;
    const text = toText(r.answers?.[fieldId] ?? null).trim();
    if (!text) continue;
    rows.push({ responseId: r.id, text, at: r.createdAt });
  }
  return rows;
}

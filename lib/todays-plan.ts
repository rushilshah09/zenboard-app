// THE rule for which tasks make up today's plan.
//
// Home drew it as `scheduled_date = today OR (highlight AND no date)`: the ★ is
// "the day's one important thing", so an undated one belongs to whichever day
// you are looking at. The morning digest drew it as `scheduled_date = today`
// and silently dropped the star — two answers to "what am I doing today", and
// the MCP `today` tool, which reads the digest's loader, would have inherited
// the narrower one.
//
// One rule, in both of the shapes it is needed in:
//   - `todaysPlanFilter` — the PostgREST `or()` clause, for a query
//   - `isOnTodaysPlan`   — the same test in JS, for rows already in memory
// They sit side by side so they cannot drift apart unnoticed, and a test holds
// each to the other.
//
// Top-level only is NOT part of this rule: every caller scopes to
// `parent_task_id is null` itself, because a subtask is part of its parent's
// plan rather than a line of its own.

export type PlanTask = { scheduled_date: string | null; highlight?: boolean | null };

/** The `or()` clause — combine with other clauses by joining with a comma. */
export const todaysPlanFilter = (today: string): string =>
  `scheduled_date.eq.${today},and(highlight.eq.true,scheduled_date.is.null)`;

/** The same rule, for a row already fetched. */
export const isOnTodaysPlan = (t: PlanTask, today: string): boolean =>
  t.scheduled_date === today || (!!t.highlight && !t.scheduled_date);

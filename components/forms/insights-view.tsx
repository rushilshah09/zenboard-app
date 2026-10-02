'use client';
// Insights — what the form is doing, as opposed to who filled it in.
//
// TWO TABS, NOT ONE. This used to be the top half of the Responses screen: five
// numbers, a drop-off list and a table, all under one heading. That screen was
// answering two different questions at once — "is this form working?" and "what
// did Priya say?" — and the second one always won, because the table is the
// thing that grows. Splitting them means the numbers get room and the table
// gets to be a table.
//
// BENCHMARK (rule 7). Tally opens a form on Insights with four cards (Visits,
// Submissions, Unique respondents, Visit duration) and then lists every answer
// under its question, which is the part people actually read — you scan the
// answers, not the ratios. Typeform leads with a completion funnel chart.
// We take Tally's shape and deliberately drop its "Visits" time series: we
// store a view COUNTER, not per-visit timestamps, so a visits-over-time chart
// would be a control drawn from data we do not have.
//
// EVERY NUMBER HERE COMES FROM lib/form-insights.ts. None of them are worked
// out in this file — that is the rule that keeps the hub's "2 responses" and
// this screen's headline meaning the same thing.
import { useMemo, useState } from 'react';
import { ChevronRight, ClipboardList } from '@/components/ds/icons';
import { Icon, Stat, EmptyState } from '@/components/ds/ui';
import { formatDayTime, formatMinutes } from '@/lib/date';
import { formInsights, answersFor, type InsightResponse } from '@/lib/form-insights';
import { answerToText, isField, type FormBlock } from '@/lib/form-schema';
import { cn } from '@/lib/cn';

/** How many answers a question shows before it asks to be expanded. */
const PREVIEW = 5;

// Sub-minute resolution matters here and nowhere else in the app — a form
// filled in 45 seconds is a different fact from one that took a minute — so the
// seconds branch is local; everything above a minute goes through the
// vocabulary, which is where the hour arithmetic belongs.
const fmtDuration = (s: number) => {
  if (!s || s < 1) return null;
  if (s < 60) return `${s}s`;
  return formatMinutes(Math.floor(s / 60));
};

function Question({ block, rows }: { block: FormBlock; rows: { responseId: string; text: string; at: string }[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, PREVIEW);
  const hidden = rows.length - shown.length;

  return (
    <section className="border-t border-line-soft py-5">
      <h3 className="text-ui font-medium text-ink-900">{block.label || 'Untitled question'}</h3>
      <p className="mt-0.5 text-meta text-ink-500">
        <span className="tabular-nums">{rows.length}</span> {rows.length === 1 ? 'answer' : 'answers'}
      </p>

      {rows.length === 0 ? (
        <p className="mt-3 text-ui text-ink-500">Nobody has answered this one yet.</p>
      ) : (
        <div className="mt-3">
          {shown.map((a) => (
            <div key={a.responseId} className="flex items-baseline gap-4 border-b border-line-soft py-2 last:border-0">
              <span className="min-w-0 flex-1 whitespace-pre-wrap text-ui text-ink-800">{a.text}</span>
              <span className="shrink-0 tabular-nums text-meta text-ink-500">{formatDayTime(a.at)}</span>
            </div>
          ))}
          {hidden > 0 && (
            <button type="button" onClick={() => setAll(true)}
              className="focus-ring mt-1 flex h-8 items-center gap-1.5 rounded-sm px-1 text-meta text-ink-500 transition-colors duration-fast hover:text-ink-800">
              <Icon icon={ChevronRight} size={12} aria-hidden />
              Show {hidden} more
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export function InsightsView({ form, responses }: {
  form: { id: string; title: string; status: 'draft' | 'live' | 'closed'; blocks: FormBlock[]; views: number };
  responses: InsightResponse[];
}) {
  const questions = useMemo(() => form.blocks.filter((b) => isField(b.type)), [form.blocks]);
  const insights = useMemo(() => formInsights(responses, form.views), [responses, form.views]);

  // Drop-off ids become question labels here rather than in the projection: the
  // projection counts, this file speaks. A field deleted after someone quit on
  // it still has to say something rather than render a bare uuid.
  const dropOff = useMemo(
    () => insights.dropOff.map((d) => ({
      ...d,
      label: questions.find((q) => q.id === d.fieldId)?.label || 'A question that has since been deleted',
    })),
    [insights.dropOff, questions],
  );

  if (insights.starts === 0) {
    return (
      <div className="mx-auto w-full max-w-[880px] px-5 py-10 sm:px-8">
        <EmptyState
          illustration={<Icon icon={ClipboardList} size={20} />}
          title="Nothing to report yet."
          description={form.status === 'live'
            ? 'Share the link and the numbers start here.'
            : 'Publish the form to start collecting.'}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[880px] px-5 py-8 sm:px-8">
      {/* The headline four. `Stat` renders "–" rather than "0" for null, which
          is why medianTime passes null when nothing has been timed: a form
          whose responses predate timing did not take zero seconds. */}
      <div className="grid grid-cols-2 gap-6 border-b border-line-soft pb-6 sm:grid-cols-4">
        <Stat label="Visits" value={String(insights.visits)} />
        <Stat label="Responses" value={String(insights.completed)} />
        <Stat label="Unique people" value={String(insights.unique)} />
        <Stat label="Median time" value={fmtDuration(insights.medianTime)} />
      </div>

      {/* Completion is its own line, not a fifth card, because it is a RATIO of
          two numbers already on screen and deserves to say which two. */}
      <p className="py-4 text-ui text-ink-600">
        <span className="font-medium tabular-nums text-ink-900">{insights.completion}%</span> of the{' '}
        <span className="tabular-nums">{insights.starts}</span> {insights.starts === 1 ? 'person' : 'people'} who started finished.
        {insights.partials > 0 && (
          <> <span className="tabular-nums">{insights.partials}</span> {insights.partials === 1 ? 'is' : 'are'} still in progress.</>
        )}
      </p>

      {dropOff.length > 0 && (
        <div className="mb-2 rounded-lg border border-line-soft p-4">
          <span className="text-overline text-ink-500">Where people stop</span>
          <div className="mt-2">
            {dropOff.map((d) => (
              <div key={d.fieldId} className="flex items-baseline gap-3 border-b border-line-soft py-2 last:border-0">
                <span className="min-w-0 flex-1 truncate text-ui text-ink-800">{d.label}</span>
                <span className="shrink-0 tabular-nums text-meta text-ink-500">
                  {d.count} {d.count === 1 ? 'person' : 'people'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={cn(questions.length > 0 && 'mt-4')}>
        {questions.map((q) => (
          <Question key={q.id} block={q} rows={answersFor(responses, q.id, (v) => answerToText(q, v))} />
        ))}
      </div>
    </div>
  );
}

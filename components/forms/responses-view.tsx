'use client';
// Responses — the owner's read of what came back. A Linear-grade table (newest
// first, keyboard ↑↓ ⏎) with the full answer set in the app's one-drawer pattern.
//
// Partials are kept out of the default view on purpose: they're in-progress
// attempts, not results. They stay one filter click away because they're how you
// learn where people give up.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, Trash, FileText, SquareCheck, Check } from '@/components/ds/icons';
import {
  Icon, Button, IconButton, Badge, Drawer, SegmentedControl, EmptyState,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, toast,
} from '@/components/ds/ui';
import { deleteResponse, makeTaskFromResponse, signFormUpload } from '@/lib/actions/forms';
import { answerToText, isField, type FormBlock } from '@/lib/form-schema';
import type { FormRecord, ResponseRecord } from '@/lib/forms';

type Filter = 'complete' | 'partial' | 'all';

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const fmtDuration = (s?: number) => {
  if (!s || s < 1) return '—';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

export function ResponsesView({ form, responses: initial, backHref, demo = false }: {
  form: FormRecord; responses: ResponseRecord[]; backHref: string;
  /** Harness mode: render everything, touch no server. */
  demo?: boolean;
}) {
  const router = useRouter();
  const [responses, setResponses] = useState(initial);
  const [filter, setFilter] = useState<Filter>('complete');
  const [openId, setOpenId] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  useEffect(() => setResponses(initial), [initial]);

  const questions = useMemo(() => form.blocks.filter((b) => isField(b.type)), [form.blocks]);
  const rows = useMemo(
    () => responses.filter((r) => (filter === 'all' ? true : r.status === filter)),
    [responses, filter],
  );
  const counts = useMemo(() => ({
    complete: responses.filter((r) => r.status === 'complete').length,
    partial: responses.filter((r) => r.status === 'partial').length,
  }), [responses]);

  // Five numbers, no chart wall (§7R: the review, not the dashboard).
  const stats = useMemo(() => {
    const starts = responses.length;
    const done = responses.filter((r) => r.status === 'complete');
    const durations = done.map((r) => r.meta.duration_s).filter((d): d is number => typeof d === 'number' && d > 0).sort((a, b) => a - b);
    const median = durations.length ? durations[Math.floor(durations.length / 2)] : 0;
    return {
      views: form.views,
      starts,
      completed: done.length,
      // Rate is against STARTS, not views: views count anyone who opened the
      // link (including the owner testing it), which would flatter nothing.
      rate: starts ? Math.round((done.length / starts) * 100) : 0,
      median,
    };
  }, [responses, form.views]);

  /**
   * Where people stop. Counts each unfinished response against the last field
   * it touched — the single most actionable thing this screen can tell you
   * ("30% quit at Phone" is a fix you can make today).
   */
  const dropOff = useMemo(() => {
    const tally = new Map<string, number>();
    for (const r of responses) {
      if (r.status !== 'partial') continue;
      const id = r.meta.last_field_id;
      if (!id) continue;
      tally.set(id, (tally.get(id) ?? 0) + 1);
    }
    return [...tally.entries()]
      .map(([id, count]) => ({ id, count, label: questions.find((q) => q.id === id)?.label || 'A deleted question' }))
      .sort((a, b) => b.count - a.count);
  }, [responses, questions]);

  const open = rows.find((r) => r.id === openId) ?? null;

  // Keyboard grammar: ↑↓ move through the list, ⏎ opens the focused row.
  const onRowKeyDown = useCallback((e: React.KeyboardEvent<HTMLTableRowElement>, i: number) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = e.key === 'ArrowDown' ? i + 1 : i - 1;
      const el = document.querySelector<HTMLTableRowElement>(`[data-response-row="${next}"]`);
      el?.focus();
    }
    if (e.key === 'Enter') { e.preventDefault(); setOpenId(rows[i].id); }
  }, [rows]);

  async function remove(id: string) {
    if (demo) { setResponses((rs) => rs.filter((r) => r.id !== id)); setOpenId(null); return; }
    const res = await deleteResponse(id);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    setResponses((rs) => rs.filter((r) => r.id !== id));
    setOpenId(null);
    toast({ message: 'Response deleted.' });
    router.refresh();
  }

  /**
   * The fabric move: a response becomes a task in the form's project (or Inbox
   * when there isn't one). Idempotent — the link is stored on the response, so
   * a second click opens the task rather than making a duplicate.
   */
  async function makeTask(r: ResponseRecord) {
    if (r.taskId) { router.push(`${window.location.pathname}?task=${r.taskId}`); return; }
    const title = suggestTaskTitle(r, questions, form.title);
    if (demo) {
      setResponses((rs) => rs.map((x) => (x.id === r.id ? { ...x, taskId: 'demo-task' } : x)));
      toast({ message: `Task created — “${title}”.` });
      return;
    }
    setLinking(true);
    const res = await makeTaskFromResponse(r.id, title);
    setLinking(false);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    setResponses((rs) => rs.map((x) => (x.id === r.id ? { ...x, taskId: res.taskId } : x)));
    toast({ message: `Task created — “${title}”.` });
    router.refresh();
  }

  /** CSV of the complete responses — your data, one click, no export limits. */
  function exportCsv() {
    const done = responses.filter((r) => r.status === 'complete');
    if (done.length === 0) { toast({ message: 'No completed responses yet.' }); return; }
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ['Submitted', 'Name', 'Email', ...questions.map((q) => q.label || 'Question')];
    const lines = [header.map(esc).join(',')];
    for (const r of done) {
      lines.push([
        fmtWhen(r.createdAt),
        r.respondent?.name ?? '',
        r.respondent?.email ?? '',
        ...questions.map((q) => answerToText(q, r.answers[q.id] ?? null)),
      ].map(esc).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.title.replace(/[^\w-]+/g, '-').toLowerCase()}-responses.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 border-b border-line-soft bg-canvas px-4">
        <IconButton label="Back to the form" variant="ghost" size="sm" icon={<Icon icon={ArrowLeft} size={16} />} onClick={() => router.push(`/forms/${form.id}`)} />
        <span className="min-w-0 flex-1 truncate text-ui font-medium text-ink-900">{form.title}</span>
        <Button variant="secondary" size="sm" icon={<Icon icon={Download} size={15} />} onClick={exportCsv}>Export CSV</Button>
      </header>

      <main className="mx-auto w-full max-w-[1080px] flex-1 px-5 py-8 sm:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-h2 text-ink-900">Responses</h1>
            <p className="mt-1 text-body text-ink-500">
              <span className="num">{counts.complete}</span> completed
              {counts.partial > 0 && <> · <span className="num">{counts.partial}</span> in progress</>}
            </p>
          </div>
          <SegmentedControl
            aria-label="Filter responses"
            fit="content"
            value={filter}
            onValueChange={(v) => setFilter(v as Filter)}
            options={[
              { value: 'complete', label: 'Completed' },
              { value: 'partial', label: 'In progress' },
              { value: 'all', label: 'All' },
            ]}
          />
        </div>

        {/* The strip — five numbers on hairlines, no tiles, no charts. */}
        {stats.starts > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-line-soft py-4 sm:grid-cols-5">
            <Metric label="Views" value={String(stats.views)} />
            <Metric label="Started" value={String(stats.starts)} />
            <Metric label="Completed" value={String(stats.completed)} />
            <Metric label="Completion" value={`${stats.rate}%`} />
            <Metric label="Median time" value={fmtDuration(stats.median)} />
          </div>
        )}

        {dropOff.length > 0 && (
          <div className="mb-8">
            <span className="text-overline uppercase text-ink-500">Where people stop</span>
            <div className="mt-2">
              {dropOff.map((d) => (
                <div key={d.id} className="flex items-baseline gap-3 border-b border-line-soft py-2 last:border-0">
                  <span className="min-w-0 flex-1 truncate text-ui text-ink-800">{d.label}</span>
                  <span className="shrink-0 tabular-nums text-meta text-ink-500">
                    {d.count} {d.count === 1 ? 'person' : 'people'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <EmptyState
            illustration={<Icon icon={FileText} size={20} />}
            title={filter === 'partial' ? 'Nothing in progress.' : 'No responses yet.'}
            description={form.status === 'live' ? 'Share the link and answers will land here.' : 'Publish the form to start collecting.'}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line-soft">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Who</TableHead>
                  {questions.slice(0, 2).map((q) => <TableHead key={q.id}>{q.label || 'Question'}</TableHead>)}
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow
                    key={r.id}
                    data-response-row={i}
                    tabIndex={0}
                    onClick={() => setOpenId(r.id)}
                    onKeyDown={(e) => onRowKeyDown(e, i)}
                    className="cursor-pointer focus-ring"
                  >
                    <TableCell className="whitespace-nowrap">
                      <span className="num text-ink-800">{fmtWhen(r.createdAt)}</span>
                      {r.status === 'partial' && <Badge status="warning" className="ml-2">In progress</Badge>}
                    </TableCell>
                    <TableCell className="text-ink-700">
                      {r.respondent?.name || r.respondent?.email || <span className="text-ink-500">Anonymous</span>}
                    </TableCell>
                    {questions.slice(0, 2).map((q) => (
                      <TableCell key={q.id} className="max-w-[260px] truncate text-ink-700">
                        {answerToText(q, r.answers[q.id] ?? null) || <span className="text-ink-400">—</span>}
                      </TableCell>
                    ))}
                    <TableCell className="num whitespace-nowrap text-ink-500">{fmtDuration(r.meta.duration_s)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      {open && (
        <Drawer
          open
          onOpenChange={() => setOpenId(null)}
          title="Response"
          actions={
            <IconButton label="Delete response" variant="ghost" size="sm" icon={<Icon icon={Trash} size={15} />} onClick={() => remove(open.id)} />
          }
          footer={
            <div className="flex items-center gap-2">
              <Button
                variant={open.taskId ? 'secondary' : 'primary'}
                size="sm"
                loading={linking}
                icon={<Icon icon={open.taskId ? Check : SquareCheck} size={14} />}
                onClick={() => makeTask(open)}
              >
                {open.taskId ? 'Open the task' : 'Make a task'}
              </Button>
              {open.taskId && <span className="text-meta text-ink-500">Already on your list.</span>}
            </div>
          }
        >
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2 text-meta text-ink-500">
              <span className="num">{fmtWhen(open.createdAt)}</span>
              <span>·</span>
              <span>{fmtDuration(open.meta.duration_s)}</span>
              {open.status === 'partial' && <Badge status="warning">In progress</Badge>}
            </div>

            {open.respondent && (open.respondent.name || open.respondent.email) && (
              <div className="rounded-lg border border-line-soft p-3">
                {open.respondent.name && <div className="text-body font-medium text-ink-900">{open.respondent.name}</div>}
                {open.respondent.email && <div className="text-meta text-ink-500">{open.respondent.email}</div>}
              </div>
            )}

            <div className="flex flex-col gap-4">
              {questions.map((q) => (
                q.type === 'file'
                  ? <FileAnswer key={q.id} block={q} path={String(open.answers[q.id] ?? '')} name={answerToText(q, open.answers[q.id] ?? null)} demo={demo} />
                  : <Answer key={q.id} block={q} value={answerToText(q, open.answers[q.id] ?? null)} />
              ))}
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}

function Answer({ block, value }: { block: FormBlock; value: string }) {
  return (
    <div className="border-t border-line-soft pt-3 first:border-0 first:pt-0">
      <div className="text-meta text-ink-500">{block.label || 'Question'}</div>
      <div className="mt-1 whitespace-pre-wrap text-body text-ink-900">
        {value || <span className="text-ink-400">No answer</span>}
      </div>
    </div>
  );
}

/**
 * A file answer: the stored value is a private storage path, so the bytes are
 * reachable only through a freshly-signed URL. We mint it on click (short-lived)
 * rather than at render, so the drawer holds no live download links.
 */
function FileAnswer({ block, path, name, demo }: { block: FormBlock; path: string; name: string; demo?: boolean }) {
  const [busy, setBusy] = useState(false);
  async function openFile() {
    if (!path) return;
    if (demo) { toast({ message: 'Preview — downloads are disabled here.' }); return; }
    setBusy(true);
    const res = await signFormUpload(path);
    setBusy(false);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    window.open(res.url, '_blank', 'noopener,noreferrer');
  }
  return (
    <div className="border-t border-line-soft pt-3 first:border-0 first:pt-0">
      <div className="text-meta text-ink-500">{block.label || 'Question'}</div>
      {name ? (
        <div className="mt-1.5 flex items-center gap-2">
          <Icon icon={FileText} size={15} className="shrink-0 text-ink-400" />
          <span className="min-w-0 flex-1 truncate text-body text-ink-900">{name}</span>
          <Button variant="secondary" size="sm" loading={busy} icon={<Icon icon={Download} size={14} />} onClick={openFile}>
            Download
          </Button>
        </div>
      ) : (
        <div className="mt-1 text-body text-ink-400">No file</div>
      )}
    </div>
  );
}

/** One number in the analytics strip. Sans tabular — mono is for IDs only. */
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-overline uppercase text-ink-500">{label}</div>
      <div className="mt-1 font-display text-h3 tabular-nums text-ink-900">{value}</div>
    </div>
  );
}

/**
 * A task title a human would have written: lead with who it's from, fall back to
 * their first substantive answer, then to the form's own name.
 */
function suggestTaskTitle(r: ResponseRecord, questions: FormBlock[], formTitle: string): string {
  const who = r.respondent?.name?.trim() || r.respondent?.email?.trim();
  if (who) return `Follow up with ${who} — ${formTitle}`;
  for (const q of questions) {
    const text = answerToText(q, r.answers[q.id] ?? null).trim();
    if (text.length > 2) return `${formTitle}: ${text.slice(0, 80)}`;
  }
  return `Follow up on “${formTitle}”`;
}

'use client';
// Responses — WHO filled the form in and what they said. A Linear-grade table
// (newest first, keyboard ↑↓ ⏎) with the full answer set in the app's one-drawer
// pattern.
//
// The numbers that used to sit on top of this table — views, completion rate,
// median time, where people stop — moved to the Insights tab. They were
// answering a different question ("is this form working?") and always lost to
// the table, because the table is the thing that grows. This screen is now one
// job: find a person, read what they said, turn it into work.
//
// It also draws inside `FormChrome` now, like every other section. It used to
// build its own full-height page with its own back arrow, so walking to
// Responses made the form's tabs disappear — the one screen in the module you
// could not navigate away from without going backwards.
//
// Partials are kept out of the default view on purpose: they're in-progress
// attempts, not results. They stay one filter click away because they're how you
// learn where people give up.
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Trash, FileText, SquareCheck, Check } from '@/components/ds/icons';
import {
  Icon, Button, Badge, PageView, DropdownMenuItem, SegmentedControl, EmptyState,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, toast, useConfirm,
} from '@/components/ds/ui';
import { formatDayTime, formatMinutes } from '@/lib/date';
import { deleteResponse, makeTaskFromResponse, signFormUpload } from '@/lib/actions/forms';
import { answerToText, isField, type FormBlock } from '@/lib/form-schema';
import type { FormRecord, ResponseRecord } from '@/lib/forms';
import { useServerState } from '@/lib/use-server-state';

type Filter = 'complete' | 'partial' | 'all';

const fmtWhen = (iso: string) => formatDayTime(iso) ?? '';

// How long a response took. Sub-minute resolution matters here and nowhere else
// in the app — a form filled in 45 seconds is a different fact from one that
// took a minute — so the seconds branch is local; everything above a minute goes
// through the vocabulary, which is where the hour arithmetic belongs.
const fmtDuration = (s?: number) => {
  if (!s || s < 1) return '–';
  if (s < 60) return `${s}s`;
  return formatMinutes(Math.floor(s / 60));
};

export function ResponsesView({ form, responses: initial, demo = false }: {
  form: FormRecord; responses: ResponseRecord[];
  /** Harness mode: render everything, touch no server. */
  demo?: boolean;
}) {
  const router = useRouter();
  const [responses, setResponses] = useServerState(initial);
  const [filter, setFilter] = useState<Filter>('complete');
  const [openId, setOpenId] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [confirm, confirmUI] = useConfirm();


  const questions = useMemo(() => form.blocks.filter((b) => isField(b.type)), [form.blocks]);
  const rows = useMemo(
    () => responses.filter((r) => (filter === 'all' ? true : r.status === filter)),
    [responses, filter],
  );
  const counts = useMemo(() => ({
    complete: responses.filter((r) => r.status === 'complete').length,
    partial: responses.filter((r) => r.status === 'partial').length,
  }), [responses]);

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
    // A response is someone else's submission — there is no draft of it
    // anywhere and no undo, so it never goes on a single click.
    const ok = await confirm({
      title: 'Delete this response?',
      body: 'The answers and any uploaded files go with it. This can’t be undone.',
      actionLabel: 'Delete response',
    });
    if (!ok) return;
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
      toast({ message: `Task created, “${title}”.` });
      return;
    }
    setLinking(true);
    const res = await makeTaskFromResponse(r.id, title);
    setLinking(false);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    setResponses((rs) => rs.map((x) => (x.id === r.id ? { ...x, taskId: res.taskId } : x)));
    toast({ message: `Task created, “${title}”.` });
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
    <div className="flex min-h-0 flex-col">
      <main className="mx-auto w-full max-w-[1080px] flex-1 px-5 py-8 sm:px-8">
        {/* One control row: which responses, and getting them out. The counts
            ride on the filter itself rather than in a heading above it — the
            page already has a title in the chrome, and "Completed 9 / In
            progress 0" IS the filter. */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl
            aria-label="Filter responses"
            fit="content"
            value={filter}
            onValueChange={(v) => setFilter(v as Filter)}
            options={[
              { value: 'complete', label: `Completed ${counts.complete}` },
              { value: 'partial', label: `In progress ${counts.partial}` },
              { value: 'all', label: `All ${counts.complete + counts.partial}` },
            ]}
          />
          <Button variant="secondary" size="sm" icon={<Icon icon={Download} size={16} />}
            disabled={counts.complete === 0} onClick={exportCsv}>
            Export CSV
          </Button>
        </div>

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
                        {answerToText(q, r.answers[q.id] ?? null) || <span className="text-ink-500">–</span>}
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
        // A submission is a RECORD, so it opens through the one component every
        // record opens through. `form-response` rather than `form`: a form is
        // the thing you came to build and takes the whole page, while a
        // submission is read WHILE working down a table that has to stay
        // visible behind it.
        <PageView
          open
          onOpenChange={() => setOpenId(null)}
          contentType="form-response"
          title="Response"
          more={
            <DropdownMenuItem danger icon={<Icon icon={Trash} size={14} />} onSelect={() => remove(open.id)}>Delete response</DropdownMenuItem>
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
          <div className="flex flex-col gap-5 p-5">
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
        </PageView>
      )}
      {confirmUI}
    </div>
  );
}

function Answer({ block, value }: { block: FormBlock; value: string }) {
  return (
    <div className="border-t border-line-soft pt-3 first:border-0 first:pt-0">
      <div className="text-meta text-ink-500">{block.label || 'Question'}</div>
      <div className="mt-1 whitespace-pre-wrap text-body text-ink-900">
        {value || <span className="text-ink-500">No answer</span>}
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
    if (demo) { toast({ message: 'Preview, downloads are disabled here.' }); return; }
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
          <Icon icon={FileText} size={16} className="shrink-0 text-ink-500" />
          <span className="min-w-0 flex-1 truncate text-body text-ink-900">{name}</span>
          <Button variant="secondary" size="sm" loading={busy} icon={<Icon icon={Download} size={14} />} onClick={openFile}>
            Download
          </Button>
        </div>
      ) : (
        <div className="mt-1 text-body text-ink-500">No file</div>
      )}
    </div>
  );
}

/** One number in the analytics strip. Sans tabular — mono is for IDs only. */
/**
 * A task title a human would have written: lead with who it's from, fall back to
 * their first substantive answer, then to the form's own name.
 */
function suggestTaskTitle(r: ResponseRecord, questions: FormBlock[], formTitle: string): string {
  const who = r.respondent?.name?.trim() || r.respondent?.email?.trim();
  if (who) return `Follow up with ${who}, ${formTitle}`;
  for (const q of questions) {
    const text = answerToText(q, r.answers[q.id] ?? null).trim();
    if (text.length > 2) return `${formTitle}: ${text.slice(0, 80)}`;
  }
  return `Follow up on “${formTitle}”`;
}

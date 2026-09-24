'use client';
// The client half of the action-failure harness — the same shape as every real
// optimistic view: rows in `useServerState`, an optimistic patch, then an
// awaited action whose `if ('error' in res)` branch never runs when it throws.
import { useState } from 'react';
import { Button, Card, Checkbox, Toaster, toastReverted } from '@/components/ds/ui';
import { ActionFailureNet } from '@/components/shell/action-failure-net';
import { useResync } from '@/lib/use-resync';
import { useServerState } from '@/lib/use-server-state';
import { failNextSave, resetRows, setRowDone, type HarnessRow } from './actions.dev';

export function ActionFailureHarness({ initial }: { initial: HarnessRow[] }) {
  const [rows, setRows] = useServerState(initial);
  // Stands in for the surfaces that load their OWN rows on the client — the task
  // drawer, the focus timer — which a refresh cannot correct. It counts the
  // reloads the net asks for, through the exact hook those surfaces use.
  const [reloads, setReloads] = useState(0);
  useResync(() => setReloads((n) => n + 1));

  async function toggle(row: HarnessRow) {
    const done = !row.done;
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, done } : r)));
    // Written exactly like a correct real call site — which is the point: this
    // `if` handles a RETURNED error properly, and is still never reached when the
    // action throws. Recovering from that is the net's job, and this harness
    // exists to watch it do it.
    const res = await setRowDone(row.id, done);
    if ('error' in res) {
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, done: !done } : r)));
      toastReverted(res.error);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-8">
      <p className="m-0 text-ui text-ink-600">
        Arm a failure, then tick a row. The tick paints, the save throws, and the row should go
        back to unticked on its own — with a toast saying so.
      </p>
      <Card className="gap-1 p-2">
        {rows.map((r) => (
          <label key={r.id} className="flex h-9 items-center gap-2.5 rounded-md px-2 hover:bg-surface-hover">
            <Checkbox checked={r.done} onCheckedChange={() => void toggle(r)} aria-label={r.title} data-row={r.id} />
            <span className="text-ui text-ink-800">{r.title}</span>
          </label>
        ))}
      </Card>
      <p className="m-0 text-meta text-ink-500" data-resyncs={reloads}>
        Client-loaded panel reloads: <span className="tabular-nums">{reloads}</span>
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => void failNextSave()} data-arm>Make the next save fail</Button>
        <Button variant="ghost" onClick={() => void resetRows().then(() => location.reload())} data-reset>Reset</Button>
      </div>
      {/* dev-preview renders OUTSIDE AppShell, which owns the app's one Toaster
          and the one net. Without both, the thing under test is invisible. */}
      <Toaster />
      <ActionFailureNet />
    </div>
  );
}

'use client';
// Dev-only harness for the two destructive-action patterns (INTERACTION_STANDARDS
// §2.2), which are otherwise only reachable behind a session:
//
//   · PERMANENT  → useConfirm() opens the DS ConfirmModal and the act waits on it.
//   · RECOVERABLE → the act happens at once and the toast carries Undo.
//
// It mounts its own <Toaster/> because dev-preview pages render OUTSIDE AppShell,
// which is where the real one lives. 404s in prod.
import { useState } from 'react';
import { notFound } from 'next/navigation';
import { Button, Toaster, toast, useConfirm } from '@/components/ds/ui';

const SEED = [
  { id: 'a', name: 'Design feedback — round 2', responses: 15 },
  { id: 'b', name: 'New client intake', responses: 0 },
  { id: 'c', name: 'Testimonial request', responses: 5 },
];

export default function ConfirmPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ position: 'relative', minHeight: '100dvh', background: 'var(--canvas)' }}>
      <Harness />
      <Toaster />
    </div>
  );
}

function Harness() {
  const [items, setItems] = useState(SEED);
  const [confirm, confirmUI] = useConfirm();

  async function removePermanently(it: (typeof SEED)[number]) {
    const ok = await confirm({
      title: `Delete “${it.name}”?`,
      body: it.responses === 0
        ? 'It has no responses yet. This can’t be undone.'
        : `Its ${it.responses} responses are deleted too. This can’t be undone.`,
      actionLabel: 'Delete form',
    });
    if (!ok) return;
    setItems((xs) => xs.filter((x) => x.id !== it.id));
    toast({ message: `“${it.name}” deleted.` });
  }

  function removeRecoverably(it: (typeof SEED)[number]) {
    const i = items.findIndex((x) => x.id === it.id);
    setItems((xs) => xs.filter((x) => x.id !== it.id));
    toast({
      message: `“${it.name}” removed.`,
      action: { label: 'Undo', onAction: () => setItems((xs) => (xs.some((x) => x.id === it.id) ? xs : [...xs.slice(0, i), it, ...xs.slice(i)])) },
    });
  }

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4 p-10">
      <h1 className="text-title-3 text-ink-900">Destructive actions</h1>
      <p data-count className="text-meta text-ink-500">{items.length} items</p>
      {items.map((it) => (
        <div key={it.id} data-row={it.id} className="flex items-center gap-3 border-b border-line-soft py-2">
          <span className="flex-1 text-ui text-ink-800">{it.name}</span>
          <span className="tabular-nums text-meta text-ink-500">{it.responses}</span>
          <Button size="xs" variant="ghost" onClick={() => removeRecoverably(it)}>Remove (undoable)</Button>
          <Button size="xs" variant="dangerGhost" onClick={() => removePermanently(it)}>Delete forever</Button>
        </div>
      ))}
      {items.length === 0 && <p className="text-ui text-ink-500">Everything is gone.</p>}
      <Button className="self-start" size="xs" variant="ghost" onClick={() => setItems(SEED)}>Reset</Button>
      {confirmUI}
    </div>
  );
}

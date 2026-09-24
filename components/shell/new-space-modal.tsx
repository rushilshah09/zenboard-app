'use client';
// Create a new space (workspace / "organization"). Name + emoji + color + tag.
// createSpace inserts the row and switches into it (sets the active-space cookie);
// the parent refreshes so the new, empty space loads.
//
// This was a hand-rolled `position: fixed` overlay with its own scrim, panel,
// header, × and two <button>s styled inline — modal-shaped but outside the
// system, so it had no focus trap, no Escape, no labelled dialog, and its own
// idea of what a footer looks like. It renders through DS <Modal> now
// (INTERACTION_STANDARDS §2.1: two or more fields ⇒ DS Modal, never bespoke).
//
// The component still takes `onClose`/`onCreated` rather than `open`, because
// every call site mounts it conditionally; `open` is therefore always true and
// closing is delegated upward.
import { useState } from 'react';
import { useFocusReturn } from '@/lib/use-focus-return';
import { Button, Field, Modal, SegmentedControl, TextInput } from '@/components/ds/ui';
import { createSpace } from '@/lib/actions/spaces';
import type { SpaceTag } from '@/types/database';

const COLORS = ['#9A1B6F', '#7B8B5F', '#C88A3B', '#3086FF', '#55964A', '#5C4FB8'];
const EMOJIS = ['✦', '🌿', '💼', '🚀', '🎯', '📚', '🏢', '🎨'];
// The stored enum is data; what the reader sees is sentence case. This dialog is the
// only place a space type is shown, so the labels live beside the choice.
const TAG_OPTIONS: { value: SpaceTag; label: string }[] = [
  { value: 'WORK', label: 'Work' },
  { value: 'LIFE', label: 'Life' },
  { value: 'SIDE', label: 'Side' },
];

export function NewSpaceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  // Mounted only while open, so the cleanup is the close.
  useFocusReturn();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('✦');
  const [color, setColor] = useState(COLORS[0]);
  const [tag, setTag] = useState<SpaceTag>('WORK');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setErr(null);
    const res = await createSpace({ name, emoji, color, tag });
    if ('error' in res) { setBusy(false); setErr(res.error); return; }
    onCreated();
  }

  return (
    <Modal
      open
      onOpenChange={(o) => { if (!o) onClose(); }}
      size="sm"
      title="New workspace"
      description="A hard context of its own — separate clients, projects and finance."
      // Anything typed is worth a "Discard changes?" rather than a silent close.
      dirty={name.trim().length > 0}
      footer={(
        <>
          <Button variant="quiet" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : 'Create workspace'}
          </Button>
        </>
      )}
    >
      <div className="flex flex-col gap-5">
        <Field label="Name" error={err ?? undefined}>
          <TextInput
            autoFocus
            value={name}
            onChange={(e) => { setName(e.target.value); if (err) setErr(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
            placeholder="e.g. Acme Studio, Side projects…"
            autoComplete="off"
          />
        </Field>

        <Field label="Icon">
          <div role="radiogroup" aria-label="Icon" className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <button key={e} type="button" role="radio" aria-checked={emoji === e} aria-label={e}
                onClick={() => setEmoji(e)}
                className={`focus-ring grid size-8 place-items-center rounded-sm border text-body-lg transition-colors duration-fast ${emoji === e ? 'border-[var(--accent-border)] bg-[var(--accent-soft)]' : 'border-line-soft bg-paper-3 hover:bg-surface-hover'}`}>
                {e}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Colour">
          <div role="radiogroup" aria-label="Colour" className="flex gap-2">
            {COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c}
                onClick={() => setColor(c)}
                className="focus-ring size-[26px] rounded-full"
                style={{
                  background: c,
                  border: color === c ? '2px solid var(--ink)' : '2px solid var(--line)',
                  outline: color === c ? '2px solid var(--paper-2)' : 'none',
                  outlineOffset: -4,
                }} />
            ))}
          </div>
        </Field>

        <Field label="Type">
          <SegmentedControl
            aria-label="Type"
            fit="content"
            value={tag}
            onValueChange={(v) => setTag(v as SpaceTag)}
            options={TAG_OPTIONS}
            className="self-start"
          />
        </Field>
      </div>
    </Modal>
  );
}

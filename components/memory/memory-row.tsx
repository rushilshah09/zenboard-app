'use client';
// One fact, and the field that writes one — the two pieces every memory surface
// is built from (§7X). They live here rather than inside the panel because the
// `/memory` home renders exactly the same row: a fact must not look or behave
// like two different things depending on which screen you found it on.
import { useEffect, useRef, useState } from 'react';
import type * as React from 'react';
import { Brain, EllipsisVertical, Star, Pencil, Archive, Trash } from '@/components/ds/icons';
import type { IconType } from '@/components/ds/icons';
import {
  Icon, toast,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  useConfirm,
} from '@/components/ds/ui';
import { recordHref } from '@/lib/connected';
import { formatDay } from '@/lib/date';
import type { EntityType, EntityRef } from '@/lib/connected';
import {
  bodyProblem, BODY_MAX, KIND_LABEL, ORIGIN_LABEL,
  type Memory, type MemoryKind, type MemoryOrigin,
} from '@/lib/memory';
import { supersedeMemory, updateMemoryBody, setMemoryPinned, archiveMemory, forgetMemory } from '@/lib/actions/memory';

// ── One fact ─────────────────────────────────────────────────────────────────

/** `type:id` for a memory's source, or null when it has none the app can address. */
export function sourceRef(m: Memory): EntityRef | null {
  if (!m.source_type || !m.source_id) return null;
  const type = m.source_type as EntityType;
  return recordHref(type, m.source_id) ? { type, id: m.source_id } : null;
}

/**
 * The line under a fact — and it is there to answer exactly one question:
 * "why do you think this?"
 *
 * So it is omitted when the answer is "you told me", which is not worth a line
 * on every row. A kind appears only when it is not the default `fact`, for the
 * same reason `via` appears only on an indirect edge in Connected: a whisper
 * that is always there stops being read.
 *
 * NAMING the source is the difference between a decoration and an answer: "From
 * a selection" tells you nothing you could act on, "From Brand direction v3"
 * takes you to the sentence this was pulled out of. The name is resolved in one
 * batched call by the panel; when it cannot be resolved the source is gone, so
 * the row falls back to the un-linked phrasing rather than offering a link it
 * cannot honour — the same rule the Connected panel follows.
 */
function receiptOf(m: Memory, sourceLabel?: string): { text: string; href?: string } | null {
  const parts: string[] = [];
  if (m.kind !== 'fact') parts.push(KIND_LABEL[m.kind as MemoryKind] ?? m.kind);

  const ref = sourceRef(m);
  const href = ref && sourceLabel ? recordHref(ref.type, ref.id) : undefined;
  if (href) parts.push(`From ${sourceLabel}`);
  else if (m.origin !== 'told') parts.push(ORIGIN_LABEL[m.origin as MemoryOrigin] ?? m.origin);

  return parts.length ? { text: parts.join(' · '), href } : null;
}

export function MemoryRow({ m, gutter, sourceLabel, history, onChanged }: {
  m: Memory;
  /** Reserve the pin slot — set when ANY row in this list is pinned, so one
   *  starred row does not indent its own sentence past its neighbours'. */
  gutter: boolean;
  sourceLabel?: string;
  /** What this fact replaced, oldest first. Absent for the overwhelming majority. */
  history?: Memory[];
  onChanged: (next: Memory | null) => void;
}) {
  const [confirm, confirmUI] = useConfirm();
  const [editing, setEditing] = useState<null | 'fix' | 'replace'>(null);
  const receipt = receiptOf(m, sourceLabel);

  const save = async (body: string) => {
    // THE DISTINCTION THIS WHOLE MODULE RESTS ON, made a choice the user makes
    // rather than one we guess: fixing a typo rewrites in place, changing what
    // the fact CLAIMS supersedes and leaves the old one readable in history.
    const res = editing === 'replace'
      ? await supersedeMemory(m.id, body)
      : await updateMemoryBody(m.id, body);
    if ('error' in res) return res.error;
    setEditing(null);
    onChanged(res.memory);
    if (editing === 'replace') toast({ message: 'Replaced. The old one is still in this fact’s history.' });
    return null;
  };

  if (editing) {
    return (
      <li>
        <FactField
          initial={editing === 'replace' ? '' : m.body}
          placeholder={editing === 'replace' ? 'What is true now…' : undefined}
          submitLabel={editing === 'replace' ? 'Replace' : 'Save'}
          onSubmit={save}
          onCancel={() => setEditing(null)}
        />
      </li>
    );
  }

  return (
    <li className="group flex items-start gap-2 py-1">
      {gutter && (
        // Present on every row once anything is pinned, so the sentences share
        // one left edge. `invisible` rather than a conditional: an empty slot
        // that reserves width is the whole point.
        <Icon icon={Star} size={12} weight="fill"
          aria-label={m.pinned ? 'Pinned' : undefined} aria-hidden={!m.pinned}
          className={`mt-1 shrink-0 text-ink-500 ${m.pinned ? '' : 'invisible'}`} />
      )}
      <div className="min-w-0 flex-1">
        {/* The sentence wraps. It is the content, not a label — truncating it
            would leave a fact that says something other than what was recorded. */}
        <p className="text-ui text-ink-800">{m.body}</p>
        {receipt && (
          receipt.href
            ? <a href={receipt.href} className="focus-ring rounded-sm text-caption text-ink-500 hover:text-ink-800 hover:underline">{receipt.text}</a>
            : <span className="text-caption text-ink-500">{receipt.text}</span>
        )}
        <History chain={history} />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for “${m.body}”`}
            className="focus-ring reveal-on-hover mt-0.5 grid size-6 shrink-0 place-items-center rounded-sm text-ink-500 hover:bg-surface-hover hover:text-ink-800"
          >
            <Icon icon={EllipsisVertical} size={14} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            icon={<Icon icon={Star} size={14} state={!!m.pinned} />}
            onSelect={async () => {
              const res = await setMemoryPinned(m.id, !m.pinned);
              if ('error' in res) toast({ message: res.error, variant: 'error' });
              else onChanged(res.memory);
            }}
          >
            {m.pinned ? 'Unpin' : 'Pin'}
          </DropdownMenuItem>
          <DropdownMenuItem icon={<Icon icon={Pencil} size={14} />} onSelect={() => setEditing('fix')}>
            Fix wording
          </DropdownMenuItem>
          <DropdownMenuItem icon={<Icon icon={Brain} size={14} />} onSelect={() => setEditing('replace')}>
            This changed…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {/* Reversible, so it goes straight through with an undo — the triage in
              INTERACTION_STANDARDS. Deleting is the irreversible one and asks. */}
          <DropdownMenuItem
            icon={<Icon icon={Archive} size={14} />}
            onSelect={async () => {
              const res = await archiveMemory(m.id);
              if ('error' in res) return toast({ message: res.error, variant: 'error' });
              onChanged(null);
              toast({
                message: 'Archived.',
                action: {
                  label: 'Undo',
                  onAction: async () => {
                    const back = await archiveMemory(m.id, false);
                    if ('ok' in back) onChanged(back.memory);
                  },
                },
              });
            }}
          >
            Archive
          </DropdownMenuItem>
          <DropdownMenuItem
            danger
            icon={<Icon icon={Trash} size={14} />}
            onSelect={async () => {
              const ok = await confirm({
                title: 'Forget this permanently?',
                body: 'Archiving keeps it and can be undone. Forgetting cannot.',
                actionLabel: 'Forget',
              });
              if (!ok) return;
              const res = await forgetMemory(m.id);
              if ('error' in res) return toast({ message: res.error, variant: 'error' });
              onChanged(null);
            }}
          >
            Forget
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmUI}
    </li>
  );
}

/**
 * The heading every review band on `/memory` wears.
 *
 * Two bands ask questions there — "Noticed" (a detected pattern, M3) and "About
 * to fade" (a fact gone quiet, §5.4) — and they must read as one idea in two
 * registers rather than as two features that landed separately. One component,
 * so a change to the rung changes both.
 */
export function BandHeading({ icon, title, count, children }: {
  icon: IconType;
  title: string;
  count: number;
  /** One line saying what the band wants. Never more. */
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="flex items-center gap-2 pb-1">
        <Icon icon={icon} size={14} className="text-ink-500" />
        <h2 className="text-meta font-semibold text-ink-800">{title}</h2>
        <span className="text-caption tabular-nums text-ink-500">{count}</span>
      </div>
      <p className="max-w-[52ch] pb-1 text-caption text-ink-500">{children}</p>
    </>
  );
}

/**
 * What this fact used to say — the module's founding claim, on screen.
 *
 * COLLAPSED BY DEFAULT, and that is the design. A memory surface exists to tell
 * you what is true NOW; showing three superseded versions inline would bury the
 * one that counts under the two that don't. It appears only when there IS a
 * history, which for most facts is never.
 *
 * Each line shows the old wording and when it stopped being true — because "we
 * used to think X" is only useful with the "until when" attached.
 */
function History({ chain }: { chain?: Memory[] }) {
  const [open, setOpen] = useState(false);
  if (!chain?.length) return null;

  return (
    <div className="pt-0.5">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="focus-ring -mx-1 rounded-md px-1 text-caption text-ink-500 hover:text-ink-800"
      >
        {open ? 'Hide what changed' : `What this replaced (${chain.length})`}
      </button>
      {open && (
        <ol className="mt-1 border-l border-line-soft pl-2.5">
          {chain.map((prev) => (
            <li key={prev.id} className="py-0.5">
              {/* Struck through, because it is not true any more — the same
                  vocabulary the Connected panel uses for a tombstone. */}
              <p className="text-caption text-ink-500 line-through">{prev.body}</p>
              <p className="text-caption text-ink-500">
                Until {formatDay(prev.invalid_from) ?? 'later'}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ── Writing one ──────────────────────────────────────────────────────────────

/**
 * The one-line field every capture surface uses.
 *
 * A textarea rather than an input, because a fact that runs past the field's
 * width should wrap and stay readable rather than scroll sideways — but Enter
 * still submits, because this is one line conceptually even when it takes two
 * visually. Shift+Enter is deliberately NOT a newline: 0029 stores one line and
 * `normalizeBody` would collapse it anyway, so offering it would be a promise
 * the storage breaks.
 *
 * The counter appears only in the last 40 characters. A counter on an empty
 * field is a warning about a limit nobody was near.
 */
export function FactField({
  initial = '', placeholder = 'Remember something…', submitLabel = 'Remember',
  autoFocus = true, onSubmit, onCancel,
}: {
  initial?: string;
  placeholder?: string;
  submitLabel?: string;
  autoFocus?: boolean;
  /** Returns an error message, or null on success. */
  onSubmit: (body: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow to fit. A fixed two-row box is empty most of the time and short the
  // rest of it; measuring is the only way to be right at both ends.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  const problem = bodyProblem(value);
  const left = BODY_MAX - value.trim().length;

  const submit = async () => {
    if (busy || problem) return;
    setBusy(true);
    try {
      const error = await onSubmit(value);
      if (error) setErr(error);
      else setValue('');
    } catch (e) {
      // A server action REJECTS on an expired session or a dropped connection,
      // and without this the field would sit disabled forever with the user's
      // sentence trapped inside it. `finally` is the load-bearing part.
      // Deliberately NOT `e.message`: an exception here is a thrown server
      // action (an expired session, a dropped connection) and its message is
      // engineering vocabulary — "Not authenticated" is not UI copy. The
      // expected refusals all come back as `{ error }` with a real sentence.
      void e;
      setErr('That didn’t save. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="py-1">
      <div className="flex items-start gap-2">
        <Icon icon={Brain} size={14} className="mt-1.5 shrink-0 text-ink-500" />
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => { setValue(e.target.value); if (err) setErr(null); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); submit(); }
            else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
          }}
          placeholder={placeholder}
          aria-label={submitLabel}
          aria-invalid={!!err}
          className="focus-ring min-w-0 flex-1 resize-none rounded-sm bg-transparent text-ui text-ink-800 outline-none placeholder:text-ink-500"
        />
        {left <= 40 && (
          <span className={`mt-1 shrink-0 text-caption tabular-nums ${left < 0 ? 'text-danger-600' : 'text-ink-500'}`}>
            {left}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 pl-6">
        {err
          ? <span role="alert" className="text-caption text-danger-600">{err}</span>
          : <span className="text-caption text-ink-500">Enter saves · Esc cancels</span>}
      </div>
    </div>
  );
}

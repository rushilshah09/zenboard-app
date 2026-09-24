'use client';
// The form builder — a document, not a canvas. You type the question, press
// Enter for the next one, and hit "/" to change what kind of question it is.
// That's the Tally lesson, in Zenboard's design system.
//
// Three regions: the page (centre), a settings rail (right), and the app's
// standard single 48px header row. Autosaves like the doc editor does; Publish
// is the one filled-accent action on the screen.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Trash, Copy, ChevronUp, ChevronDown, Eye, Link2, X,
  Settings as SettingsIcon,
} from '@/components/ds/icons';
import {
  Icon, Button, IconButton, TextInput, Textarea, Switch, Select,
  SegmentedControl, Popover, PopoverTrigger, PopoverContent, MenuItem, MenuLabel,
  Modal, toast, inlineEdit, inlineEditProps,
} from '@/components/ds/ui';
import { FormRenderer } from '@/components/forms/form-renderer';
import { FormChrome } from '@/components/forms/form-chrome';
import {
  BLOCK_META, FIELD_GROUPS, LOGIC_OPS, OP_LABEL, emptyBlock, hasOptions, isField,
  isUnaryOp, conditionSentence,
  type Condition, type FormBlock, type FormBlockType, type FormSettings, type LogicOp,
} from '@/lib/form-schema';
import { updateForm, publishForm, setFormStatus } from '@/lib/actions/forms';
import type { FormRecord } from '@/lib/forms';
import { useLatest } from '@/lib/use-latest';

export function FormBuilder({ form, studio, responseCount, demo = false }: {
  form: FormRecord; studio: string;
  /** Printed on the Responses tab by the shared chrome. */
  responseCount?: number;
  /** Harness mode: render everything, touch no server (dev-preview has no auth). */
  demo?: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(form.title);
  const [description, setDescription] = useState(form.description ?? '');
  const [blocks, setBlocks] = useState<FormBlock[]>(form.blocks);
  const [settings, setSettings] = useState<FormSettings>(form.settings);
  const [status, setStatus] = useState(form.status);
  const [token, setToken] = useState(form.shareToken);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [preview, setPreview] = useState(false);
  const [inPortal, setInPortal] = useState(form.showInPortal);

  // ── Autosave (the Library idiom): debounce every edit into one write.
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useLatest({ title, description, blocks, settings });

  const queueSave = useCallback(() => {
    dirty.current = true;
    setSaving('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (demo) { dirty.current = false; setSaving('saved'); return; }
      const { title: t, description: d, blocks: b, settings: s } = latest.current;
      const res = await updateForm(form.id, { title: t, description: d, blocks: b, settings: s });
      dirty.current = false;
      setSaving('error' in res ? 'idle' : 'saved');
      if ('error' in res) toast({ message: res.error, variant: 'error' });
    }, 800);
  }, [form.id, demo]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Every mutation goes through these so autosave is never forgotten.
  function edit(next: FormBlock[]) { setBlocks(next); queueSave(); }
  function patchBlock(id: string, patch: Partial<FormBlock>) {
    edit(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }
  function insertBlock(type: FormBlockType, afterId?: string) {
    const block = emptyBlock(type);
    const at = afterId ? blocks.findIndex((b) => b.id === afterId) + 1 : blocks.length;
    const next = [...blocks.slice(0, at), block, ...blocks.slice(at)];
    edit(next);
    setSelected(block.id);
    // Focus the new question's label on the next paint.
    requestAnimationFrame(() => document.getElementById(`label-${block.id}`)?.focus());
  }
  function removeBlock(id: string) {
    const i = blocks.findIndex((b) => b.id === id);
    if (i < 0) return;
    const gone = blocks[i];
    edit(blocks.filter((b) => b.id !== id));
    if (selected === id) setSelected(null);
    // Deliberately NOT a confirm (INTERACTION_STANDARDS §2.2): Backspace on an
    // empty label removes a block too, so a dialog would fire mid-typing. Undo
    // is the right safety net for an editor — it costs nothing to ignore.
    // The label is in the message so rapid deletes don't dedupe into one toast
    // whose Undo would restore the wrong block.
    toast({
      message: `“${gone.label?.trim() || BLOCK_META[gone.type].label}” removed.`,
      action: {
        label: 'Undo',
        onAction: () => {
          setBlocks((cur) => (cur.some((b) => b.id === gone.id) ? cur : [...cur.slice(0, i), gone, ...cur.slice(i)]));
          queueSave();
          setSelected(gone.id);
        },
      },
    });
  }
  function duplicateBlock(id: string) {
    const i = blocks.findIndex((b) => b.id === id);
    if (i < 0) return;
    const copy = { ...blocks[i], id: emptyBlock(blocks[i].type).id };
    edit([...blocks.slice(0, i + 1), copy, ...blocks.slice(i + 1)]);
  }
  function move(id: string, dir: -1 | 1) {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    edit(next);
  }

  async function doPublish() {
    // Publishing MOVES you to Share. The old flow popped a modal with the link
    // in it, which you dismissed and then could not find again without going
    // back to Build. The link now lives at a URL, so the natural thing to do
    // after making it is to go and stand where it is.
    if (demo) { setStatus('live'); setToken(token ?? 'demo-token-preview'); return; }
    if (timer.current) clearTimeout(timer.current);
    await updateForm(form.id, latest.current); // flush before snapshotting
    const res = await publishForm(form.id);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    setStatus('live'); setToken(res.token); setSaving('saved');
    router.push(`/forms/${form.id}/share`);
    router.refresh();
  }

  async function changeStatus(next: 'draft' | 'live' | 'closed') {
    if (demo) { setStatus(next); return; }
    const res = await setFormStatus(form.id, next);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    setStatus(next);
    router.refresh();
  }

  const publicForm = useMemo(() => ({
    id: form.id, version: form.version, title, description: description || null,
    blocks, settings, studio,
  }), [form.id, form.version, title, description, blocks, settings, studio]);

  // The settings RAIL is gone: settings are a tab (app/(app)/forms/[id]/settings),
  // and this file used to draw a second, subtly different copy of them beside
  // the questions. One surface per idea — the rule this module already had for
  // Share and had not applied to itself.

  // THE BUILDER DRAWS INSIDE THE SHARED CHROME NOW.
  //
  // It used to build its own sticky header with its own back arrow, its own
  // status badge and its own Settings button opening a 300px rail — while
  // Settings, Responses and Share each existed as a real tab somewhere else.
  // So the ONE tab you spend all your time on was the one tab with no tabs:
  // from the builder there was no way to reach the responses without going
  // backwards, and Settings existed twice in two different shapes.
  //
  // What is left here is what only the builder can own: Preview, which is a
  // modal it holds the state for, and Publish, which is the act that turns a
  // draft into a link.
  return (
    <FormChrome
      form={{ id: form.id, title, status, projectId: form.projectId }}
      responseCount={responseCount}
      saving={
        <span className="hidden text-meta text-ink-500 sm:inline">
          {saving === 'saving' ? 'Saving…' : saving === 'saved' ? 'Saved' : ''}
        </span>
      }
      actions={
        <>
          <span className="sm:hidden">
            <IconButton label="Preview" variant="secondary" size="sm" icon={<Icon icon={Eye} size={16} />} onClick={() => setPreview(true)} />
          </span>
          <Button className="hidden sm:inline-flex" variant="secondary" size="sm" icon={<Icon icon={Eye} size={16} />} onClick={() => setPreview(true)}>
            Preview
          </Button>

          {/* Share is a TAB now, so a live form's primary action is nothing —
              the work is done and the link is one click away in the row above.
              A draft's primary action is the only one that matters. */}
          {status === 'live' ? (
            <Button variant="secondary" size="sm" icon={<Icon icon={Link2} size={16} />} onClick={() => router.push(`/forms/${form.id}/share`)}>
              Share
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={doPublish}>Publish</Button>
          )}
        </>
      }
    >
      <div className="flex min-h-0 flex-1">
        {/* ── The page ─────────────────────────────────────────────── */}
        <main className="scroll-region min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[720px] px-5 py-10 sm:px-8">
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); queueSave(); }}
              placeholder="Untitled form"
              aria-label="Form title"
              className={inlineEdit({ as: 'title' })} {...inlineEditProps}
            />
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); queueSave(); }}
              placeholder="Add a short description…"
              aria-label="Form description"
              rows={2}
              className={inlineEdit({ as: 'subtitle', className: 'mt-3 resize-none' })} {...inlineEditProps}
            />

            <div className="mt-8 flex flex-col gap-2">
              {blocks.map((b, i) => (
                <BlockEditor
                  key={b.id}
                  block={b}
                  index={i}
                  selected={selected === b.id}
                  isFirst={i === 0}
                  isLast={i === blocks.length - 1}
                  onSelect={() => setSelected(b.id)}
                  onPatch={(p) => patchBlock(b.id, p)}
                  onRemove={() => removeBlock(b.id)}
                  onDuplicate={() => duplicateBlock(b.id)}
                  onMove={(d) => move(b.id, d)}
                  onInsertAfter={(t) => insertBlock(t, b.id)}
                  earlier={blocks.slice(0, i).filter((x) => isField(x.type))}
                />
              ))}
            </div>

            <div className="mt-4">
              <InsertMenu onPick={(t) => insertBlock(t)}>
                <Button variant="ghost" size="sm" icon={<Icon icon={Plus} size={16} />}>Add question</Button>
              </InsertMenu>
            </div>

            {blocks.length === 0 && (
              <p className="mt-3 text-body text-ink-500">Start with a question — or press <kbd>/</kbd> in any question to change its type.</p>
            )}

            {/* The logic summary used to hang off the settings rail. Deleting
                the rail would have taken it with it, and it is the only place
                the whole branching structure can be read in one go — so it came
                here, under the questions it describes. */}
            <div className="mt-8">
              <LogicSummary blocks={blocks} />
            </div>
          </div>
        </main>

      </div>

      {preview && (
        <Modal open onOpenChange={() => setPreview(false)} title="Preview" size="lg">
          <div className="-mx-5 -mb-5 max-h-[70dvh] overflow-y-auto bg-canvas">
            <FormRenderer form={publicForm} preview />
          </div>
        </Modal>
      )}

    </FormChrome>
  );
}

// ── One question in the builder ───────────────────────────────────────────
function BlockEditor({
  block, index, selected, isFirst, isLast, earlier,
  onSelect, onPatch, onRemove, onDuplicate, onMove, onInsertAfter,
}: {
  block: FormBlock; index: number; selected: boolean; isFirst: boolean; isLast: boolean;
  /** Fields ABOVE this one — the only valid condition sources, so logic can't cycle. */
  earlier: FormBlock[];
  onSelect: () => void; onPatch: (p: Partial<FormBlock>) => void; onRemove: () => void;
  onDuplicate: () => void; onMove: (d: -1 | 1) => void; onInsertAfter: (t: FormBlockType) => void;
}) {
  const [slashOpen, setSlashOpen] = useState(false);
  const meta = BLOCK_META[block.type];
  const field = isField(block.type);

  function onLabelKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); onInsertAfter('short_text'); }
    if (e.key === '/' && block.label.length === 0) { e.preventDefault(); setSlashOpen(true); }
    if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); onMove(-1); }
    if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); onMove(1); }
    if (e.key === 'Backspace' && block.label.length === 0) { e.preventDefault(); onRemove(); }
  }

  return (
    <div
      onFocus={onSelect}
      onClick={onSelect}
      className={`group rounded-lg border px-3 py-2.5 transition-colors ${
        selected ? 'border-line bg-surface-raised' : 'border-transparent hover:border-line-soft'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="num mt-1.5 w-5 shrink-0 text-right text-meta text-ink-500">{index + 1}</span>

        <div className="min-w-0 flex-1">
          <input
            id={`label-${block.id}`}
            value={block.label}
            onChange={(e) => onPatch({ label: e.target.value })}
            // Explicit, not relying on the wrapper's focus bubbling: tabbing into
            // a question must expand it, same as clicking (keyboard-first §UX).
            onFocus={onSelect}
            onKeyDown={onLabelKeyDown}
            placeholder={field ? 'Ask a question…' : meta.label}
            aria-label={`Question ${index + 1}`}
            className={inlineEdit({ as: 'label' })} {...inlineEditProps}
          />

          {/* Read-only shape of the answer, so the page reads like the real form */}
          {selected ? (
            <BlockSettings block={block} onPatch={onPatch} earlier={earlier} />
          ) : (
            <p className="mt-1 truncate text-meta text-ink-500">
              {meta.label}{block.required ? ' · Required' : ''}{block.options?.length ? ` · ${block.options.length} options` : ''}{block.showWhen ? ' · Conditional' : ''}
            </p>
          )}
        </div>

        <div className="reveal-on-hover flex shrink-0 items-center gap-0.5">
          <InsertMenu onPick={(t) => onPatch({ type: t, ...(hasOptions(t) && !block.options ? { options: ['Option 1', 'Option 2'] } : {}) })} open={slashOpen} onOpenChange={setSlashOpen} title="Change type">
            <IconButton label="Change question type" variant="ghost" size="xs" icon={<Icon icon={SettingsIcon} size={14} />} />
          </InsertMenu>
          <IconButton label="Move up" variant="ghost" size="xs" disabled={isFirst} icon={<Icon icon={ChevronUp} size={14} />} onClick={() => onMove(-1)} />
          <IconButton label="Move down" variant="ghost" size="xs" disabled={isLast} icon={<Icon icon={ChevronDown} size={14} />} onClick={() => onMove(1)} />
          <IconButton label="Duplicate" variant="ghost" size="xs" icon={<Icon icon={Copy} size={14} />} onClick={onDuplicate} />
          <IconButton label="Delete" variant="ghost" size="xs" icon={<Icon icon={Trash} size={14} />} onClick={onRemove} />
        </div>
      </div>
    </div>
  );
}

// Inline settings for the selected question — quiet, never a modal.
function BlockSettings({ block, onPatch, earlier }: {
  block: FormBlock; onPatch: (p: Partial<FormBlock>) => void; earlier: FormBlock[];
}) {
  if (!isField(block.type)) {
    return (
      <div className="mt-1.5 flex flex-col gap-2.5">
        <p className="text-meta text-ink-500">{BLOCK_META[block.type].label}</p>
        <ConditionEditor block={block} onPatch={onPatch} earlier={earlier} />
      </div>
    );
  }
  return (
    <div className="mt-2.5 flex flex-col gap-2.5">
      <TextInput
        size="sm"
        value={block.help ?? ''}
        placeholder="Help text (optional)"
        aria-label="Help text"
        onChange={(e) => onPatch({ help: e.target.value })}
      />

      {hasOptions(block.type) && (
        <OptionsEditor options={block.options ?? []} onChange={(options) => onPatch({ options })} />
      )}

      <label className="flex w-fit cursor-pointer items-center gap-2 text-meta text-ink-600">
        <Switch checked={!!block.required} onCheckedChange={(v) => onPatch({ required: v })} />
        Required
      </label>

      <ConditionEditor block={block} onPatch={onPatch} earlier={earlier} />
    </div>
  );
}

/** The fixed answers a source question can produce, if it has any. */
function sourceChoices(block?: FormBlock): string[] | null {
  if (!block) return null;
  if (block.type === 'yes_no') return ['Yes', 'No'];
  return block.options?.length ? block.options : null;
}

/**
 * "Only show this when…" — the whole of conditional logic, in one row.
 * Sources are restricted to questions ABOVE this one, which is what makes
 * cycles impossible without a validation pass or a graph editor.
 */
function ConditionEditor({ block, onPatch, earlier }: {
  block: FormBlock; onPatch: (p: Partial<FormBlock>) => void; earlier: FormBlock[];
}) {
  const cond = block.showWhen;

  if (earlier.length === 0) {
    return cond
      ? <p className="text-meta text-ink-500">Move this below another question to use logic.</p>
      : null;
  }

  if (!cond) {
    return (
      <button
        onClick={() => onPatch({ showWhen: { fieldId: earlier[earlier.length - 1].id, op: 'is', value: '' } })}
        className="focus-ring w-fit rounded-sm text-meta text-ink-500 transition-colors hover:text-ink-900"
      >
        + Only show this when…
      </button>
    );
  }

  const source = earlier.find((b) => b.id === cond.fieldId);
  const set = (patch: Partial<Condition>) => onPatch({ showWhen: { ...cond, ...patch } });

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-line-soft p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-overline text-ink-500">Only show when</span>
        <IconButton label="Remove condition" variant="ghost" size="xs" icon={<Icon icon={X} size={12} />} onClick={() => onPatch({ showWhen: undefined })} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Select
          size="sm"
          aria-label="Condition question"
          value={cond.fieldId}
          onValueChange={(v) => set({ fieldId: v })}
          groups={[{ options: earlier.map((b) => ({ value: b.id, label: b.label?.trim() || 'Untitled question' })) }]}
        />
        <Select
          size="sm"
          aria-label="Condition test"
          value={cond.op}
          onValueChange={(v) => set({ op: v as LogicOp })}
          groups={[{ options: LOGIC_OPS.map((op) => ({ value: op, label: OP_LABEL[op] })) }]}
        />
        {!isUnaryOp(cond.op) && (
          // A source with a KNOWN answer set offers those answers — free text
          // here is a typo waiting to silently break a rule. yes/no has no
          // `options` array but its answers are just as fixed.
          sourceChoices(source)?.length ? (
            <Select
              size="sm"
              aria-label="Condition value"
              value={cond.value ?? ''}
              onValueChange={(v) => set({ value: v })}
              groups={[{ options: sourceChoices(source)!.map((o) => ({ value: o, label: o })) }]}
            />
          ) : (
            <TextInput
              size="sm"
              className="w-[140px]"
              aria-label="Condition value"
              value={cond.value ?? ''}
              placeholder="value"
              onChange={(e) => set({ value: e.target.value })}
            />
          )
        )}
      </div>
    </div>
  );
}

// Options as plain lines: type, Enter, type. No per-option modals.
function OptionsEditor({ options, onChange }: { options: string[]; onChange: (o: string[]) => void }) {
  return (
    <div className="flex flex-col gap-1">
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-ink-400" />
          <input
            value={o}
            aria-label={`Option ${i + 1}`}
            onChange={(e) => onChange(options.map((x, j) => (j === i ? e.target.value : x)))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const next = [...options.slice(0, i + 1), '', ...options.slice(i + 1)];
                onChange(next);
                requestAnimationFrame(() => {
                  const inputs = (e.currentTarget.closest('[data-options]')?.querySelectorAll('input') ?? []) as NodeListOf<HTMLInputElement>;
                  inputs[i + 1]?.focus();
                });
              }
              if (e.key === 'Backspace' && o === '' && options.length > 1) {
                e.preventDefault();
                onChange(options.filter((_, j) => j !== i));
              }
            }}
            className={inlineEdit({ as: 'body', className: 'min-w-0 flex-1' })} {...inlineEditProps}
            placeholder="Option"
          />
          {options.length > 1 && (
            <IconButton label={`Remove option ${i + 1}`} variant="ghost" size="xs" icon={<Icon icon={X} size={12} />} onClick={() => onChange(options.filter((_, j) => j !== i))} />
          )}
        </div>
      ))}
      <button
        onClick={() => onChange([...options, ''])}
        className="focus-ring mt-0.5 w-fit rounded-sm text-meta text-ink-500 transition-colors hover:text-ink-800"
      >
        + Add option
      </button>
    </div>
  );
}

// The insert menu — grouped exactly the way the field-picker research suggests,
// rendered as the DS menu (no colored type chips).
function InsertMenu({
  children, onPick, open, onOpenChange, title,
}: {
  children: React.ReactNode; onPick: (t: FormBlockType) => void;
  open?: boolean; onOpenChange?: (o: boolean) => void; title?: string;
}) {
  const [internal, setInternal] = useState(false);
  const isOpen = open ?? internal;
  const setOpen = onOpenChange ?? setInternal;

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="max-h-[380px] w-[248px] overflow-y-auto p-1.5">
        {title && <MenuLabel>{title}</MenuLabel>}
        {FIELD_GROUPS.map((group) => {
          const types = (Object.keys(BLOCK_META) as FormBlockType[]).filter((t) => BLOCK_META[t].group === group);
          if (types.length === 0) return null;
          return (
            <div key={group}>
              <MenuLabel>{group}</MenuLabel>
              {types.map((t) => (
                <MenuItem key={t} onClick={() => { onPick(t); setOpen(false); }}>
                  <span className="flex-1">{BLOCK_META[t].label}</span>
                  {BLOCK_META[t].hint && <span className="text-meta text-ink-500">{BLOCK_META[t].hint}</span>}
                </MenuItem>
              ))}
            </div>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Every rule in the form, as sentences you can read top to bottom — the
 * "see the whole map" affordance, without building a node-graph editor.
 * A rule whose source question was deleted is called out rather than hidden.
 */
function LogicSummary({ blocks }: { blocks: FormBlock[] }) {
  const rules = blocks.filter((b) => b.showWhen);
  if (rules.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 border-t border-line-soft pt-4">
      <span className="text-meta text-ink-600">Logic</span>
      <ul className="flex flex-col gap-2">
        {rules.map((b) => {
          const sentence = conditionSentence(b.showWhen!, blocks);
          return (
            <li key={b.id} className="text-meta leading-relaxed text-ink-500">
              {sentence ? (
                <>Show <span className="text-ink-800">“{b.label?.trim() || 'Untitled'}”</span> when {sentence}</>
              ) : (
                <span className="text-warning-600">
                  “{b.label?.trim() || 'Untitled'}” has a rule pointing at a deleted question — it always shows.
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

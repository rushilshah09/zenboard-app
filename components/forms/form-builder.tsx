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
  Plus, Trash, Copy, ChevronUp, ChevronDown, Eye, Link2, Check,
  ArrowLeft, Settings as SettingsIcon, X,
} from '@/components/ds/icons';
import {
  Icon, Button, IconButton, Badge, TextInput, Textarea, Switch, Select,
  SegmentedControl, Popover, PopoverTrigger, PopoverContent, MenuItem, MenuLabel,
  Modal, toast, type BadgeStatus,
} from '@/components/ds/ui';
import { FormRenderer } from '@/components/forms/form-renderer';
import {
  BLOCK_META, FIELD_GROUPS, LOGIC_OPS, OP_LABEL, emptyBlock, hasOptions, isField,
  isUnaryOp, conditionSentence,
  type Condition, type FormBlock, type FormBlockType, type FormSettings, type LogicOp,
} from '@/lib/form-schema';
import { updateForm, publishForm, setFormStatus, rotateFormToken, setFormInPortal } from '@/lib/actions/forms';
import type { FormRecord } from '@/lib/forms';

const STATUS_TONE: Record<string, BadgeStatus> = { draft: 'neutral', live: 'success', closed: 'neutral' };
const STATUS_LABEL: Record<string, string> = { draft: 'Draft', live: 'Live', closed: 'Closed' };

export function FormBuilder({ form, studio, backHref, demo = false }: {
  form: FormRecord; studio: string; backHref: string;
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
  const [showSettings, setShowSettings] = useState(false);
  const [preview, setPreview] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [inPortal, setInPortal] = useState(form.showInPortal);

  // ── Autosave (the Library idiom): debounce every edit into one write.
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ title, description, blocks, settings });
  latest.current = { title, description, blocks, settings };

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
    edit(blocks.filter((b) => b.id !== id));
    if (selected === id) setSelected(null);
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
    if (demo) { setStatus('live'); setToken(token ?? 'demo-token-preview'); setShareOpen(true); return; }
    if (timer.current) clearTimeout(timer.current);
    await updateForm(form.id, latest.current); // flush before snapshotting
    const res = await publishForm(form.id);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    setStatus('live'); setToken(res.token); setSaving('saved'); setShareOpen(true);
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

  const questionCount = blocks.filter((b) => isField(b.type)).length;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      {/* One header row — title left, actions right (Design Constitution §3) */}
      <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 border-b border-line-soft bg-canvas px-4">
        <IconButton label="Back" variant="ghost" size="sm" icon={<Icon icon={ArrowLeft} size={16} />} onClick={() => router.push(backHref)} />
        <span className="min-w-0 flex-1 truncate text-ui font-medium text-ink-900">{title || 'Untitled form'}</span>
        <Badge status={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
        <span className="hidden text-meta text-ink-500 sm:inline">
          {saving === 'saving' ? 'Saving…' : saving === 'saved' ? 'Saved' : ''}
        </span>
        <Button variant="ghost" size="sm" icon={<Icon icon={SettingsIcon} size={15} />} onClick={() => setShowSettings((v) => !v)}>
          Settings
        </Button>
        <Button variant="secondary" size="sm" icon={<Icon icon={Eye} size={15} />} onClick={() => setPreview(true)}>
          Preview
        </Button>
        {status === 'live' ? (
          <Button variant="secondary" size="sm" icon={<Icon icon={Link2} size={15} />} onClick={() => setShareOpen(true)}>Share</Button>
        ) : (
          <Button variant="primary" size="sm" onClick={doPublish}>Publish</Button>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ── The page ─────────────────────────────────────────────── */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[720px] px-5 py-10 sm:px-8">
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); queueSave(); }}
              placeholder="Untitled form"
              aria-label="Form title"
              className="w-full border-0 bg-transparent p-0 font-display text-h1 text-ink-900 outline-none placeholder:text-ink-400"
            />
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); queueSave(); }}
              placeholder="Add a short description…"
              aria-label="Form description"
              rows={2}
              className="mt-3 w-full resize-none border-0 bg-transparent p-0 text-body-lg leading-relaxed text-ink-700 outline-none placeholder:text-ink-400"
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
                <Button variant="ghost" size="sm" icon={<Icon icon={Plus} size={15} />}>Add question</Button>
              </InsertMenu>
            </div>

            {blocks.length === 0 && (
              <p className="mt-3 text-body text-ink-500">Start with a question — or press <kbd>/</kbd> in any question to change its type.</p>
            )}
          </div>
        </main>

        {/* ── Settings rail ────────────────────────────────────────── */}
        {showSettings && (
          <aside className="hidden w-[300px] shrink-0 overflow-y-auto border-l border-line-soft bg-surface-secondary lg:block">
            <SettingsRail
              settings={settings}
              status={status}
              questionCount={questionCount}
              blocks={blocks}
              inPortal={inPortal}
              canPortal={!!form.projectId}
              onPortal={async (v) => {
                setInPortal(v);
                if (demo) return;
                const res = await setFormInPortal(form.id, v);
                if ('error' in res) { setInPortal(!v); toast({ message: res.error, variant: 'error' }); }
              }}
              onChange={(s) => { setSettings(s); queueSave(); }}
              onStatus={changeStatus}
              onClose={() => setShowSettings(false)}
            />
          </aside>
        )}
      </div>

      {preview && (
        <Modal open onOpenChange={() => setPreview(false)} title="Preview" size="lg">
          <div className="-mx-5 -mb-5 max-h-[70dvh] overflow-y-auto bg-canvas">
            <FormRenderer form={publicForm} preview />
          </div>
        </Modal>
      )}

      {shareOpen && token && (
        <ShareModal
          token={token}
          onClose={() => setShareOpen(false)}
          onRotate={async () => {
            if (demo) { toast({ message: 'Preview — the link is not rotated here.' }); return; }
            const res = await rotateFormToken(form.id);
            if ('error' in res) { toast({ message: 'Couldn’t create a new link.', variant: 'error' }); return; }
            setToken(res.token);
            toast({ message: 'New link created — the old one no longer works.', variant: 'success' });
          }}
        />
      )}
    </div>
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
        <span className="num mt-1.5 w-5 shrink-0 text-right text-meta text-ink-400">{index + 1}</span>

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
            className="w-full border-0 bg-transparent p-0 text-body font-medium text-ink-900 outline-none placeholder:font-normal placeholder:text-ink-400"
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

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
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
        <span className="text-overline uppercase text-ink-500">Only show when</span>
        <IconButton label="Remove condition" variant="ghost" size="xs" icon={<Icon icon={X} size={13} />} onClick={() => onPatch({ showWhen: undefined })} />
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
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-body text-ink-800 outline-none placeholder:text-ink-400"
            placeholder="Option"
          />
          {options.length > 1 && (
            <IconButton label={`Remove option ${i + 1}`} variant="ghost" size="xs" icon={<Icon icon={X} size={13} />} onClick={() => onChange(options.filter((_, j) => j !== i))} />
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

// ── Settings rail ─────────────────────────────────────────────────────────
function SettingsRail({
  settings, status, questionCount, blocks, inPortal, canPortal, onPortal, onChange, onStatus, onClose,
}: {
  settings: FormSettings; status: string; questionCount: number; blocks: FormBlock[];
  inPortal: boolean; canPortal: boolean; onPortal: (v: boolean) => void;
  onChange: (s: FormSettings) => void; onStatus: (s: 'draft' | 'live' | 'closed') => void; onClose: () => void;
}) {
  const set = (patch: Partial<FormSettings>) => onChange({ ...settings, ...patch });
  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-center justify-between">
        <span className="text-overline uppercase text-ink-500">Settings</span>
        <IconButton label="Close settings" variant="ghost" size="xs" icon={<Icon icon={X} size={14} />} onClick={onClose} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-meta text-ink-600">How it's answered</span>
        <SegmentedControl
          aria-label="Filling mode"
          value={settings.mode ?? 'page'}
          onValueChange={(v) => set({ mode: v === 'focus' ? 'focus' : 'page' })}
          options={[{ value: 'page', label: 'One page' }, { value: 'focus', label: 'One question' }]}
        />
        <p className="text-meta text-ink-500">
          {settings.mode === 'focus'
            ? 'One question at a time — best for anything longer than a few questions.'
            : 'The whole form on one calm page.'}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-meta text-ink-600">After submitting</span>
        <Textarea
          rows={3}
          value={settings.thanks ?? ''}
          placeholder="Thank you. Your response has been sent."
          onChange={(e) => set({ thanks: e.target.value })}
        />
      </div>

      {canPortal && (
        <label className="flex cursor-pointer items-center justify-between gap-3 text-body text-ink-800">
          <span className="min-w-0">
            Show in the client portal
            <span className="mt-0.5 block text-meta text-ink-500">
              {status === 'live' ? 'Appears under Forms for this project’s client.' : 'Publish the form to surface it.'}
            </span>
          </span>
          <Switch checked={inPortal} onCheckedChange={onPortal} />
        </label>
      )}

      <LogicSummary blocks={blocks} />

      <label className="flex cursor-pointer items-center justify-between gap-3 text-body text-ink-800">
        <span className="min-w-0">
          Ask who they are
          <span className="mt-0.5 block text-meta text-ink-500">Adds name + email at the end</span>
        </span>
        <Switch checked={!!settings.collectIdentity} onCheckedChange={(v) => set({ collectIdentity: v })} />
      </label>

      <label className="flex cursor-pointer items-center justify-between gap-3 text-body text-ink-800">
        <span className="min-w-0">
          Email me on each response
          <span className="mt-0.5 block text-meta text-ink-500">A note to your account email when someone completes it</span>
        </span>
        <Switch checked={!!settings.notifyByEmail} onCheckedChange={(v) => set({ notifyByEmail: v })} />
      </label>

      <label className="flex cursor-pointer items-center justify-between gap-3 text-body text-ink-800">
        <span className="min-w-0">
          Require a spam check
          <span className="mt-0.5 block text-meta text-ink-500">Adds a Cloudflare Turnstile challenge before someone can submit</span>
        </span>
        <Switch checked={!!settings.turnstile} onCheckedChange={(v) => set({ turnstile: v })} />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-meta text-ink-600">Send responses to a URL</span>
        <TextInput
          size="sm"
          type="url"
          value={settings.webhookUrl ?? ''}
          placeholder="https://…"
          onChange={(e) => set({ webhookUrl: e.target.value.trim() || null })}
        />
        <p className="text-meta text-ink-500">Each completed response is POSTed here as JSON (webhook).</p>
      </div>

      {/* Payments are on hold until we choose a provider available in India
          (Stripe isn't; Razorpay is the likely pick). The schema + renderer are
          kept dormant so wiring a provider later just re-enables this control. */}
      <div className="flex flex-col gap-1.5 rounded-md border border-dashed border-line-soft px-3 py-2.5">
        <span className="flex items-center gap-2 text-meta text-ink-600">
          Collect a payment
          <span className="rounded-full bg-surface-fill px-1.5 py-0.5 text-caption text-ink-500">Coming soon</span>
        </span>
        <p className="text-meta text-ink-500">Charge a deposit or fee when someone submits — provider setup is on the way.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-meta text-ink-600">Stop after</span>
        <TextInput
          size="sm"
          inputMode="numeric"
          value={settings.limit ? String(settings.limit) : ''}
          placeholder="No limit"
          unit="responses"
          onChange={(e) => {
            const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
            set({ limit: Number.isFinite(n) && n > 0 ? n : null });
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-meta text-ink-600">Close on</span>
        <TextInput
          size="sm"
          type="date"
          value={settings.closeAt ?? ''}
          onChange={(e) => set({ closeAt: e.target.value || null })}
        />
      </div>

      <div className="border-t border-line-soft pt-4">
        <p className="text-meta text-ink-500">{questionCount} question{questionCount === 1 ? '' : 's'}</p>
        {status === 'live' && (
          <Button variant="secondary" size="sm" fullWidth className="mt-2.5" onClick={() => onStatus('closed')}>
            Stop accepting responses
          </Button>
        )}
        {status === 'closed' && (
          <Button variant="secondary" size="sm" fullWidth className="mt-2.5" onClick={() => onStatus('live')}>
            Reopen the form
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Share sheet ───────────────────────────────────────────────────────────
function ShareModal({ token, onClose, onRotate }: { token: string; onClose: () => void; onRotate: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === 'undefined' ? `/f/${token}` : `${window.location.origin}/f/${token}`;

  return (
    <Modal open onOpenChange={onClose} title="Share this form" description="Anyone with the link can fill it in — no account needed.">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <TextInput value={url} readOnly aria-label="Form link" className="flex-1" onFocus={(e) => e.currentTarget.select()} />
          <Button
            variant="primary"
            icon={<Icon icon={copied ? Check : Copy} size={15} />}
            onClick={async () => {
              try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); }
              catch { toast({ message: 'Copy failed — select the link and copy it manually.', variant: 'error' }); }
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <button onClick={onRotate} className="focus-ring w-fit rounded-sm text-meta text-ink-500 underline underline-offset-2 transition-colors hover:text-ink-800">
          Create a new link (breaks the old one)
        </button>
      </div>
    </Modal>
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

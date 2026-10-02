'use client';
// THE FORM BUILDER — the form itself, made editable.
//
// It was a list of labels with each question's type written underneath in grey
// ("Short text · Required"), and the user's word for it was "wireframe"
// (2026-10-01). That was exact: it described a form instead of showing one, so
// every author had to imagine what their client would see.
//
// Now the canvas IS the published form — the same sheet, masthead, title, fields
// and button the respondent gets (form-sheet.tsx + field-controls.tsx) — with
// its words editable in place, Tally's lesson. Three regions:
//
//   · the SHEET, centred on the recessed well (the Documents gallery's ground),
//     where you type questions and options exactly where they will appear;
//   · a GUTTER on the hovered question: + to add below it, ⋮⋮ to drag it (the
//     house SortableList, so the handle, keyboard and screen-reader words match
//     every other list you can reorder);
//   · the PANEL on the right (question-panel.tsx): the outline when nothing is
//     selected, a question's properties when one is, the ending when that is.
//
// Keyboard: Enter in a question adds the next one · "/" in an empty question
// changes its kind · Alt+↑/↓ moves it · Backspace in an empty one removes it
// (with Undo) · Escape lets go of the selection.
//
// Autosaves like the doc editor does; Publish is the one filled-accent action.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, GitBranch, Link2, Plus, X } from '@/components/ds/icons';
import { Button, button, cardClass, GrowText, Icon, IconButton, Modal, Rating, Select, toast, inlineEdit, inlineEditProps } from '@/components/ds/ui';
import { SortableList } from '@/components/documents/sortable-list';
import { FormRenderer, Ending } from '@/components/forms/form-renderer';
import { FormChrome } from '@/components/forms/form-chrome';
import { FormMasthead, SHEET_DESCRIPTION, SHEET_TITLE } from '@/components/forms/form-sheet';
import { FieldControl, ScaleControl } from '@/components/forms/field-controls';
import { BlockPicker } from '@/components/forms/block-picker';
import { BLOCK_ICON } from '@/components/forms/block-icons';
import { EndingPanel, OutlinePanel, QuestionPanel } from '@/components/forms/question-panel';
import { formUrl } from '@/components/forms/share-view';
import { cn } from '@/lib/cn';
import {
  BLOCK_META, ENDING_DEFAULTS, blockName, conditionSentence, emptyBlock, hasOptions, isField,
  type FormBlock, type FormBlockType, type FormSettings,
} from '@/lib/form-schema';
import { updateForm, publishForm } from '@/lib/actions/forms';
import type { FormRecord } from '@/lib/forms';
import { useLatest } from '@/lib/use-latest';

/** The selection that is not a block: the button and what happens after it. */
const ENDING = '__ending';

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
  /** Which picker is open: `add:<id>` (the gutter's +), `type:<id>` (a "/"), or `end`. */
  const [picker, setPicker] = useState<string | null>(null);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [preview, setPreview] = useState(false);

  // ── Autosave (the Library idiom): debounce every edit into one write.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useLatest({ title, description, blocks, settings });

  const queueSave = useCallback(() => {
    setSaving('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (demo) { setSaving('saved'); return; }
      const { title: t, description: d, blocks: b, settings: s } = latest.current;
      const res = await updateForm(form.id, { title: t, description: d, blocks: b, settings: s });
      setSaving('error' in res ? 'idle' : 'saved');
      if ('error' in res) toast({ message: res.error, variant: 'error' });
    }, 800);
  }, [form.id, demo, latest]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Every mutation goes through these so autosave is never forgotten.
  function edit(next: FormBlock[]) { setBlocks(next); queueSave(); }
  function patchBlock(id: string, patch: Partial<FormBlock>) {
    edit(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }
  function setSetting(patch: Partial<FormSettings>) {
    setSettings((s) => ({ ...s, ...patch }));
    queueSave();
  }

  /** Focus a block's first editable line, on the next paint (it may not exist yet). */
  const focusBlock = (id: string) => requestAnimationFrame(() => {
    const el = document.getElementById(`block-${id}`);
    el?.scrollIntoView({ block: 'nearest' });
    el?.querySelector<HTMLElement>('[data-block-label]')?.focus();
  });

  function insertBlock(type: FormBlockType, afterId?: string) {
    const block = emptyBlock(type);
    const at = afterId ? blocks.findIndex((b) => b.id === afterId) + 1 : blocks.length;
    edit([...blocks.slice(0, at), block, ...blocks.slice(at)]);
    setSelected(block.id);
    focusBlock(block.id);
  }

  function changeType(id: string, type: FormBlockType) {
    edit(blocks.map((b) => {
      if (b.id !== id || b.type === type) return b;
      const next: FormBlock = { ...b, type, min: undefined, max: undefined };
      if (hasOptions(type) && !b.options?.length) next.options = emptyBlock(type).options;
      if (type === 'scale') { next.min = 0; next.max = 10; }
      if (type === 'hidden' && !b.param) next.param = 'source';
      return next;
    }));
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
    setSelected(copy.id);
  }

  function move(id: string, dir: -1 | 1) {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    edit(next);
  }

  function reorder(ids: string[]) {
    const byId = new Map(blocks.map((b) => [b.id, b]));
    edit(ids.map((id) => byId.get(id)!).filter(Boolean));
  }

  async function doPublish() {
    // Publishing MOVES you to Share: the link lives at a URL, so the natural
    // thing to do after making it is to go and stand where it is.
    if (demo) { setStatus('live'); setToken(token ?? 'demo-token-preview'); return; }
    if (timer.current) clearTimeout(timer.current);
    await updateForm(form.id, latest.current); // flush before snapshotting
    const res = await publishForm(form.id);
    if ('error' in res) { toast({ message: res.error, variant: 'error' }); return; }
    setStatus('live'); setToken(res.token); setSaving('saved');
    router.push(`/forms/${form.id}/share`);
    router.refresh();
  }

  const publicForm = useMemo(() => ({
    id: form.id, version: form.version, title, description: description || null,
    blocks, settings, studio,
  }), [form.id, form.version, title, description, blocks, settings, studio]);

  const link = token && status !== 'draft' ? formUrl(token) : null;
  const selectedBlock = blocks.find((b) => b.id === selected) ?? null;
  const select = (id: string | null) => setSelected(id);

  // The panel — the same content wide (beside the sheet) and narrow (under the question).
  const panelFor = (b: FormBlock) => (
    <QuestionPanel
      block={b}
      blocks={blocks}
      formUrl={link}
      onPatch={(p) => patchBlock(b.id, p)}
      onChangeType={(t) => changeType(b.id, t)}
      onDuplicate={() => duplicateBlock(b.id)}
      onRemove={() => removeBlock(b.id)}
      onClose={() => select(null)}
    />
  );
  const endingPanel = <EndingPanel settings={settings} onSettings={setSetting} onClose={() => select(null)} />;

  // Which page each page break opens. Worked out once per edit — never counted while rendering,
  // because the sortable list re-renders its rows on its own (mid-drag) and a running count would drift.
  const pageOf = useMemo(() => {
    const m = new Map<string, number>();
    let p = 1;
    for (const b of blocks) if (b.type === 'page_break') m.set(b.id, ++p);
    return m;
  }, [blocks]);

  return (
    <FormChrome
      form={{ id: form.id, title, status, projectId: form.projectId }}
      responseCount={responseCount}
      saving={
        <span className="hidden text-meta text-ink-500 sm:inline" aria-live="polite">
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
          {/* Share is a TAB, so a live form's primary action is nothing — the work
              is done and the link is one click away. A draft's is the only one that matters. */}
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
      <div
        className="@container/builder flex h-full min-h-0"
        onKeyDown={(e) => {
          if (e.key !== 'Escape' || !selected) return;
          // A picker or a select open inside the builder handles its own Escape.
          if ((e.target as HTMLElement).closest('[data-radix-popper-content-wrapper],[role="dialog"]')) return;
          select(null);
          (document.activeElement as HTMLElement | null)?.blur();
        }}
      >
        {/* ── The well, and the sheet on it ─────────────────────────────── */}
        <div
          className="scroll-region min-w-0 flex-1 bg-well"
          // Pressing the ground (not the sheet) lets go of the selection, as clicking a desk does.
          onMouseDown={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.ground !== undefined) select(null); }}
        >
          <div data-ground className="px-3 py-6 @[640px]/builder:px-8 @[640px]/builder:py-10">
            <article className="sheet mx-auto max-w-[720px] px-6 py-9 @[640px]/builder:px-14 @[640px]/builder:py-12">
              <FormMasthead studio={studio} />
              <GrowText
                value={title}
                singleLine
                as="title"
                textClassName={SHEET_TITLE}
                onChange={(e) => { setTitle(e.target.value); queueSave(); }}
                onFocus={() => select(null)}
                placeholder="Untitled form"
                aria-label="Form title"
              />
              <GrowText
                value={description}
                as="subtitle"
                textClassName={SHEET_DESCRIPTION}
                className="mt-3"
                onChange={(e) => { setDescription(e.target.value); queueSave(); }}
                onFocus={() => select(null)}
                placeholder="Add a description: what this is for, and how long it takes."
                aria-label="Form description"
              />

              <div className="mt-8">
                {blocks.length === 0 ? (
                  <p className="py-3 text-body text-ink-500">Add your first question below, or press <kbd className="font-sans">/</kbd> in a question to change its kind.</p>
                ) : (
                  <SortableList
                    items={blocks.map((b) => ({ ...b, name: blockName(b) }))}
                    noun="question"
                    onReorder={reorder}
                    rowClassName="rounded-lg"
                    renderRow={(item, handle) => {
                      const b = blocks.find((x) => x.id === item.id)!;
                      const on = selected === b.id;
                      return (
                        <CanvasBlock
                          block={b}
                          blocks={blocks}
                          pageNo={pageOf.get(b.id) ?? 1}
                          selected={on}
                          handle={handle}
                          addOpen={picker === `add:${b.id}`}
                          typeOpen={picker === `type:${b.id}`}
                          onPicker={(which, open) => setPicker(open ? `${which}:${b.id}` : null)}
                          onSelect={() => { if (!on) select(b.id); }}
                          onPatch={(p) => patchBlock(b.id, p)}
                          onChangeType={(t) => changeType(b.id, t)}
                          onInsertAfter={(t) => insertBlock(t, b.id)}
                          onRemove={() => removeBlock(b.id)}
                          onMove={(d) => move(b.id, d)}
                          inlinePanel={on ? panelFor(b) : null}
                        />
                      );
                    }}
                  />
                )}
              </div>

              <BlockPicker open={picker === 'end'} onOpenChange={(o) => setPicker(o ? 'end' : null)} onPick={(t) => insertBlock(t)}>
                <button
                  type="button"
                  className="focus-ring -mx-3 mt-2 flex h-10 w-[calc(100%+24px)] items-center gap-2 rounded-lg px-3 text-ui text-ink-500 transition-colors hover:bg-surface-hover hover:text-ink-800"
                >
                  <Icon icon={Plus} size={16} />
                  Add a question
                  <span className="ms-auto text-meta text-ink-500">Search every kind</span>
                </button>
              </BlockPicker>

              {/* The button, exactly as it will read — and the way into the ending. */}
              <div className="mt-7 border-t border-line-soft pt-3">
                <div className={cn('-mx-3 rounded-lg px-3 py-3 transition-colors', selected === ENDING ? 'bg-surface-selected' : 'hover:bg-surface-hover')}>
                  <button type="button" aria-label={`Submit button, “${settings.submitLabel?.trim() || ENDING_DEFAULTS.submit}”. Edit the ending`}
                    className={button({ variant: 'neutral', size: 'lg' })} onClick={() => select(ENDING)}>
                    {settings.submitLabel?.trim() || ENDING_DEFAULTS.submit}
                  </button>
                </div>
              </div>
              {selected === ENDING && (
                <div className={cardClass('mt-3 overflow-hidden @[1000px]/builder:hidden')}>{endingPanel}</div>
              )}
            </article>

            {/* What they see once it is sent — a second, shorter sheet, because it IS a second screen. */}
            <p className="mx-auto mt-8 max-w-[720px] px-1 text-center text-overline text-ink-500">After submitting</p>
            <div className="sheet mx-auto mt-3 max-w-[720px] px-6 py-3 @[640px]/builder:px-14">
              <button
                type="button"
                aria-label="Edit the ending"
                onClick={() => select(ENDING)}
                className={cn('focus-ring -mx-3 block w-[calc(100%+24px)] rounded-lg px-3 transition-colors', selected === ENDING ? 'bg-surface-selected' : 'hover:bg-surface-hover')}
              >
                <Ending
                  title={settings.thanksTitle?.trim() || ENDING_DEFAULTS.title}
                  message={settings.thanks?.trim() || ENDING_DEFAULTS.message}
                  redirect={settings.redirectUrl}
                />
              </button>
            </div>
            <div className="h-16" data-ground />
          </div>
        </div>

        {/* ── The panel ─────────────────────────────────────────────────── */}
        <aside aria-label="Question settings" className="hidden w-[300px] shrink-0 flex-col border-l border-line-soft bg-paper @[1000px]/builder:flex">
          {selected === ENDING ? endingPanel : selectedBlock ? panelFor(selectedBlock) : (
            <OutlinePanel blocks={blocks} onSelect={(id) => { select(id); focusBlock(id); }} />
          )}
        </aside>
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

// ── One block on the sheet ─────────────────────────────────────────────────

function CanvasBlock({
  block, blocks, pageNo, selected, handle, addOpen, typeOpen, inlinePanel,
  onPicker, onSelect, onPatch, onChangeType, onInsertAfter, onRemove, onMove,
}: {
  block: FormBlock; blocks: FormBlock[]; pageNo: number; selected: boolean; handle: React.ReactNode;
  addOpen: boolean; typeOpen: boolean;
  /** The properties, drawn under the question when the container is too narrow for the side panel. */
  inlinePanel: React.ReactNode;
  onPicker: (which: 'add' | 'type', open: boolean) => void;
  onSelect: () => void;
  onPatch: (p: Partial<FormBlock>) => void;
  onChangeType: (t: FormBlockType) => void;
  onInsertAfter: (t: FormBlockType) => void;
  onRemove: () => void;
  onMove: (d: -1 | 1) => void;
}) {
  const field = isField(block.type);

  function onLabelKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && block.type !== 'statement') { e.preventDefault(); onInsertAfter('short_text'); }
    if (e.key === '/' && block.label.length === 0) { e.preventDefault(); onPicker('type', true); }
    if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); onMove(-1); }
    if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); onMove(1); }
    if (e.key === 'Backspace' && block.label.length === 0 && block.type !== 'statement') { e.preventDefault(); onRemove(); }
  }

  const sentence = block.showWhen ? conditionSentence(block.showWhen, blocks) : null;

  return (
    <div
      id={`block-${block.id}`}
      onMouseDown={onSelect}
      onFocusCapture={onSelect}
      className={cn(
        'group relative -mx-3 rounded-lg px-3 py-3.5 transition-colors',
        selected ? 'bg-surface-selected' : 'hover:bg-surface-hover',
      )}
    >
      {/* The gutter: add below, and the drag handle. Hangs in the sheet's margin. */}
      <div className={cn('absolute right-full top-3.5 hidden items-center pe-0.5 @[640px]/builder:flex', selected ? 'opacity-100' : 'reveal-on-hover')}>
        <BlockPicker open={addOpen} onOpenChange={(o) => onPicker('add', o)} onPick={onInsertAfter}>
          <button type="button" aria-label="Add a question below"
            className="focus-ring grid h-6 w-5 place-items-center rounded-xs text-ink-500 transition-colors hover:bg-surface-hover hover:text-ink-700">
            <Icon icon={Plus} size={16} />
          </button>
        </BlockPicker>
        {handle}
      </div>

      {/* A condition is said in words above the question it governs. */}
      {block.showWhen && (
        <p className={cn('mb-1.5 flex items-center gap-1.5 text-meta', sentence ? 'text-ink-500' : 'text-warning-600')}>
          <Icon icon={GitBranch} size={12} className="shrink-0" />
          <span className="min-w-0 truncate">{sentence ? `Shown when ${sentence}` : 'Its rule points at a deleted question, so it always shows'}</span>
        </p>
      )}

      <BlockBody block={block} pageNo={pageNo} selected={selected} typeOpen={typeOpen}
        onPicker={onPicker} onPatch={onPatch} onChangeType={onChangeType} onLabelKeyDown={onLabelKeyDown} />

      {/* The help line, where the respondent will read it — under the answer. */}
      {field && block.type !== 'hidden' && block.type !== 'checkbox' && (block.help || selected) && (
        <GrowText
          value={block.help ?? ''}
          singleLine
          onChange={(e) => onPatch({ help: e.target.value || undefined })}
          placeholder="Add a hint (optional)"
          aria-label="Hint"
          className="mt-1.5"
          textClassName="text-meta text-ink-500"
        />
      )}

      {inlinePanel && (
        <div className={cardClass('mt-3 overflow-hidden @[1000px]/builder:hidden')}>{inlinePanel}</div>
      )}
    </div>
  );
}

/** The block's own content: its editable words and a resting picture of its answer. */
function BlockBody({ block, pageNo, selected, typeOpen, onPicker, onPatch, onChangeType, onLabelKeyDown }: {
  block: FormBlock; pageNo: number; selected: boolean; typeOpen: boolean;
  onPicker: (which: 'add' | 'type', open: boolean) => void;
  onPatch: (p: Partial<FormBlock>) => void;
  onChangeType: (t: FormBlockType) => void;
  onLabelKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  switch (block.type) {
    case 'heading':
      return (
        <GrowText data-block-label value={block.label} singleLine as="label" textClassName="font-display text-h3 text-ink-900"
          onChange={(e) => onPatch({ label: e.target.value })} onKeyDown={onLabelKeyDown}
          placeholder="Section heading" aria-label="Heading" />
      );
    case 'statement':
      return (
        <GrowText data-block-label value={block.label} textClassName="leading-relaxed text-ink-700"
          onChange={(e) => onPatch({ label: e.target.value })} onKeyDown={onLabelKeyDown}
          placeholder="Write something for the reader…" aria-label="Text" />
      );
    case 'divider':
      return <hr data-block-label tabIndex={0} aria-label="Divider" className="focus-ring my-1 border-0 border-t border-line-soft" />;
    case 'page_break':
      return (
        <div data-block-label tabIndex={0} aria-label={`Page break, page ${pageNo} starts here`} className="focus-ring flex items-center gap-3 rounded-sm">
          <span className="h-px flex-1 bg-line" />
          <span className="rounded-full bg-surface-fill px-2.5 py-0.5 text-meta font-medium text-ink-600">Page {pageNo}</span>
          <span className="h-px flex-1 bg-line" />
        </div>
      );
    case 'hidden':
      return (
        <div className="flex items-center gap-2 text-meta text-ink-500">
          <Icon icon={BLOCK_ICON.hidden} size={14} className="shrink-0" />
          <span>Hidden field</span>
          <span className="rounded-sm bg-surface-fill px-1.5 py-0.5 text-ink-800">{block.param || 'unnamed'}</span>
          <span className="truncate">filled from <span className="text-ink-700">?{block.param || 'name'}=</span> in the link</span>
        </div>
      );
    case 'checkbox':
      return (
        <div className="flex items-center gap-2">
          <span aria-hidden className="size-4 shrink-0 rounded-[4px] border border-line-strong bg-surface-raised" />
          <LabelInput block={block} typeOpen={typeOpen} onPicker={onPicker} onPatch={onPatch} onChangeType={onChangeType} onKeyDown={onLabelKeyDown}
            textClassName="font-normal text-ink-800" placeholder="What are they agreeing to?" />
        </div>
      );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-w-0 items-baseline gap-2">
        <LabelInput block={block} typeOpen={typeOpen} onPicker={onPicker} onPatch={onPatch} onChangeType={onChangeType} onKeyDown={onLabelKeyDown} />
        {!block.required && <span className="shrink-0 text-meta text-ink-500">Optional</span>}
      </div>
      <AnswerPreview block={block} selected={selected} onPatch={onPatch} />
    </div>
  );
}

/** A question's words, typed where they will be read. "/" here changes what kind of question it is. */
function LabelInput({ block, typeOpen, onPicker, onPatch, onChangeType, onKeyDown, textClassName, placeholder }: {
  block: FormBlock; typeOpen: boolean;
  onPicker: (which: 'add' | 'type', open: boolean) => void;
  onPatch: (p: Partial<FormBlock>) => void;
  onChangeType: (t: FormBlockType) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  textClassName?: string;
  placeholder?: string;
}) {
  return (
    <BlockPicker open={typeOpen} onOpenChange={(o) => onPicker('type', o)} onPick={onChangeType} current={block.type} anchorOnly>
      <GrowText
        data-block-label
        inline
        singleLine
        as="label"
        value={block.label}
        onChange={(e) => onPatch({ label: e.target.value })}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? 'Type a question, or / to change its kind'}
        aria-label={`${BLOCK_META[block.type].label} question`}
        textClassName={textClassName}
      />
    </BlockPicker>
  );
}

/**
 * The answer as the respondent will meet it. Choice questions are DRAWN with
 * their options editable in place (that is where you write them); everything
 * else is the real control, made inert — it looks exactly like itself and
 * cannot be typed into, because there is nobody to answer yet.
 */
function AnswerPreview({ block, selected, onPatch }: { block: FormBlock; selected: boolean; onPatch: (p: Partial<FormBlock>) => void }) {
  switch (block.type) {
    case 'select':
      return <OptionRows block={block} selected={selected} onPatch={onPatch} glyph="radio" />;
    case 'multi_select':
      return <OptionRows block={block} selected={selected} onPatch={onPatch} glyph="box" />;
    case 'ranking':
      return <OptionRows block={block} selected={selected} onPatch={onPatch} glyph="rank" />;
    case 'dropdown':
      return (
        <>
          <div inert className="pointer-events-none select-none">
            <Select groups={[{ options: [] }]} placeholder={block.placeholder || 'Choose an answer'} aria-label="Preview" />
          </div>
          {selected
            ? <OptionRows block={block} selected onPatch={onPatch} glyph="number" />
            : <p className="text-meta text-ink-500"><span className="tabular-nums">{block.options?.length ?? 0}</span> options</p>}
        </>
      );
    case 'scale':
      return <div inert className="pointer-events-none select-none"><ScaleControl block={block} value={null} readOnly /></div>;
    case 'rating':
      return <div inert className="pointer-events-none select-none"><Rating value={0} aria-label="Preview" /></div>;
    default:
      return (
        <div inert className="pointer-events-none select-none">
          <FieldControl block={block} value={null} onChange={() => {}} />
        </div>
      );
  }
}

// Options as plain lines with the respondent's own glyph in front: type, Enter,
// type. No per-option modals.
function OptionRows({ block, selected, onPatch, glyph }: {
  block: FormBlock; selected: boolean; onPatch: (p: Partial<FormBlock>) => void; glyph: 'radio' | 'box' | 'rank' | 'number';
}) {
  const options = block.options ?? [];
  const set = (next: string[]) => onPatch({ options: next });
  return (
    <div data-options className="flex flex-col">
      {options.map((o, i) => (
        <div key={i} className="group/option flex min-h-8 items-center gap-2">
          <Glyph kind={glyph} n={i + 1} />
          <input
            value={o}
            aria-label={`Option ${i + 1}`}
            placeholder={`Option ${i + 1}`}
            onChange={(e) => set(options.map((x, j) => (j === i ? e.target.value : x)))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                set([...options.slice(0, i + 1), '', ...options.slice(i + 1)]);
                const list = e.currentTarget.closest('[data-options]');
                requestAnimationFrame(() => list?.querySelectorAll<HTMLInputElement>('input')[i + 1]?.focus());
              }
              if (e.key === 'Backspace' && o === '' && options.length > 1) {
                e.preventDefault();
                set(options.filter((_, j) => j !== i));
                const list = e.currentTarget.closest('[data-options]');
                requestAnimationFrame(() => list?.querySelectorAll<HTMLInputElement>('input')[Math.max(0, i - 1)]?.focus());
              }
            }}
            className={cn(inlineEdit({ as: 'body' }), 'min-w-0 flex-1')} {...inlineEditProps}
          />
          {selected && options.length > 1 && (
            <IconButton label={`Remove option ${i + 1}`} variant="ghost" size="xs" className="reveal-on-hover"
              icon={<Icon icon={X} size={12} />} onClick={() => set(options.filter((_, j) => j !== i))} />
          )}
        </div>
      ))}
      {block.other && (
        <div className="flex min-h-8 items-center gap-2 text-body text-ink-500">
          <Glyph kind={glyph} n={options.length + 1} />
          Other, typed by them
        </div>
      )}
      {selected && (
        <button
          type="button"
          onClick={() => {
            set([...options, '']);
            const list = document.activeElement?.closest('[data-options]');
            requestAnimationFrame(() => {
              const inputs = (list ?? document).querySelectorAll<HTMLInputElement>('[data-options] input');
              inputs[inputs.length - 1]?.focus();
            });
          }}
          className="focus-ring mt-0.5 flex h-8 w-fit items-center gap-2 rounded-sm text-ui text-ink-500 transition-colors hover:text-ink-800"
        >
          <Icon icon={Plus} size={14} />
          Add option
        </button>
      )}
    </div>
  );
}

/** The mark in front of an option — the same shape the respondent's control draws. */
function Glyph({ kind, n }: { kind: 'radio' | 'box' | 'rank' | 'number'; n: number }) {
  if (kind === 'radio') return <span aria-hidden className="size-[18px] shrink-0 rounded-full border border-line-strong bg-surface-raised" />;
  if (kind === 'box') return <span aria-hidden className="size-4 shrink-0 rounded-[4px] border border-line-strong bg-surface-raised" />;
  if (kind === 'rank') return <span aria-hidden className="size-5 shrink-0 rounded-full border border-line-strong" />;
  return <span aria-hidden className="w-5 shrink-0 text-end text-meta tabular-nums text-ink-500">{n}.</span>;
}

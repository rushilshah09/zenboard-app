'use client';
// THE BUILDER'S RIGHT-HAND PANEL — what the selected thing IS, and every knob it has.
//
// The canvas shows the form exactly as the respondent will (form-sheet.tsx), so
// it cannot also carry the settings a respondent never sees: whether options
// shuffle, how many picks are allowed, what a scale's ends are called, which
// link parameter fills a question in, when it appears. Those live here, beside
// the sheet, the way Typeform, Fillout and Notion's form builder all keep them —
// properties in a panel, the artifact on the page.
//
// Three states, one panel:
//   nothing selected → the OUTLINE: every question in order, one click to go to it;
//   a block selected → its PROPERTIES;
//   the ending       → the submit button, the thank-you and the redirect.
//
// Settings that belong to the whole form's BEHAVIOUR (layout, access, alerts)
// stay on the Settings tab. This panel is only ever about one thing on the sheet.
import { Copy, GitBranch, Trash, X } from '@/components/ds/icons';
import { Button, Icon, IconButton, SegmentedControl, Select, Switch, TextInput, Textarea } from '@/components/ds/ui';
import { MENU_FIELD_CLASS } from '@/components/ds/ui/menu';
import { BLOCK_ICON } from '@/components/forms/block-icons';
import { BlockPicker } from '@/components/forms/block-picker';
import { cn } from '@/lib/cn';
import {
  BLOCK_META, ENDING_DEFAULTS, LOGIC_OPS, OP_LABEL, blockName, canDriveLogic, canHaveOther, canShuffle,
  choicesOf, cleanParam, isAsked, isField, isUnaryOp, scaleRange,
  type Condition, type FormBlock, type FormBlockType, type FormSettings, type LogicOp,
} from '@/lib/form-schema';
import { useState } from 'react';

// ── Layout pieces ──────────────────────────────────────────────────────────

function PanelHeader({ icon, title, onClose }: { icon?: React.ReactNode; title: string; onClose?: () => void }) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line-soft px-4">
      {icon && <span className="flex shrink-0 text-ink-600">{icon}</span>}
      <h2 className="m-0 min-w-0 flex-1 truncate text-ui font-medium text-ink-900">{title}</h2>
      {onClose && <IconButton label="Close" tooltip="Close · Esc" variant="ghost" size="xs" icon={<Icon icon={X} size={14} />} onClick={onClose} />}
    </div>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-line-soft px-4 py-4 first:border-t-0">
      {title && <h3 className="m-0 text-overline text-ink-500">{title}</h3>}
      {children}
    </section>
  );
}

/** One property: its name on the left, its control on the right — or under it, for a wide one. */
function Row({ label, hint, children, stack = false }: { label: string; hint?: string; children: React.ReactNode; stack?: boolean }) {
  return (
    <div className={cn('flex gap-3', stack ? 'flex-col gap-1.5' : 'min-h-8 items-center justify-between')}>
      <div className="min-w-0">
        <div className="text-ui text-ink-800">{label}</div>
        {hint && <div className="text-meta text-ink-500">{hint}</div>}
      </div>
      <div className={cn(stack ? 'w-full' : 'shrink-0')}>{children}</div>
    </div>
  );
}

/** A whole number or nothing — the shape every bound in this panel takes. */
function NumberField({ value, onChange, label, placeholder }: { value?: number; onChange: (v: number | undefined) => void; label: string; placeholder?: string }) {
  return (
    <TextInput
      size="sm"
      inputMode="numeric"
      aria-label={label}
      className="w-[88px]"
      value={value === undefined ? '' : String(value)}
      placeholder={placeholder ?? 'Any'}
      onChange={(e) => {
        const raw = e.target.value.trim();
        if (raw === '') return onChange(undefined);
        const n = Number(raw);
        if (Number.isFinite(n)) onChange(Math.round(n));
      }}
    />
  );
}

// ── Nothing selected: the outline ─────────────────────────────────────────

export function OutlinePanel({ blocks, onSelect }: { blocks: FormBlock[]; onSelect: (id: string) => void }) {
  let n = 0;
  let page = 1;
  const questions = blocks.filter((b) => isAsked(b.type)).length;
  return (
    <>
      <PanelHeader title="Outline" />
      <div className="scroll-region min-h-0 flex-1 px-2 py-2">
        <p className="px-2 pb-2 text-meta text-ink-500">
          <span className="tabular-nums">{questions}</span> {questions === 1 ? 'question' : 'questions'}. Select one to edit its settings.
        </p>
        <ol className="m-0 flex list-none flex-col p-0">
          {blocks.map((b) => {
            if (b.type === 'divider') return null;
            if (b.type === 'page_break') {
              page += 1;
              return (
                <li key={b.id} className="mt-2 px-2 pb-1 pt-2 text-overline text-ink-500">Page {page}</li>
              );
            }
            const asked = isAsked(b.type);
            if (asked) n += 1;
            return (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => onSelect(b.id)}
                  className="focus-ring flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left transition-colors hover:bg-surface-hover"
                >
                  <span className="w-4 shrink-0 text-end text-meta tabular-nums text-ink-500">{asked ? n : ''}</span>
                  <Icon icon={BLOCK_ICON[b.type]} size={16} className="shrink-0 text-ink-500" />
                  <span className={cn('min-w-0 flex-1 truncate text-ui', b.type === 'heading' ? 'font-medium text-ink-900' : 'text-ink-800')}>
                    {b.type === 'statement' ? (b.label.trim() || 'Text') : blockName(b)}
                  </span>
                  {b.showWhen && <Icon icon={GitBranch} size={14} className="shrink-0 text-ink-500" aria-label="Has a condition" />}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}

// ── A block selected: its properties ──────────────────────────────────────

export function QuestionPanel({
  block, blocks, formUrl, onPatch, onChangeType, onDuplicate, onRemove, onClose,
}: {
  block: FormBlock;
  blocks: FormBlock[];
  /** The live link, when there is one — for showing what a pre-filling link looks like. */
  formUrl: string | null;
  onPatch: (p: Partial<FormBlock>) => void;
  onChangeType: (t: FormBlockType) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [typeOpen, setTypeOpen] = useState(false);
  const meta = BLOCK_META[block.type];
  const field = isField(block.type);
  const i = blocks.findIndex((b) => b.id === block.id);
  const earlier = blocks.slice(0, Math.max(0, i)).filter(canDriveLogic);
  const textLike = block.type === 'short_text' || block.type === 'long_text';
  const takesPlaceholder = ['short_text', 'long_text', 'email', 'phone', 'url', 'number', 'dropdown'].includes(block.type);

  return (
    <>
      <PanelHeader icon={<Icon icon={BLOCK_ICON[block.type]} size={16} />} title={meta.label} onClose={onClose} />
      <div className="scroll-region min-h-0 flex-1">
        <Section>
          {block.type !== 'divider' && block.type !== 'page_break' && (
            <Row label="Type">
              <BlockPicker open={typeOpen} onOpenChange={setTypeOpen} current={block.type} onPick={onChangeType} align="end">
                <button type="button" aria-label="Change type" className={cn(MENU_FIELD_CLASS, 'flex w-[164px] cursor-pointer items-center gap-2 text-left data-[state=open]:bg-surface-active')}>
                  <Icon icon={BLOCK_ICON[block.type]} size={16} className="shrink-0 text-ink-600" />
                  <span className="min-w-0 flex-1 truncate">{meta.label}</span>
                </button>
              </BlockPicker>
            </Row>
          )}
          {field && block.type !== 'hidden' && (
            <Row label={block.type === 'checkbox' ? 'Must be ticked' : 'Required'}>
              <Switch checked={!!block.required} onCheckedChange={(v) => onPatch({ required: v })} aria-label="Required" />
            </Row>
          )}
          {takesPlaceholder && (
            <Row label="Placeholder" stack>
              <TextInput size="sm" value={block.placeholder ?? ''} placeholder={block.type === 'dropdown' ? 'Choose an answer' : 'Shown before they type'}
                aria-label="Placeholder" onChange={(e) => onPatch({ placeholder: e.target.value || undefined })} />
            </Row>
          )}
          {block.type === 'hidden' && (
            <Row label="Name" hint="Filled from the link, never shown." stack>
              <TextInput size="sm" value={block.param ?? ''} aria-label="Hidden field name" placeholder="source"
                onChange={(e) => onPatch({ param: cleanParam(e.target.value) })} />
            </Row>
          )}
        </Section>

        {(canShuffle(block.type) || canHaveOther(block.type)) && (
          <Section title="Answers">
            {canShuffle(block.type) && (
              <Row label="Shuffle options" hint="Each person sees their own order.">
                <Switch checked={!!block.shuffle} onCheckedChange={(v) => onPatch({ shuffle: v || undefined })} aria-label="Shuffle options" />
              </Row>
            )}
            {canHaveOther(block.type) && (
              <Row label="Add “Other”" hint="They can type their own answer.">
                <Switch checked={!!block.other} onCheckedChange={(v) => onPatch({ other: v || undefined })} aria-label="Add an Other option" />
              </Row>
            )}
          </Section>
        )}

        {block.type === 'scale' && <ScaleSection block={block} onPatch={onPatch} />}

        {(textLike || block.type === 'number' || block.type === 'multi_select') && (
          <Section title={block.type === 'number' ? 'Allowed range' : block.type === 'multi_select' ? 'Picks' : 'Length'}>
            <Row label={block.type === 'number' ? 'Lowest' : block.type === 'multi_select' ? 'At least' : 'Fewest characters'}>
              <NumberField label="Minimum" value={block.min} onChange={(v) => onPatch({ min: v })} />
            </Row>
            <Row label={block.type === 'number' ? 'Highest' : block.type === 'multi_select' ? 'At most' : 'Most characters'}>
              <NumberField label="Maximum" value={block.max} onChange={(v) => onPatch({ max: v })} />
            </Row>
          </Section>
        )}

        {block.type !== 'page_break' && (
          <Section title="Logic">
            <ConditionEditor block={block} blocks={blocks} earlier={earlier} onPatch={onPatch} />
          </Section>
        )}

        {field && block.type !== 'hidden' && block.type !== 'file' && block.type !== 'ranking' && (
          <Section title="Fill from the link">
            <Row label="Parameter" hint="Pre-fills this answer from the link." stack>
              <TextInput size="sm" value={block.param ?? ''} placeholder="e.g. email" aria-label="Link parameter"
                onChange={(e) => onPatch({ param: cleanParam(e.target.value) })} />
            </Row>
            {block.param && (
              <p className="break-all text-meta text-ink-500">
                {formUrl ?? '…/f/your-link'}?<span className="text-ink-800">{block.param}</span>=…
              </p>
            )}
          </Section>
        )}

        <Section>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" icon={<Icon icon={Copy} size={14} />} onClick={onDuplicate}>Duplicate</Button>
            <Button size="sm" variant="ghost" icon={<Icon icon={Trash} size={14} />} onClick={onRemove}>Delete</Button>
          </div>
        </Section>
      </div>
    </>
  );
}

function ScaleSection({ block, onPatch }: { block: FormBlock; onPatch: (p: Partial<FormBlock>) => void }) {
  const { min, max } = scaleRange(block);
  return (
    <Section title="Scale">
      <Row label="Starts at">
        <SegmentedControl aria-label="Scale starts at" value={String(min)} onValueChange={(v) => onPatch({ min: Number(v) })}
          options={[{ value: '0', label: '0' }, { value: '1', label: '1' }]} />
      </Row>
      <Row label="Ends at">
        <Select size="sm" aria-label="Scale ends at" value={String(max)} onValueChange={(v) => onPatch({ max: Number(v) })}
          groups={[{ options: Array.from({ length: 8 }, (_, k) => String(k + 3)).map((v) => ({ value: v, label: v })) }]} />
      </Row>
      <Row label={`Label for ${min}`} stack>
        <TextInput size="sm" value={block.minLabel ?? ''} placeholder="Not likely" aria-label="Label for the low end"
          onChange={(e) => onPatch({ minLabel: e.target.value.slice(0, 40) || undefined })} />
      </Row>
      <Row label={`Label for ${max}`} stack>
        <TextInput size="sm" value={block.maxLabel ?? ''} placeholder="Very likely" aria-label="Label for the high end"
          onChange={(e) => onPatch({ maxLabel: e.target.value.slice(0, 40) || undefined })} />
      </Row>
    </Section>
  );
}

/**
 * "Only show this when…" — the whole of conditional logic, in one row.
 * Sources are restricted to questions ABOVE this one, which is what makes
 * cycles impossible without a validation pass or a graph editor.
 */
function ConditionEditor({ block, blocks, earlier, onPatch }: {
  block: FormBlock; blocks: FormBlock[]; earlier: FormBlock[]; onPatch: (p: Partial<FormBlock>) => void;
}) {
  const cond = block.showWhen;
  if (cond && !blocks.some((b) => b.id === cond.fieldId)) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-meta text-warning-600">Its rule points at a deleted question, so it always shows.</p>
        <Button size="sm" variant="secondary" className="w-fit" onClick={() => onPatch({ showWhen: undefined })}>Remove the rule</Button>
      </div>
    );
  }
  if (earlier.length === 0) {
    return <p className="text-meta text-ink-500">{cond ? 'Move this below another question to use logic.' : 'Add a question above this one to show it only for some answers.'}</p>;
  }
  if (!cond) {
    return (
      <Button size="sm" variant="secondary" className="w-fit" icon={<Icon icon={GitBranch} size={14} />}
        onClick={() => onPatch({ showWhen: { fieldId: earlier[earlier.length - 1].id, op: 'is', value: '' } })}>
        Show only when…
      </Button>
    );
  }

  const source = earlier.find((b) => b.id === cond.fieldId);
  const set = (patch: Partial<Condition>) => onPatch({ showWhen: { ...cond, ...patch } });
  const choices = choicesOf(source);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-ui text-ink-800">Show only when</span>
        <IconButton label="Remove the rule" variant="ghost" size="xs" icon={<Icon icon={X} size={14} />} onClick={() => onPatch({ showWhen: undefined })} />
      </div>
      <Select size="sm" aria-label="Condition question" value={cond.fieldId} onValueChange={(v) => set({ fieldId: v, value: '' })}
        groups={[{ options: earlier.map((b) => ({ value: b.id, label: blockName(b) })) }]} />
      <Select size="sm" aria-label="Condition test" value={cond.op} onValueChange={(v) => set({ op: v as LogicOp })}
        groups={[{ options: LOGIC_OPS.map((op) => ({ value: op, label: OP_LABEL[op] })) }]} />
      {!isUnaryOp(cond.op) && (
        // A source with a KNOWN answer set offers those answers — free text here is a typo waiting
        // to silently break a rule.
        choices?.length ? (
          <Select size="sm" aria-label="Condition value" value={cond.value ?? ''} placeholder="Choose an answer" onValueChange={(v) => set({ value: v })}
            groups={[{ options: choices.map((o) => ({ value: o, label: o })) }]} />
        ) : (
          <TextInput size="sm" aria-label="Condition value" value={cond.value ?? ''} placeholder="Value" onChange={(e) => set({ value: e.target.value })} />
        )
      )}
    </div>
  );
}

// ── The ending ────────────────────────────────────────────────────────────

export function EndingPanel({ settings, onSettings, onClose }: {
  settings: FormSettings; onSettings: (p: Partial<FormSettings>) => void; onClose: () => void;
}) {
  const [redirecting, setRedirecting] = useState(!!settings.redirectUrl);
  const [draft, setDraft] = useState(settings.redirectUrl ?? '');
  const bad = redirecting && draft.trim() !== '' && !/^https:\/\/[^\s]+\.[^\s]+/.test(draft.trim());
  return (
    <>
      <PanelHeader title="Ending" onClose={onClose} />
      <div className="scroll-region min-h-0 flex-1">
        <Section>
          <Row label="Button text" stack>
            <TextInput size="sm" value={settings.submitLabel ?? ''} placeholder={ENDING_DEFAULTS.submit} aria-label="Submit button text"
              maxLength={40} onChange={(e) => onSettings({ submitLabel: e.target.value || undefined })} />
          </Row>
        </Section>
        <Section title="After they submit">
          <Row label="Heading" stack>
            <TextInput size="sm" value={settings.thanksTitle ?? ''} placeholder={ENDING_DEFAULTS.title} aria-label="Ending heading"
              maxLength={80} onChange={(e) => onSettings({ thanksTitle: e.target.value || undefined })} />
          </Row>
          <Row label="Message" stack>
            <Textarea rows={3} value={settings.thanks ?? ''} placeholder={ENDING_DEFAULTS.message} aria-label="Ending message"
              onChange={(e) => onSettings({ thanks: e.target.value || undefined })} />
          </Row>
        </Section>
        <Section title="Redirect">
          <Row label="Send them to a page" hint="Instead of the message above.">
            <Switch checked={redirecting} aria-label="Redirect after submitting"
              onCheckedChange={(v) => { setRedirecting(v); if (!v) onSettings({ redirectUrl: null }); else if (draft.trim()) onSettings({ redirectUrl: draft.trim() }); }} />
          </Row>
          {redirecting && (
            <div className="flex flex-col gap-1">
              <TextInput size="sm" type="url" value={draft} placeholder="https://" aria-label="Redirect address" aria-invalid={bad || undefined}
                onChange={(e) => { setDraft(e.target.value); const v = e.target.value.trim(); onSettings({ redirectUrl: /^https:\/\//.test(v) ? v : null }); }} />
              <p className={cn('text-meta', bad ? 'text-danger-600' : 'text-ink-500')}>
                {bad ? 'Use a full https:// address.' : 'Only secure https:// pages.'}
              </p>
            </div>
          )}
        </Section>
      </div>
    </>
  );
}

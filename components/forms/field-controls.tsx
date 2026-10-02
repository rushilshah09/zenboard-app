'use client';
// THE ANSWER CONTROLS — one per kind of question, and the only place each is drawn.
//
// The public page (both layouts), the builder's live preview and the portal all
// render a question through `FieldControl`, so a linear scale cannot look one way
// to the person building it and another to the person answering it.
//
// Everything here is the DS's own controls, composed. The three that the DS had
// no shape for — a linear scale, a ranking, and a choice with "Other" — are built
// from its tokens and rows, and each says why it is shaped the way it is.
import { useId, useState } from 'react';
import {
  Checkbox, DatePicker, FileUpload, Radio, RadioGroup, Rating, Select, TextInput, Textarea, TimePicker,
} from '@/components/ds/ui';
import { cn } from '@/lib/cn';
import { scaleRange, shuffled, type AnswerValue, type FormBlock } from '@/lib/form-schema';

export type UploadFn = (fieldId: string, file: File) => Promise<{ path: string } | { error: string }>;

/** The value an "Other" radio carries — never a real option, because options are typed by people. */
const OTHER = '\u0000other';

/**
 * The options in the order THIS person sees them. `seed` is minted once per visit on the server
 * (app/f/[token]/page.tsx) and passed down, so the server's HTML and the browser's first render
 * agree and the list never reorders under the reader's eyes after it loads.
 */
export function orderedOptions(block: FormBlock, seed?: number): string[] {
  const options = block.options ?? [];
  return block.shuffle && seed !== undefined ? shuffled(options, seed) : options;
}

export function FieldControl({ block, value, onChange, onBlur, uploadFile, seed, invalid }: {
  block: FormBlock;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  onBlur?: () => void;
  uploadFile?: UploadFn;
  seed?: number;
  invalid?: boolean;
}) {
  const text = String(value ?? '');
  const fieldText = { value: text, placeholder: block.placeholder, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value), onBlur, 'aria-invalid': invalid || undefined };
  switch (block.type) {
    case 'long_text':
      return (
        <Textarea rows={4} value={text} placeholder={block.placeholder} aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
      );
    case 'select':
      return <SingleChoice block={block} value={value} onChange={onChange} seed={seed} />;
    case 'multi_select':
      return <MultiChoice block={block} value={value} onChange={onChange} seed={seed} />;
    case 'yes_no':
      return (
        <RadioGroup value={text} onValueChange={(v) => onChange(v)}>
          {['Yes', 'No'].map((o) => <Radio key={o} value={o} label={o} />)}
        </RadioGroup>
      );
    case 'checkbox':
      // The question IS the box's label — "I agree to the terms" is said once, beside the tick.
      return <Checkbox label={block.label?.trim() || 'I agree'} checked={value === true} onCheckedChange={(c) => onChange(c === true)} />;
    case 'dropdown':
      return (
        <Select
          groups={[{ options: orderedOptions(block, seed).map((o) => ({ value: o, label: o })) }]}
          value={text}
          placeholder={block.placeholder || 'Choose an answer'}
          onValueChange={(v) => onChange(v)}
          aria-label={block.label || 'Choose'}
        />
      );
    case 'rating':
      return <Rating value={Number(value ?? 0)} onValueChange={(n) => onChange(n)} aria-label={block.label || 'Rating'} />;
    case 'scale':
      return <ScaleControl block={block} value={value} onChange={onChange} />;
    case 'ranking':
      return <RankingControl block={block} value={value} onChange={onChange} seed={seed} />;
    case 'date':
      // Our picker, not the browser's — a native date input inside a DS-styled
      // box is the one combination that looks like Zenboard and behaves like
      // Chrome. It parses "next friday" too, which is worth more on a brief than
      // an OS wheel is.
      return <DatePicker aria-label={block.label || 'Date'} value={text || null} onValueChange={(iso) => { onChange(iso); onBlur?.(); }} />;
    case 'time':
      return <TimePicker aria-label={block.label || 'Time'} value={text || null} placeholder={block.placeholder} onValueChange={(t) => { onChange(t); onBlur?.(); }} />;
    case 'number':
      return <TextInput inputMode="decimal" {...fieldText} />;
    case 'email':
      return <TextInput type="email" autoComplete="email" {...fieldText} />;
    case 'phone':
      return <TextInput type="tel" autoComplete="tel" {...fieldText} />;
    case 'url':
      return <TextInput type="url" inputMode="url" autoComplete="url" {...fieldText} placeholder={block.placeholder || 'https://'} />;
    case 'file':
      return (
        <FileUpload
          multiple={false}
          maxSizeMB={10}
          constraints="Up to 10 MB"
          upload={async (file) => {
            if (!uploadFile) throw new Error('Uploads aren’t available here.');
            const res = await uploadFile(block.id, file);
            if ('error' in res) throw new Error(res.error);
            onChange(res.path);
          }}
          onFilesChange={(files) => { if (files.length === 0) onChange(null); }}
        />
      );
    case 'hidden':
      return null;
    default:
      return <TextInput {...fieldText} />;
  }
}

// ── Single choice, with "Other" ────────────────────────────────────────────
// "Other" keeps its own little state: picking it before typing anything is a
// real, visible choice (the radio is on, the box is waiting), but it is not yet
// an answer — the value stays empty until there are words in the box, so a
// required question still says so.
function SingleChoice({ block, value, onChange, seed }: { block: FormBlock; value: AnswerValue; onChange: (v: AnswerValue) => void; seed?: number }) {
  const options = orderedOptions(block, seed);
  const text = typeof value === 'string' ? value : '';
  const typedOther = !!text && !options.includes(text);
  const [otherOn, setOtherOn] = useState(typedOther);
  const radio = otherOn || typedOther ? OTHER : text;
  return (
    <div className="flex flex-col gap-1.5">
      <RadioGroup value={radio} onValueChange={(v) => {
        if (v === OTHER) { setOtherOn(true); onChange(typedOther ? text : ''); return; }
        setOtherOn(false);
        onChange(v);
      }}>
        {options.map((o) => <Radio key={o} value={o} label={o} />)}
        {block.other && <Radio value={OTHER} label="Other" />}
      </RadioGroup>
      {block.other && radio === OTHER && (
        // Indented to the option text by padding, not margin: a full-width field pushed right overflows.
        <div className="ps-6.5">
          <TextInput autoFocus value={typedOther ? text : ''} placeholder="Type your answer" aria-label="Other answer"
            onChange={(e) => onChange(e.target.value)} />
        </div>
      )}
    </div>
  );
}

// ── Multiple choice, with "Other" ──────────────────────────────────────────
function MultiChoice({ block, value, onChange, seed }: { block: FormBlock; value: AnswerValue; onChange: (v: AnswerValue) => void; seed?: number }) {
  const options = orderedOptions(block, seed);
  const picked = Array.isArray(value) ? value : [];
  const typed = picked.find((v) => !options.includes(v)) ?? '';
  const [otherOn, setOtherOn] = useState(!!typed);
  const chosen = picked.filter((v) => options.includes(v));
  const write = (nextChosen: string[], other: string) => onChange([...nextChosen, ...(other.trim() ? [other] : [])]);
  // Checkbox's own `label` gives the same row height and coarse-pointer touch
  // target as Radio — a hand-rolled <label> here silently shipped a 32px tap
  // target on the one surface that is mostly filled on phones.
  return (
    <div className="flex flex-col gap-1">
      {options.map((o) => (
        <Checkbox key={o} label={o} checked={chosen.includes(o)}
          onCheckedChange={(c) => write(c ? [...chosen, o] : chosen.filter((x) => x !== o), typed)} />
      ))}
      {block.other && (
        <>
          <Checkbox label="Other" checked={otherOn}
            onCheckedChange={(c) => { setOtherOn(c === true); write(chosen, c === true ? typed : ''); }} />
          {otherOn && (
            <div className="ps-6">
              <TextInput autoFocus value={typed} placeholder="Type your answer" aria-label="Other answer"
                onChange={(e) => write(chosen, e.target.value)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Linear scale ───────────────────────────────────────────────────────────
// Typeform's opinion scale and Tally's linear scale are the same object: a row
// of numbers you press, with a word under each end. A row of radios would say
// the same thing in eleven separate decisions; a row of numbers is ONE decision
// the eye takes in at a glance — which is the whole point of a scale.
//
// Keyboard: a radio group (arrows move and choose, as in every OS), one tab
// stop. Chosen is the INK solid, never the brand: a public form is the studio's
// document, and the studio's client is not choosing a Zenboard colour.
export function ScaleControl({ block, value, onChange, readOnly }: { block: FormBlock; value: AnswerValue; onChange?: (v: AnswerValue) => void; readOnly?: boolean }) {
  const { min, max } = scaleRange(block);
  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const chosen = typeof value === 'number' ? value : value != null && value !== '' ? Number(value) : null;
  const labelId = useId();
  const move = (to: number, e: React.KeyboardEvent<HTMLButtonElement>) => {
    const next = Math.max(min, Math.min(max, to));
    onChange?.(next);
    const row = e.currentTarget.parentElement;
    row?.querySelector<HTMLButtonElement>(`[data-step="${next}"]`)?.focus();
  };
  return (
    <div>
      <div role="radiogroup" aria-labelledby={labelId} className="flex gap-1">
        <span id={labelId} className="sr-only">{block.label || 'Scale'}, {min} to {max}</span>
        {steps.map((n) => {
          const on = chosen === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              data-step={n}
              disabled={readOnly}
              tabIndex={on || (chosen === null && n === min) ? 0 : -1}
              onClick={() => onChange?.(n)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); move((chosen ?? min - 1) + 1, e); }
                if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); move((chosen ?? min + 1) - 1, e); }
              }}
              className={cn(
                'focus-ring zb-press grid h-10 min-w-0 flex-1 place-items-center rounded-md text-ui font-medium tabular-nums transition-colors',
                on ? 'bg-ink-900 text-onsolid' : 'bg-surface-fill text-ink-800 hover:bg-surface-fill-hover',
                readOnly && 'pointer-events-none',
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
      {(block.minLabel || block.maxLabel) && (
        <div className="mt-2 flex justify-between gap-4 text-meta text-ink-500">
          <span>{block.minLabel}</span>
          <span className="text-end">{block.maxLabel}</span>
        </div>
      )}
    </div>
  );
}

// ── Ranking ────────────────────────────────────────────────────────────────
// Press the options in order of preference: the first press is 1, the next 2.
// Pressing a ranked option takes it out and closes the gap behind it. Options
// keep their places while you rank — a list that re-sorts on every press moves
// the next thing you were about to press.
//
// Chosen over drag: dragging a list on a phone fights the page's own scroll, and
// a press is the same act with a mouse, a finger and a keyboard.
export function RankingControl({ block, value, onChange, seed, readOnly }: { block: FormBlock; value: AnswerValue; onChange?: (v: AnswerValue) => void; seed?: number; readOnly?: boolean }) {
  const options = orderedOptions(block, seed);
  const ranked = Array.isArray(value) ? value.filter((v) => options.includes(v)) : [];
  const toggle = (o: string) => {
    const next = ranked.includes(o) ? ranked.filter((x) => x !== o) : [...ranked, o];
    onChange?.(next.length ? next : null);
  };
  return (
    <div className="flex flex-col gap-1.5">
      {options.map((o) => {
        const rank = ranked.indexOf(o) + 1;
        return (
          <button
            key={o}
            type="button"
            aria-pressed={rank > 0}
            aria-label={rank > 0 ? `${o}, ranked ${rank}` : `Rank ${o}`}
            disabled={readOnly}
            onClick={() => toggle(o)}
            className={cn(
              'focus-ring zb-press flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-left text-body text-ink-800 transition-colors',
              rank > 0 ? 'bg-surface-selected' : 'bg-surface-fill hover:bg-surface-fill-hover',
              readOnly && 'pointer-events-none',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'grid size-5 shrink-0 place-items-center rounded-full text-meta font-semibold tabular-nums',
                rank > 0 ? 'bg-ink-900 text-onsolid' : 'border border-line-strong',
              )}
            >
              {rank > 0 ? rank : ''}
            </span>
            <span className="min-w-0 flex-1">{o}</span>
          </button>
        );
      })}
      {!readOnly && (
        <p className="text-meta text-ink-500">
          {ranked.length === 0 ? 'Press the options in order of preference.' : ranked.length < options.length ? `${options.length - ranked.length} left to rank.` : 'All ranked. Press one to take it out.'}
        </p>
      )}
    </div>
  );
}

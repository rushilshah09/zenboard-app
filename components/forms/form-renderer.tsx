'use client';
// The respondent's view of a form — the exact thing someone opening the link
// sees. Rendered by BOTH the public /f/[token] route and the builder's Preview
// from the same PublicForm projection, so preview can never drift from live.
//
// Two modes, one component:
//   page  — the whole form as a calm scrolling document (the default).
//   focus — one question at a time (the Typeform finding: ~2–2.5× completion).
// Both evaluate the SAME visibility rules, so a hidden question is skipped in
// focus mode and absent in page mode without a second logic implementation.
//
// Design: the portal's calm monochrome idiom (a centred reading column, studio
// monogram, one ink-solid primary). Controls are DS components — never forked.
// Behaviour: inline validation on blur (not a submit-time error dump) and a
// partial response that autosaves as you go, so a dropped connection doesn't
// lose the answers — and the owner still learns where people stop.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, Send, Sparkles, ArrowLeft, ArrowRight } from '@/components/ds/icons';
import { Icon, Button, button, Field, TextInput, Textarea, Select, RadioGroup, Radio, Checkbox, Rating, FileUpload } from '@/components/ds/ui';
import { startResponse, saveProgress, submitResponse, createFormUploadUrl } from '@/lib/actions/forms';
import { createClient } from '@/lib/supabase/client';
import { TurnstileWidget } from '@/components/forms/turnstile';
import {
  isField, validateAnswer, validateAll, visibleBlocks, fields as fieldsOf, HONEYPOT_FIELD, isHttpsUrl,
  type AnswerValue, type Answers, type FormBlock,
} from '@/lib/form-schema';
import type { PublicForm } from '@/lib/forms';

const respKey = (token: string) => `zb:form:resp:${token}`;
/** Choice-style questions advance on pick — the conversational beat of focus mode. */
const AUTO_ADVANCE: ReadonlySet<string> = new Set(['select', 'yes_no', 'rating', 'dropdown']);

export function FormRenderer({
  form, token, preview = false, source = 'link',
}: { form: PublicForm; token?: string; preview?: boolean; source?: 'link' | 'portal' }) {
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [identity, setIdentity] = useState<{ name: string; email: string }>({ name: '', email: '' });
  const [state, setState] = useState<'filling' | 'sending' | 'sent'>('filling');
  const [formError, setFormError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState('');
  // The decoy. A person never sees it, so a value in it is always a bot.
  const honeypot = useRef('');

  const focus = form.settings.mode === 'focus';

  // Everything the current answers make visible. Recomputed each render, so a
  // branch opens/closes the moment the answer it depends on changes.
  const shown = useMemo(() => visibleBlocks(form.blocks, answers), [form.blocks, answers]);
  const shownFields = useMemo(() => fieldsOf(shown), [shown]);

  // Branching can remove the question you're standing on — never strand the step.
  const maxStep = Math.max(0, shownFields.length - 1);
  const safeStep = Math.min(step, maxStep);
  useEffect(() => { if (step > maxStep) setStep(maxStep); }, [step, maxStep]);

  const responseId = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = !preview && !!token;

  // Turnstile is shown only when the owner asked for it AND a site key is deployed.
  // Off ⇒ nothing renders and the server treats the check as inert (see lib/turnstile).
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const turnstileActive = live && !!form.settings.turnstile && !!turnstileSiteKey;

  useEffect(() => {
    if (!live || typeof window === 'undefined') return;
    try { responseId.current = localStorage.getItem(respKey(token!)); } catch { /* storage blocked — submit still works */ }
  }, [live, token]);

  // Open the partial row on the first real interaction (not on page view), then
  // debounce every later keystroke into one save.
  const persist = useCallback((next: Answers, lastFieldId?: string) => {
    if (!live) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        if (!responseId.current) {
          const res = await startResponse(token!, source);
          if ('error' in res) return;
          responseId.current = res.id;
          try { localStorage.setItem(respKey(token!), res.id); } catch { /* ignore */ }
        }
        await saveProgress(token!, responseId.current, next, lastFieldId);
      } catch { /* autosave is best-effort; never surface it */ }
    }, 700);
  }, [live, token, source]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  // A file answer's bytes go STRAIGHT to storage over a one-shot signed URL — they
  // never pass through our server (so the server-action body limit never bites).
  // The answer we keep is only the storage path. In preview there's no token, so
  // we show the picked file locally and write nothing.
  const uploadFile = useCallback(async (fieldId: string, file: File): Promise<{ path: string } | { error: string }> => {
    if (!live || !token) return { path: `preview/${file.name}` };
    const res = await createFormUploadUrl(token, fieldId, file.name);
    if ('error' in res) return { error: res.error };
    const { error } = await createClient().storage.from('form-uploads').uploadToSignedUrl(res.path, res.uploadToken, file);
    if (error) return { error: 'Upload failed. Please try again.' };
    return { path: res.path };
  }, [live, token]);

  function setAnswer(block: FormBlock, value: AnswerValue) {
    const next = { ...answers, [block.id]: value };
    setAnswers(next);
    if (errors[block.id]) setErrors((e) => { const { [block.id]: _drop, ...rest } = e; return rest; });
    persist(next, block.id);
    // Focus mode: a single-choice answer IS the "next" gesture.
    if (focus && AUTO_ADVANCE.has(block.type)) setTimeout(() => advance(block, value), 180);
  }

  function blurValidate(block: FormBlock) {
    const err = validateAnswer(block, answers[block.id] ?? null);
    setErrors((e) => (err ? { ...e, [block.id]: err } : (() => { const { [block.id]: _drop, ...rest } = e; return rest; })()));
  }

  /** Focus mode: validate the question in hand, then move on (or submit). */
  function advance(block: FormBlock, valueOverride?: AnswerValue) {
    const value = valueOverride !== undefined ? valueOverride : (answers[block.id] ?? null);
    const err = validateAnswer(block, value);
    if (err) { setErrors((e) => ({ ...e, [block.id]: err })); return; }
    if (safeStep >= maxStep) { void send(); return; }
    setStep((s) => Math.min(s + 1, maxStep));
  }

  async function send() {
    const found = validateAll(form.blocks, answers);
    if (form.settings.collectIdentity && !identity.email.trim()) found.__identity = 'Please add your email.';
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFormError('Please check the highlighted answers.');
      // In focus mode, jump back to the first question that needs attention.
      if (focus) {
        const i = shownFields.findIndex((b) => found[b.id]);
        if (i >= 0) setStep(i);
      }
      return;
    }
    setFormError(null);
    if (preview || !token) { setState('sent'); return; } // preview: show the thank-you, write nothing

    // The spam check must be solved before we send. Focus mode lives on the last
    // step, which is where the widget renders.
    if (turnstileActive && !turnstileToken) {
      setFormError('Please complete the spam check below.');
      if (focus) setStep(maxStep);
      return;
    }

    setState('sending');
    const res = await submitResponse(token, responseId.current, answers, form.settings.collectIdentity ? identity : undefined, honeypot.current, turnstileToken || undefined);
    if ('error' in res) { setState('filling'); setFormError(res.error); return; }
    try { localStorage.removeItem(respKey(token)); } catch { /* ignore */ }
    responseId.current = null;
    setState('sent');
  }

  const initials = form.studio.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  if (state === 'sent') {
    return (
      <Shell initials={initials} studio={form.studio}>
        <div className="py-10 text-center">
          <Icon icon={CheckCircle} size={22} className="text-success-600" />
          <h1 className="mt-3 font-display text-h3 text-ink-900">Thank you.</h1>
          <p className="mx-auto mt-1.5 max-w-[36ch] text-body text-ink-500">
            {form.settings.thanks?.trim() || 'Your response has been sent.'}
          </p>
          {/* A payment is a follow-up to a captured response, never a gate on it:
              the answer is already saved, so a closed tab can't lose it. Opens the
              owner's Stripe Payment Link in a new tab. */}
          {isHttpsUrl(form.settings.paymentUrl) && (
            <a
              href={form.settings.paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${button({ variant: 'primary', size: 'lg' })} mt-6`}
            >
              {form.settings.paymentLabel?.trim() || 'Pay now'}
            </a>
          )}
        </div>
      </Shell>
    );
  }

  // ── Focus mode: one question at a time ──────────────────────────────────
  if (focus && shownFields.length > 0) {
    const block = shownFields[safeStep];
    const last = safeStep >= maxStep;
    // Any heading/statement sitting directly above this question is its context.
    const idx = shown.findIndex((b) => b.id === block.id);
    const lead = idx > 0 && (shown[idx - 1].type === 'heading' || shown[idx - 1].type === 'statement') ? shown[idx - 1] : null;

    return (
      <Shell initials={initials} studio={form.studio}>
        {/* Progress — thin, quiet, always answerable: "how much is left?" */}
        <div className="mb-8 flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-fill">
            <div
              className="h-full rounded-full bg-ink-900 transition-[width] duration-slow ease-standard"
              style={{ width: `${((safeStep + 1) / shownFields.length) * 100}%` }}
            />
          </div>
          <span className="shrink-0 tabular-nums text-meta text-ink-500">{safeStep + 1} of {shownFields.length}</span>
        </div>

        {lead && (
          lead.type === 'heading'
            ? <h2 className="mb-2 font-display text-h4 text-ink-600">{lead.label}</h2>
            : <p className="mb-3 whitespace-pre-wrap text-body text-ink-600">{lead.label}</p>
        )}

        <div
          key={block.id}
          className="animate-ds-fadein"
          onKeyDown={(e) => {
            // Enter advances, except in a paragraph where it's a newline.
            if (e.key === 'Enter' && !e.shiftKey && block.type !== 'long_text') { e.preventDefault(); advance(block); }
          }}
        >
          <h1 className="font-display text-h2 leading-snug text-ink-900">
            {block.label?.trim() || 'Question'}
            {!block.required && <span className="ml-2 align-middle text-meta font-normal text-ink-500">Optional</span>}
          </h1>
          {block.help && <p className="mt-2 text-body text-ink-500">{block.help}</p>}

          <div className="mt-6">
            <Control block={block} value={answers[block.id] ?? null} onChange={(v) => setAnswer(block, v)} onBlur={() => blurValidate(block)} uploadFile={uploadFile} />
          </div>

          {errors[block.id] && <p className="mt-3 text-meta text-danger-600" role="alert">{errors[block.id]}</p>}
        </div>

        {last && form.settings.collectIdentity && (
          <div className="mt-8 flex flex-col gap-6 border-t border-line-soft pt-7">
            <Field label="Your name" optional>
              <TextInput value={identity.name} onChange={(e) => setIdentity((i) => ({ ...i, name: e.target.value }))} autoComplete="name" />
            </Field>
            <Field label="Email" error={errors.__identity}>
              <TextInput type="email" value={identity.email} onChange={(e) => setIdentity((i) => ({ ...i, email: e.target.value }))} autoComplete="email" />
            </Field>
          </div>
        )}

        {last && turnstileActive && (
          <div className="mt-8">
            <TurnstileWidget siteKey={turnstileSiteKey!} theme="dark" onToken={setTurnstileToken} />
          </div>
        )}
        {last && !live && form.settings.turnstile && (
          <p className="mt-8 text-meta text-ink-500">A spam check (Turnstile) appears here before submitting.</p>
        )}

        {formError && <p className="mt-6 text-meta text-danger-600" role="alert">{formError}</p>}

        <div className="mt-9 flex items-center gap-2">
          <Button
            variant="primary"
            size="lg"
            onClick={() => (last ? void send() : advance(block))}
            loading={state === 'sending'}
            icon={last ? <Icon icon={Send} size={15} /> : undefined}
            iconRight={last ? undefined : <Icon icon={ArrowRight} size={15} />}
          >
            {last ? 'Submit' : 'Next'}
          </Button>
          {safeStep > 0 && (
            <Button variant="ghost" size="lg" onClick={() => setStep((s) => Math.max(0, s - 1))} icon={<Icon icon={ArrowLeft} size={15} />}>
              Back
            </Button>
          )}
          {preview && <span className="ml-1 text-meta text-ink-500">Preview — nothing is saved.</span>}
        </div>
      </Shell>
    );
  }

  // ── Page mode: the whole form as one calm document ──────────────────────
  return (
    <Shell initials={initials} studio={form.studio}>
      <h1 className="font-display text-h1 leading-tight text-ink-900">{form.title}</h1>
      {form.description && <p className="mt-3 whitespace-pre-wrap text-body-lg leading-relaxed text-ink-700">{form.description}</p>}

      <div className="mt-8 flex flex-col gap-7">
        {shown.map((b) => (
          <BlockView key={b.id} block={b} value={answers[b.id] ?? null} error={errors[b.id]}
            onChange={(v) => setAnswer(b, v)} onBlur={() => blurValidate(b)} uploadFile={uploadFile} />
        ))}

        {form.settings.collectIdentity && (
          <div className="flex flex-col gap-7 border-t border-line-soft pt-7">
            <Field label="Your name" optional>
              <TextInput value={identity.name} onChange={(e) => setIdentity((i) => ({ ...i, name: e.target.value }))} autoComplete="name" />
            </Field>
            <Field label="Email" error={errors.__identity}>
              <TextInput type="email" value={identity.email} onChange={(e) => setIdentity((i) => ({ ...i, email: e.target.value }))} autoComplete="email" />
            </Field>
          </div>
        )}
      </div>

      {turnstileActive && (
        <div className="mt-7">
          <TurnstileWidget siteKey={turnstileSiteKey!} theme="dark" onToken={setTurnstileToken} />
        </div>
      )}
      {!live && form.settings.turnstile && (
        <p className="mt-7 text-meta text-ink-500">A spam check (Turnstile) appears here before submitting.</p>
      )}

      {formError && <p className="mt-6 text-meta text-danger-600" role="alert">{formError}</p>}

      <div className="mt-8 flex items-center gap-3 border-t border-line-soft pt-6">
        <Button variant="primary" size="lg" onClick={send} loading={state === 'sending'} icon={<Icon icon={Send} size={15} />}>
          Submit
        </Button>
        {preview && <span className="text-meta text-ink-500">Preview — nothing is saved.</span>}
      </div>
    </Shell>
  );
}

/**
 * Off-screen, not `display:none`: some bots skip hidden inputs but fill anything
 * still in the layout. aria-hidden + tabIndex -1 keep it away from real people
 * and screen readers alike.
 */
function Honeypot({ onChange }: { onChange: (v: string) => void }) {
  return (
    <div aria-hidden className="pointer-events-none absolute left-[-9999px] top-0 h-px w-px overflow-hidden">
      <label htmlFor={HONEYPOT_FIELD}>Website</label>
      <input
        id={HONEYPOT_FIELD}
        name={HONEYPOT_FIELD}
        type="text"
        tabIndex={-1}
        autoComplete="off"
        defaultValue=""
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Shell({ initials, studio, children }: { initials: string; studio: string; children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-[680px] px-5 py-10 sm:px-6 sm:py-14">
      <div className="mb-9 flex items-center gap-2.5">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-md border border-line bg-paper-3 text-[12px] font-semibold text-ink-900">{initials}</span>
        <span className="truncate text-ui font-medium text-ink-800">{studio}</span>
      </div>
      {children}
      <div className="mt-12 flex items-center justify-center gap-1.5 border-t border-line-soft pt-5 text-meta text-ink-500">
        <Icon icon={Sparkles} size={12} /> Powered by Zenboard
      </div>
    </div>
  );
}

type UploadFn = (fieldId: string, file: File) => Promise<{ path: string } | { error: string }>;

// One block in page mode: fields get a <Field> wrapper, layout blocks are content.
function BlockView({ block, value, error, onChange, onBlur, uploadFile }: {
  block: FormBlock; value: AnswerValue; error?: string;
  onChange: (v: AnswerValue) => void; onBlur: () => void; uploadFile: UploadFn;
}) {
  if (!isField(block.type)) {
    switch (block.type) {
      case 'heading':
        return <h2 className="font-display text-h3 text-ink-900">{block.label}</h2>;
      case 'statement':
        return <p className="whitespace-pre-wrap text-body leading-relaxed text-ink-700">{block.label}</p>;
      case 'divider':
        return <hr className="border-0 border-t border-line-soft" />;
      case 'page_break':
        return null; // page mode is one continuous page; focus mode paginates by question
      default:
        return null;
    }
  }

  return (
    <Field label={block.label?.trim() || 'Question'} optional={!block.required} helper={block.help} error={error}>
      <Control block={block} value={value} onChange={onChange} onBlur={onBlur} uploadFile={uploadFile} />
    </Field>
  );
}

/** The input for one field type — shared by both modes so they can't diverge. */
function Control({ block, value, onChange, onBlur, uploadFile }: {
  block: FormBlock; value: AnswerValue; onChange: (v: AnswerValue) => void; onBlur: () => void; uploadFile: UploadFn;
}) {
  switch (block.type) {
    case 'long_text':
      return <Textarea rows={4} value={String(value ?? '')} placeholder={block.placeholder} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />;
    case 'select':
    case 'yes_no': {
      const opts = block.type === 'yes_no' ? ['Yes', 'No'] : (block.options ?? []);
      return (
        <RadioGroup value={String(value ?? '')} onValueChange={(v) => onChange(v)}>
          {opts.map((o) => <Radio key={o} value={o} label={o} />)}
        </RadioGroup>
      );
    }
    case 'multi_select': {
      const picked = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-col gap-1">
          {(block.options ?? []).map((o) => (
            <label key={o} className="flex min-h-8 cursor-pointer items-center gap-2.5 py-1 text-body text-ink-800">
              <Checkbox
                checked={picked.includes(o)}
                onCheckedChange={(c) => onChange(c ? [...picked, o] : picked.filter((x) => x !== o))}
              />
              {o}
            </label>
          ))}
        </div>
      );
    }
    case 'dropdown':
      return (
        <Select
          groups={[{ options: (block.options ?? []).map((o) => ({ value: o, label: o })) }]}
          value={String(value ?? '')}
          onValueChange={(v) => onChange(v)}
          aria-label={block.label || 'Choose'}
        />
      );
    case 'rating':
      return <Rating value={Number(value ?? 0)} onValueChange={(n) => onChange(n)} />;
    case 'date':
      return <TextInput type="date" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />;
    case 'number':
      return <TextInput inputMode="decimal" value={String(value ?? '')} placeholder={block.placeholder} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />;
    case 'email':
      return <TextInput type="email" autoComplete="email" value={String(value ?? '')} placeholder={block.placeholder} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />;
    case 'file':
      return (
        <FileUpload
          multiple={false}
          maxSizeMB={10}
          constraints="Up to 10 MB"
          upload={async (file) => {
            const res = await uploadFile(block.id, file);
            if ('error' in res) throw new Error(res.error);
            onChange(res.path);
          }}
          onFilesChange={(files) => { if (files.length === 0) onChange(null); }}
        />
      );
    default:
      return <TextInput value={String(value ?? '')} placeholder={block.placeholder} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />;
  }
}

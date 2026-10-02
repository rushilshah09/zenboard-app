'use client';
// The respondent's view of a form — the exact thing someone opening the link
// sees. Rendered by BOTH the public /f/[token] route and the builder's Preview
// from the same PublicForm projection, so preview can never drift from live.
//
// Two layouts, one component:
//   page  — the form as a calm document, split into PAGES at its page breaks.
//   focus — one question at a time (the Typeform finding: ~2–2.5× completion).
// Both evaluate the SAME visibility rules, so a hidden question is skipped in
// focus mode and absent in page mode without a second logic implementation.
//
// Design: the studio's sheet (form-sheet.tsx), monochrome. The buttons are the
// INK solid, not the brand: this is the studio's document, read by the studio's
// client, and Zenboard's berry has no business on it (the portal's rule).
// Behaviour: inline validation on blur (not a submit-time error dump) and a
// partial response that autosaves as you go, so a dropped connection doesn't
// lose the answers — and the owner still learns where people stop.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, CircleAlert } from '@/components/ds/icons';
import { Icon, Button, button, Field, TextInput } from '@/components/ds/ui';
import { startResponse, saveProgress, submitResponse, createFormUploadUrl } from '@/lib/actions/forms';
import { createClient } from '@/lib/supabase/client';
import { TurnstileWidget } from '@/components/forms/turnstile';
import { FieldControl } from '@/components/forms/field-controls';
import { FormSheet, SHEET_DESCRIPTION, SHEET_GAP, SHEET_TITLE } from '@/components/forms/form-sheet';
import {
  ENDING_DEFAULTS, isField, isAsked, validateAnswer, validateAll, visibleBlocks, pagesOf, prefillAnswers,
  HONEYPOT_FIELD, isHttpsUrl,
  type AnswerValue, type Answers, type FormBlock,
} from '@/lib/form-schema';
import type { PublicForm } from '@/lib/forms';

const respKey = (token: string) => `zb:form:resp:${token}`;
const doneKey = (token: string) => `zb:form:done:${token}`;
/** Choice-style questions advance on pick — the conversational beat of focus mode. */
const AUTO_ADVANCE: ReadonlySet<string> = new Set(['yes_no', 'rating', 'dropdown', 'scale']);

const noSubscribe = () => () => {};

export function FormRenderer({
  form, token, preview = false, source = 'link', seed, params, embed = false,
}: {
  form: PublicForm;
  token?: string;
  preview?: boolean;
  source?: 'link' | 'portal';
  /** This visit's option order (shuffled questions). Minted on the server so both renders agree. */
  seed?: number;
  /** The link's query string, for pre-filled and hidden fields. */
  params?: Record<string, string>;
  /** Drawn inside someone else's page: no card, no masthead. */
  embed?: boolean;
}) {
  const [answers, setAnswers] = useState<Answers>(() => (params ? prefillAnswers(form.blocks, new URLSearchParams(params)) : {}));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [identity, setIdentity] = useState<{ name: string; email: string }>({ name: '', email: '' });
  const [state, setState] = useState<'filling' | 'sending' | 'sent'>('filling');
  const [formError, setFormError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [page, setPage] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState('');
  // The decoy. A person never sees it, so a value in it is always a bot.
  const honeypot = useRef('');
  const top = useRef<HTMLDivElement>(null);

  const focus = form.settings.mode === 'focus';
  const live = !preview && !!token;
  const submitLabel = form.settings.submitLabel?.trim() || ENDING_DEFAULTS.submit;

  // "One response per person": a soft guard, per browser, as Tally's is. Read through the store
  // hook so the server's HTML (which cannot know) and the browser agree on the first render.
  const answeredBefore = useSyncExternalStore(
    noSubscribe,
    () => { try { return live && !!form.settings.oncePerPerson && localStorage.getItem(doneKey(token!)) === '1'; } catch { return false; } },
    () => false,
  );

  // Everything the current answers make visible. Recomputed each render, so a
  // branch opens/closes the moment the answer it depends on changes.
  const shown = useMemo(() => visibleBlocks(form.blocks, answers), [form.blocks, answers]);
  const asked = useMemo(() => shown.filter((b) => isAsked(b.type)), [shown]);
  const pages = useMemo(() => pagesOf(shown), [shown]);

  // Branching can remove the question (or the page) you're standing on — never strand it.
  // Adjusted during render, not after: an effect let one frame paint the stranded step first.
  const maxStep = Math.max(0, asked.length - 1);
  const safeStep = Math.min(step, maxStep);
  if (step > maxStep) setStep(maxStep);
  const maxPage = Math.max(0, pages.length - 1);
  const safePage = Math.min(page, maxPage);
  if (page > maxPage) setPage(maxPage);

  const responseId = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          // silent: a partial save retries on the next keystroke (responseId
          // stays null), and someone still filling in a form must not be
          // interrupted by an error about a draft row they never asked for.
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

  function clearError(id: string) {
    if (errors[id]) setErrors((e) => { const { [id]: _drop, ...rest } = e; return rest; });
  }

  function setAnswer(block: FormBlock, value: AnswerValue) {
    const next = { ...answers, [block.id]: value };
    setAnswers(next);
    clearError(block.id);
    persist(next, block.id);
    // Focus mode: a single-choice answer IS the "next" gesture. (A choice with "Other" waits —
    // the person may be about to type.)
    const auto = AUTO_ADVANCE.has(block.type) || (block.type === 'select' && !block.other);
    if (focus && auto && value !== null && value !== '') setTimeout(() => advance(block, value), 180);
  }

  function blurValidate(block: FormBlock) {
    const err = validateAnswer(block, answers[block.id] ?? null);
    setErrors((e) => (err ? { ...e, [block.id]: err } : (() => { const { [block.id]: _drop, ...rest } = e; return rest; })()));
  }

  /** Validate just these blocks; record their errors and return whether they passed. */
  function check(blocks: FormBlock[]): boolean {
    const found: Record<string, string> = {};
    for (const b of blocks) {
      if (!isField(b.type)) continue;
      const err = validateAnswer(b, answers[b.id] ?? null);
      if (err) found[b.id] = err;
    }
    setErrors((e) => ({ ...e, ...found }));
    return Object.keys(found).length === 0;
  }

  /** A new page starts at its top, like turning one. Instant — the person asked for it. */
  const toTop = () => top.current?.scrollIntoView({ block: 'start' });

  function nextPage() {
    if (!check(pages[safePage] ?? [])) { setFormError('Please check the highlighted answers.'); return; }
    setFormError(null);
    const lastField = [...(pages[safePage] ?? [])].reverse().find((b) => isAsked(b.type));
    if (lastField) persist(answers, lastField.id);
    setPage(safePage + 1);
    toTop();
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
      // Go back to the first question that needs attention, wherever it is.
      if (focus) {
        const i = asked.findIndex((b) => found[b.id]);
        if (i >= 0) setStep(i);
      } else {
        const p = pages.findIndex((pg) => pg.some((b) => found[b.id]));
        if (p >= 0 && p !== safePage) { setPage(p); toTop(); }
      }
      return;
    }
    setFormError(null);
    if (preview || !token) { setState('sent'); return; } // preview: show the ending, write nothing

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
    try {
      localStorage.removeItem(respKey(token));
      if (form.settings.oncePerPerson) localStorage.setItem(doneKey(token), '1');
    } catch { /* ignore */ }
    responseId.current = null;
    setState('sent');
    // The ending still renders first, so if the browser refuses the jump the person is not left
    // looking at a form they have already sent.
    if (isHttpsUrl(form.settings.redirectUrl)) window.location.assign(form.settings.redirectUrl);
  }

  // Kept in a ref, not state: nothing on screen depends on it, and re-rendering
  // the form on a bot's keystroke would be a tell.
  const onHoneypot = (v: string) => { honeypot.current = v; };

  if (state === 'sent' || answeredBefore) {
    return (
      <FormSheet studio={form.studio} bare={embed}>
        <Ending
          title={answeredBefore && state !== 'sent' ? 'You’ve already responded.' : form.settings.thanksTitle?.trim() || ENDING_DEFAULTS.title}
          message={answeredBefore && state !== 'sent' ? 'Thanks. Your answers are with them.' : form.settings.thanks?.trim() || ENDING_DEFAULTS.message}
          redirect={preview && isHttpsUrl(form.settings.redirectUrl) ? form.settings.redirectUrl : null}
        />
        {/* A payment is a follow-up to a captured response, never a gate on it:
            the answer is already saved, so a closed tab can't lose it. */}
        {state === 'sent' && isHttpsUrl(form.settings.paymentUrl) && (
          <div className="mt-6 flex justify-center">
            <a href={form.settings.paymentUrl} target="_blank" rel="noopener noreferrer" className={button({ variant: 'neutral', size: 'lg' })}>
              {form.settings.paymentLabel?.trim() || 'Pay now'}
            </a>
          </div>
        )}
      </FormSheet>
    );
  }

  const identityFields = (
    <div className="flex flex-col gap-7 border-t border-line-soft pt-7">
      <Field label="Your name" optional>
        <TextInput value={identity.name} onChange={(e) => setIdentity((i) => ({ ...i, name: e.target.value }))} autoComplete="name" />
      </Field>
      <Field label="Email" error={errors.__identity}>
        <TextInput type="email" value={identity.email} onChange={(e) => setIdentity((i) => ({ ...i, email: e.target.value }))} autoComplete="email" />
      </Field>
    </div>
  );
  const spamCheck = (
    <>
      {turnstileActive && <div className="mt-7"><TurnstileWidget siteKey={turnstileSiteKey!} onToken={setTurnstileToken} /></div>}
      {!live && form.settings.turnstile && <p className="mt-7 text-meta text-ink-500">A spam check appears here before submitting.</p>}
    </>
  );

  // ── Focus mode: one question at a time ──────────────────────────────────
  if (focus && asked.length > 0) {
    const block = asked[safeStep];
    const last = safeStep >= maxStep;
    // Any heading/statement sitting directly above this question is its context.
    const idx = shown.findIndex((b) => b.id === block.id);
    const lead = idx > 0 && (shown[idx - 1].type === 'heading' || shown[idx - 1].type === 'statement') ? shown[idx - 1] : null;

    return (
      <FormSheet studio={form.studio} bare={embed}>
        <div ref={top} />
        <Progress at={safeStep + 1} of={asked.length} label={`${safeStep + 1} of ${asked.length}`} />

        {lead && (
          lead.type === 'heading'
            ? <h2 className="mb-2 font-display text-h4 text-ink-600">{lead.label}</h2>
            : <p className="mb-3 whitespace-pre-wrap text-body text-ink-600">{lead.label}</p>
        )}

        <div
          key={block.id}
          className="zb-enter animate-fadein"
          onKeyDown={(e) => {
            // Enter advances, except in a paragraph where it's a newline.
            if (e.key === 'Enter' && !e.shiftKey && block.type !== 'long_text') { e.preventDefault(); advance(block); }
          }}
        >
          {block.type !== 'checkbox' && (
            <h1 className="font-editorial text-h2 leading-snug text-ink-900">
              {block.label?.trim() || 'Question'}
              {!block.required && <span className="ml-2 align-middle text-meta font-normal text-ink-500">Optional</span>}
            </h1>
          )}
          {block.help && <p className="mt-2 text-body text-ink-500">{block.help}</p>}

          <div className="mt-6">
            <FieldControl block={block} value={answers[block.id] ?? null} onChange={(v) => setAnswer(block, v)}
              onBlur={() => blurValidate(block)} uploadFile={uploadFile} seed={seed} invalid={!!errors[block.id]} />
          </div>

          {errors[block.id] && <ErrorLine>{errors[block.id]}</ErrorLine>}
        </div>

        {last && form.settings.collectIdentity && <div className="mt-8">{identityFields}</div>}
        {last && spamCheck}
        {formError && <p className="mt-6 text-meta text-danger-600" role="alert">{formError}</p>}

        <div className="mt-9 flex items-center gap-2">
          <Button
            variant="neutral"
            size="lg"
            onClick={() => (last ? void send() : advance(block))}
            loading={state === 'sending'}
            iconRight={last ? undefined : <Icon icon={ArrowRight} size={16} />}
          >
            {last ? submitLabel : 'Next'}
          </Button>
          {safeStep > 0 && (
            <Button variant="ghost" size="lg" onClick={() => setStep((s) => Math.max(0, s - 1))} icon={<Icon icon={ArrowLeft} size={16} />}>
              Back
            </Button>
          )}
          {preview && <span className="ml-1 text-meta text-ink-500">Preview: nothing is saved.</span>}
        </div>
        <Honeypot onChange={onHoneypot} />
      </FormSheet>
    );
  }

  // ── Page mode: the form as a document, one page at a time ───────────────
  const current = pages[safePage] ?? [];
  const lastPage = safePage >= maxPage;
  return (
    <FormSheet studio={form.studio} bare={embed}>
      <div ref={top} className="scroll-mt-6" />
      {pages.length > 1 && <Progress at={safePage + 1} of={pages.length} label={`Page ${safePage + 1} of ${pages.length}`} />}
      {safePage === 0 && (
        <header className="mb-8">
          <h1 className={SHEET_TITLE}>{form.title}</h1>
          {form.description && <p className={`mt-3 ${SHEET_DESCRIPTION}`}>{form.description}</p>}
        </header>
      )}

      <div className={`flex flex-col ${SHEET_GAP}`}>
        {current.map((b) => (
          <BlockView key={b.id} block={b} value={answers[b.id] ?? null} error={errors[b.id]} seed={seed}
            onChange={(v) => setAnswer(b, v)} onBlur={() => blurValidate(b)} uploadFile={uploadFile} />
        ))}
        {lastPage && form.settings.collectIdentity && identityFields}
      </div>

      {lastPage && spamCheck}
      {formError && <p className="mt-6 text-meta text-danger-600" role="alert">{formError}</p>}

      <div className="mt-9 flex items-center gap-2 border-t border-line-soft pt-6">
        {lastPage ? (
          <Button variant="neutral" size="lg" onClick={send} loading={state === 'sending'}>{submitLabel}</Button>
        ) : (
          <Button variant="neutral" size="lg" onClick={nextPage} iconRight={<Icon icon={ArrowRight} size={16} />}>Next</Button>
        )}
        {safePage > 0 && (
          <Button variant="ghost" size="lg" onClick={() => { setPage(safePage - 1); toTop(); }} icon={<Icon icon={ArrowLeft} size={16} />}>
            Back
          </Button>
        )}
        {preview && <span className="ml-1 text-meta text-ink-500">Preview: nothing is saved.</span>}
      </div>
      <Honeypot onChange={onHoneypot} />
    </FormSheet>
  );
}

/** How far along — thin, quiet, always answerable: "how much is left?". Transform only. */
function Progress({ at, of, label }: { at: number; of: number; label: string }) {
  return (
    <div className="mb-8 flex items-center gap-3">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-fill">
        <div
          className="h-full w-full rounded-full bg-ink-900 transition-transform duration-slow ease-standard"
          style={{ transform: `translateX(-${100 - Math.min(100, (at / of) * 100)}%)` }}
        />
      </div>
      <span className="shrink-0 tabular-nums text-meta text-ink-500">{label}</span>
    </div>
  );
}

/** What the person sees once they have sent it. Shared with the builder's ending preview. */
export function Ending({ title, message, redirect }: { title: string; message: string; redirect?: string | null }) {
  let host: string | null = null;
  try { host = redirect ? new URL(redirect).host : null; } catch { host = null; }
  return (
    <div className="py-8 text-center">
      <Icon icon={CheckCircle} size={24} className="mx-auto text-success-600" />
      <h1 className="mt-3 font-display text-h3 text-ink-900">{title}</h1>
      <p className="mx-auto mt-1.5 max-w-[40ch] whitespace-pre-wrap text-body text-ink-500">{message}</p>
      {host && <p className="mt-4 text-meta text-ink-500">On the live form, people go on to {host}.</p>}
    </div>
  );
}

function ErrorLine({ children, className = 'mt-3' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`flex items-center gap-1 text-meta text-danger-600 ${className}`} role="alert">
      <Icon icon={CircleAlert} size={12} className="shrink-0" />
      {children}
    </p>
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

type UploadFn = (fieldId: string, file: File) => Promise<{ path: string } | { error: string }>;

// One block in page mode: fields get a <Field> wrapper, layout blocks are content.
function BlockView({ block, value, error, onChange, onBlur, uploadFile, seed }: {
  block: FormBlock; value: AnswerValue; error?: string; seed?: number;
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
      default:
        return null; // a page break is the page itself
    }
  }
  if (block.type === 'hidden') return null;

  const control = <FieldControl block={block} value={value} onChange={onChange} onBlur={onBlur} uploadFile={uploadFile} seed={seed} invalid={!!error} />;
  // A consent box carries its own words; a second label above it would say them twice.
  if (block.type === 'checkbox') {
    return (
      <div className="flex flex-col gap-1">
        {control}
        {error ? <ErrorLine className="">{error}</ErrorLine> : block.help && <p className="text-meta text-ink-500">{block.help}</p>}
      </div>
    );
  }
  return (
    <Field label={block.label?.trim() || 'Question'} optional={!block.required} helper={block.help} error={error}>
      {control}
    </Field>
  );
}

// The form content model — a PLAIN module (no 'use server', no 'server-only') so
// the builder (client), the renderer (client), the loaders (server) and the
// actions (server) all agree on one shape. Mirrors the block-list idiom of
// lib/blocks.ts: an ordered list of typed blocks, each with a stable id.
//
// A field block's `id` doubles as its key in a response's `answers` jsonb — that
// is why ids are generated once and never rewritten (renaming a label keeps the
// answers attached to it).
//
// ── THE BENCHMARK (2026-10-01) ─────────────────────────────────────────────
// Tally is the form builder every comparison ranks first, and its field list is
// the bar this file answers to: contact fields include a LINK, choices include a
// single consent CHECKBOX, rating comes as stars, a LINEAR SCALE (the 0–10 NPS
// question) and a RANKING, time sits beside date, and HIDDEN fields carry values
// in from the link. Matrix, signature, payment and calculated fields are the
// remainder, each owed for a stated reason in PROGRESS.md rather than faked here.

export const FIELD_TYPES = [
  'short_text', 'long_text', 'email', 'phone', 'url', 'number', 'date', 'time',
  'select', 'multi_select', 'dropdown', 'yes_no', 'checkbox',
  'rating', 'scale', 'ranking', 'file', 'hidden',
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const LAYOUT_TYPES = ['heading', 'statement', 'divider', 'page_break'] as const;
export type LayoutType = (typeof LAYOUT_TYPES)[number];

export type FormBlockType = FieldType | LayoutType;

// ── Conditional logic (F2) ────────────────────────────────────────────────
// ONE mechanism, deliberately: a block can carry a condition saying when it is
// shown. In page mode that shows/hides the question; in focus mode a hidden
// question is simply skipped — which IS branching, without a second concept or
// a node-graph editor to maintain. A condition may only reference an EARLIER
// field (enforced by the author UI), so cycles are impossible by construction.
export const LOGIC_OPS = ['is', 'is_not', 'contains', 'gt', 'lt', 'answered', 'not_answered'] as const;
export type LogicOp = (typeof LOGIC_OPS)[number];
export const OP_LABEL: Record<LogicOp, string> = {
  is: 'is', is_not: 'is not', contains: 'contains',
  gt: 'is more than', lt: 'is less than',
  answered: 'is answered', not_answered: 'is not answered',
};
/** Ops that don't take a comparison value. */
export const isUnaryOp = (op: LogicOp) => op === 'answered' || op === 'not_answered';

export type Condition = { fieldId: string; op: LogicOp; value?: string };

export type FormBlock = {
  id: string;
  type: FormBlockType;
  label: string;
  help?: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];        // select / multi_select / dropdown / ranking
  showWhen?: Condition;      // undefined = always shown
  /**
   * Bounds, read per type — one pair rather than five, because a question only ever has one:
   *   number → the allowed VALUE · short/long text → the allowed LENGTH ·
   *   multiple choice → how many PICKS · linear scale → its two ENDS.
   */
  min?: number;
  max?: number;
  /** Linear scale: the words under each end ("Not likely" · "Very likely"). */
  minLabel?: string;
  maxLabel?: string;
  /** Choice questions: each person sees the options in their own order. */
  shuffle?: boolean;
  /** Single / multiple choice: an "Other" answer the person types themselves. */
  other?: boolean;
  /**
   * The link parameter that fills this question in (`?email=dana@…`). For a HIDDEN field it is
   * also the field's name — the thing the response table and the export call it.
   */
  param?: string;
};

export type FormContent = { blocks: FormBlock[] };

export type FormMode = 'page' | 'focus';
export type FormSettings = {
  mode?: FormMode;           // F1 renders 'page'; 'focus' lands in F2
  thanks?: string;           // message shown after submit
  thanksTitle?: string;      // the ending's heading (defaults to "Thank you.")
  submitLabel?: string;      // the submit button's words (defaults to "Submit")
  redirectUrl?: string | null; // send them here instead of the ending (https only)
  oncePerPerson?: boolean;   // one response per browser
  collectIdentity?: boolean; // ask name + email before submitting
  limit?: number | null;     // max complete responses
  closeAt?: string | null;   // ISO date after which the form stops accepting
  webhookUrl?: string | null;// F4: POST each complete response here (https only)
  notifyByEmail?: boolean;   // F4: email the owner on each complete response
  turnstile?: boolean;       // F4: require a Cloudflare Turnstile spam check to submit
  paymentUrl?: string | null;// F4: a Stripe Payment Link, shown after they submit
  paymentLabel?: string;     // F4: the pay button's words (defaults to "Pay now")
};

/** What the respondent reads when the owner wrote nothing. One copy, used by builder and renderer. */
export const ENDING_DEFAULTS = {
  title: 'Thank you.',
  message: 'Your response has been sent.',
  submit: 'Submit',
} as const;

/** A valid https URL — the bar for any owner-supplied link we render or call. */
export function isHttpsUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string' || !raw.trim()) return false;
  try { return new URL(raw.trim()).protocol === 'https:'; } catch { return false; }
}

/**
 * Name of the hidden decoy input on every public form. Lives HERE, not in the
 * actions file: a 'use server' module may only export async functions, so any
 * shared constant has to sit in a plain module (same reason as request-status).
 */
export const HONEYPOT_FIELD = 'zb_website';

export type AnswerValue = string | number | string[] | boolean | null;
export type Answers = Record<string, AnswerValue>;

// ── Field catalogue — drives the insert menu, grouped the way the research
// suggests. Labels here are the ONE name for each field type across the whole
// product.
export const FIELD_GROUPS = ['Text', 'Contact', 'Choice', 'Rating', 'Date & time', 'Other', 'Layout'] as const;
export type FieldGroup = (typeof FIELD_GROUPS)[number];

export const BLOCK_META: Record<FormBlockType, { label: string; group: FieldGroup; hint?: string }> = {
  short_text:   { label: 'Short text',      group: 'Text',        hint: 'A single line' },
  long_text:    { label: 'Long text',       group: 'Text',        hint: 'A paragraph' },
  number:       { label: 'Number',          group: 'Text' },
  email:        { label: 'Email',           group: 'Contact' },
  phone:        { label: 'Phone',           group: 'Contact',     hint: 'Optional by default' },
  url:          { label: 'Link',            group: 'Contact',     hint: 'A web address' },
  select:       { label: 'Single choice',   group: 'Choice' },
  multi_select: { label: 'Multiple choice', group: 'Choice' },
  dropdown:     { label: 'Dropdown',        group: 'Choice' },
  yes_no:       { label: 'Yes / no',        group: 'Choice' },
  checkbox:     { label: 'Checkbox',        group: 'Choice',      hint: 'One box to tick' },
  rating:       { label: 'Rating',          group: 'Rating',      hint: '1 to 5 stars' },
  scale:        { label: 'Linear scale',    group: 'Rating',      hint: 'A number on a line' },
  ranking:      { label: 'Ranking',         group: 'Rating',      hint: 'Put options in order' },
  date:         { label: 'Date',            group: 'Date & time' },
  time:         { label: 'Time',            group: 'Date & time' },
  file:         { label: 'File upload',     group: 'Other',       hint: 'One attachment' },
  hidden:       { label: 'Hidden field',    group: 'Other',       hint: 'Filled from the link' },
  heading:      { label: 'Heading',         group: 'Layout' },
  statement:    { label: 'Text',            group: 'Layout',      hint: 'Explain something' },
  divider:      { label: 'Divider',         group: 'Layout' },
  page_break:   { label: 'Page break',      group: 'Layout',      hint: 'Start a new page' },
};

export function isField(type: FormBlockType): type is FieldType {
  return (FIELD_TYPES as readonly string[]).includes(type);
}
export function hasOptions(type: FormBlockType): boolean {
  return type === 'select' || type === 'multi_select' || type === 'dropdown' || type === 'ranking';
}
/** Options whose ORDER the respondent could be biased by — the ones `shuffle` applies to. */
export const canShuffle = (type: FormBlockType) => hasOptions(type);
/** Questions that can take an "Other" the person types. */
export const canHaveOther = (type: FormBlockType) => type === 'select' || type === 'multi_select';
/** A question the respondent actually sees — every field but a hidden one. */
export const isAsked = (type: FormBlockType) => isField(type) && type !== 'hidden';

/** What a question is called in a table, an export and a webhook: a hidden field goes by its name. */
export function blockName(b: FormBlock): string {
  if (b.type === 'hidden') return b.param?.trim() || 'Hidden field';
  return b.label?.trim() || 'Untitled question';
}

export function genBlockId(): string {
  // Stable, collision-safe enough for a single document's block list.
  return `f${Math.random().toString(36).slice(2, 10)}`;
}

const DEFAULT_LABEL: Partial<Record<FormBlockType, string>> = {
  email: 'Email', phone: 'Phone', url: 'Website', yes_no: 'Yes or no?', rating: 'How would you rate this?',
  scale: 'How likely are you to recommend us?', ranking: 'Put these in order of importance',
  checkbox: 'I agree to the terms', file: 'Upload a file',
  heading: 'Section', statement: '', divider: '', page_break: '', hidden: '',
};

export function emptyBlock(type: FormBlockType): FormBlock {
  const block: FormBlock = { id: genBlockId(), type, label: DEFAULT_LABEL[type] ?? '' };
  if (hasOptions(type)) block.options = type === 'ranking' ? ['Option 1', 'Option 2', 'Option 3'] : ['Option 1', 'Option 2'];
  // The NPS shape, because it is the question a linear scale is almost always asked for.
  if (type === 'scale') { block.min = 0; block.max = 10; }
  if (type === 'hidden') block.param = 'source';
  // Phone stays optional by default — the single biggest field-level abandonment
  // fix in the research (-36.9pp when optional). A hidden field is never asked.
  if (isField(type) && type !== 'phone' && type !== 'hidden') block.required = false;
  return block;
}

// The three blocks a brand-new form opens with, so the page is never blank.
export function starterBlocks(): FormBlock[] {
  return [
    { ...emptyBlock('short_text'), label: 'Your name' },
    { ...emptyBlock('email'), label: 'Email' },
    { ...emptyBlock('long_text'), label: 'How can we help?' },
  ];
}

/** The ends of a linear scale, clamped to what the control can draw (0 or 1, up to 10). */
export function scaleRange(b: Pick<FormBlock, 'min' | 'max'>): { min: number; max: number } {
  const min = b.min === 1 ? 1 : 0;
  const max = Math.min(10, Math.max(min + 2, Math.round(b.max ?? 10)));
  return { min, max };
}

/** A link parameter's name: letters, digits, `_ . -`, at most 40 — what a URL can carry unescaped. */
export function cleanParam(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const p = raw.trim().replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 40);
  return p || undefined;
}

const finite = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const shortText = (v: unknown, n: number): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : undefined;

// Defensive parse — content arrives as unknown jsonb. Anything malformed
// degrades to an empty form rather than throwing in a render.
export function toFormContent(raw: unknown): FormContent {
  if (!raw || typeof raw !== 'object') return { blocks: [] };
  const blocks = (raw as { blocks?: unknown }).blocks;
  if (!Array.isArray(blocks)) return { blocks: [] };
  const clean: FormBlock[] = [];
  for (const b of blocks) {
    if (!b || typeof b !== 'object') continue;
    const r = b as Record<string, unknown>;
    const { id, type, label, help, placeholder, required, options } = r;
    if (typeof id !== 'string' || typeof type !== 'string') continue;
    if (!(type in BLOCK_META)) continue;
    const condition = toCondition(r.showWhen);
    const min = finite(r.min);
    const max = finite(r.max);
    const minLabel = shortText(r.minLabel, 40);
    const maxLabel = shortText(r.maxLabel, 40);
    const param = cleanParam(r.param);
    clean.push({
      id,
      type: type as FormBlockType,
      label: typeof label === 'string' ? label : '',
      ...(typeof help === 'string' && help ? { help } : {}),
      ...(typeof placeholder === 'string' && placeholder ? { placeholder } : {}),
      ...(required === true ? { required: true } : {}),
      ...(Array.isArray(options) ? { options: options.filter((o): o is string => typeof o === 'string') } : {}),
      ...(condition ? { showWhen: condition } : {}),
      ...(min !== undefined ? { min } : {}),
      ...(max !== undefined ? { max } : {}),
      ...(minLabel ? { minLabel } : {}),
      ...(maxLabel ? { maxLabel } : {}),
      ...(r.shuffle === true ? { shuffle: true } : {}),
      ...(r.other === true ? { other: true } : {}),
      ...(param ? { param } : {}),
    });
  }
  return { blocks: clean };
}

function toCondition(raw: unknown): Condition | null {
  if (!raw || typeof raw !== 'object') return null;
  const { fieldId, op, value } = raw as Record<string, unknown>;
  if (typeof fieldId !== 'string' || typeof op !== 'string') return null;
  if (!(LOGIC_OPS as readonly string[]).includes(op)) return null;
  return { fieldId, op: op as LogicOp, ...(typeof value === 'string' ? { value } : {}) };
}

export function toFormSettings(raw: unknown): FormSettings {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    mode: s.mode === 'focus' ? 'focus' : 'page',
    thanks: typeof s.thanks === 'string' ? s.thanks : undefined,
    thanksTitle: shortText(s.thanksTitle, 80),
    submitLabel: shortText(s.submitLabel, 40),
    redirectUrl: isHttpsUrl(s.redirectUrl) ? s.redirectUrl.trim() : null,
    oncePerPerson: s.oncePerPerson === true,
    collectIdentity: s.collectIdentity === true,
    limit: typeof s.limit === 'number' ? s.limit : null,
    closeAt: typeof s.closeAt === 'string' ? s.closeAt : null,
    webhookUrl: typeof s.webhookUrl === 'string' && s.webhookUrl.trim() ? s.webhookUrl.trim() : null,
    notifyByEmail: s.notifyByEmail === true,
    turnstile: s.turnstile === true,
    paymentUrl: isHttpsUrl(s.paymentUrl) ? s.paymentUrl.trim() : null,
    paymentLabel: typeof s.paymentLabel === 'string' && s.paymentLabel.trim() ? s.paymentLabel.trim().slice(0, 60) : undefined,
  };
}

export const fields = (blocks: FormBlock[]): FormBlock[] => blocks.filter((b) => isField(b.type));

// ── Validation — the same rules run in the browser (inline, on blur) and again
// server-side on submit, so a crafted request can't skip a required question.
/** The product's ONE email rule. Exported so the waitlist (lib/waitlist.ts) asks the same question
 *  a form field does — two regexes would eventually disagree about the same address. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Is this a web address a person meant? A scheme is optional — people type
 * `northstar.co`, and refusing that is the form being pedantic — but the host
 * needs a dot, and nothing but http(s) is a website.
 */
export function isWebAddress(raw: string): boolean {
  const s = raw.trim();
  if (!s || /\s/.test(s)) return false;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`);
    return (u.protocol === 'https:' || u.protocol === 'http:') && /\.[a-z]{2,}$/i.test(u.hostname);
  } catch { return false; }
}

export function isEmpty(value: AnswerValue): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Returns a plain-sentence error, or null when the answer is acceptable. */
export function validateAnswer(block: FormBlock, value: AnswerValue): string | null {
  if (!isField(block.type)) return null;
  // A hidden field is filled by the link, never by the person — nothing to tell them.
  if (block.type === 'hidden') return null;
  // A consent box is answered by TICKING it. An unticked box is `false`, which is not "empty" to
  // `isEmpty`, so it is decided here or a required "I agree" would pass unticked.
  if (block.type === 'checkbox') return block.required && value !== true ? 'Please tick this to continue.' : null;
  if (isEmpty(value)) return block.required ? 'This one is required.' : null;

  switch (block.type) {
    case 'email':
      return typeof value === 'string' && EMAIL_RE.test(value.trim()) ? null : 'That doesn’t look like an email address.';
    case 'phone': {
      const digits = String(value).replace(/\D/g, '');
      return digits.length >= 6 ? null : 'That doesn’t look like a phone number.';
    }
    case 'url':
      return typeof value === 'string' && isWebAddress(value) ? null : 'That doesn’t look like a web address.';
    case 'time':
      return typeof value === 'string' && TIME_RE.test(value) ? null : 'Please pick a time.';
    case 'date':
      return typeof value === 'string' && DATE_RE.test(value) ? null : 'Please pick a date.';
    case 'number': {
      const n = Number(value);
      if (!Number.isFinite(n)) return 'Please enter a number.';
      if (block.min !== undefined && n < block.min) return `Please enter ${block.min} or more.`;
      if (block.max !== undefined && n > block.max) return `Please enter ${block.max} or less.`;
      return null;
    }
    case 'rating': {
      const n = Number(value);
      return Number.isInteger(n) && n >= 1 && n <= 5 ? null : 'Please pick a rating.';
    }
    case 'scale': {
      const n = Number(value);
      const { min, max } = scaleRange(block);
      return Number.isInteger(n) && n >= min && n <= max ? null : 'Please pick a number on the scale.';
    }
    case 'multi_select': {
      const picked = Array.isArray(value) ? value.length : 1;
      if (block.min !== undefined && picked < block.min) return `Please pick at least ${block.min}.`;
      if (block.max !== undefined && picked > block.max) return `Please pick no more than ${block.max}.`;
      return null;
    }
    case 'ranking': {
      // A ranking is the options, reordered: nothing invented, nothing twice.
      const options = block.options ?? [];
      if (!Array.isArray(value) || new Set(value).size !== value.length || value.some((v) => !options.includes(v))) {
        return 'Please rank the options shown.';
      }
      return block.required && value.length < options.length ? 'Please rank every option.' : null;
    }
    case 'file':
      // The answer is a storage path the upload action already vetted (size,
      // type, ownership). Presence is all that's left to check, and the empty
      // guard above already did it — a non-empty path is a good answer.
      return null;
    case 'short_text':
    case 'long_text': {
      const len = typeof value === 'string' ? value.trim().length : 0;
      if (block.min !== undefined && len < block.min) return `Please write at least ${block.min} characters.`;
      if (block.max !== undefined && len > block.max) return `Please keep it to ${block.max} characters or fewer.`;
      return len > 10000 ? 'That answer is too long.' : null;
    }
    default:
      if (typeof value === 'string' && value.length > 10000) return 'That answer is too long.';
      return null;
  }
}

// ── Visibility ────────────────────────────────────────────────────────────
/** An answer as the words a condition compares against: a ticked box is "yes". */
function comparable(raw: AnswerValue): string[] {
  if (Array.isArray(raw)) return raw.map((v) => String(v).trim().toLowerCase());
  if (typeof raw === 'boolean') return [raw ? 'yes' : 'no'];
  return [String(raw ?? '').trim().toLowerCase()];
}

/**
 * Does this block's condition currently hold? A condition pointing at a field
 * that no longer exists is treated as INERT (block stays visible) rather than
 * silently hiding a question — losing a question is worse than showing one, and
 * the builder flags the broken rule for the author.
 */
export function conditionHolds(cond: Condition, blocks: FormBlock[], answers: Answers): boolean {
  const source = blocks.find((b) => b.id === cond.fieldId);
  if (!source) return true; // inert — the referenced field was deleted
  const raw = answers[cond.fieldId] ?? null;
  // An unticked consent box is a "no", and a "no" is an answer.
  const empty = source.type === 'checkbox' ? raw !== true : isEmpty(raw);

  if (cond.op === 'answered') return !empty;
  if (cond.op === 'not_answered') return empty;

  const target = (cond.value ?? '').trim().toLowerCase();
  if (cond.op === 'gt' || cond.op === 'lt') {
    const a = Number(raw);
    const b = Number(cond.value);
    if (empty || !Number.isFinite(a) || !Number.isFinite(b)) return false;
    return cond.op === 'gt' ? a > b : a < b;
  }

  // Multi-select compares against the set of chosen options.
  const picked = source.type === 'checkbox' ? [raw === true ? 'yes' : 'no'] : comparable(raw);
  switch (cond.op) {
    case 'is': return picked.includes(target);
    case 'is_not': return !picked.includes(target);
    case 'contains': return picked.some((p) => p.includes(target));
    default: return true;
  }
}

/** Is this block shown, given the answers so far? */
export function isBlockVisible(block: FormBlock, blocks: FormBlock[], answers: Answers): boolean {
  return block.showWhen ? conditionHolds(block.showWhen, blocks, answers) : true;
}

/** The blocks currently on screen, in order. */
export function visibleBlocks(blocks: FormBlock[], answers: Answers): FormBlock[] {
  return blocks.filter((b) => isBlockVisible(b, blocks, answers));
}

/**
 * All errors for a submission, keyed by block id. Empty object = good to send.
 * Hidden questions are NEVER validated — a required question the respondent was
 * never shown must not be able to block their submit.
 */
export function validateAll(blocks: FormBlock[], answers: Answers): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const b of fields(visibleBlocks(blocks, answers))) {
    const err = validateAnswer(b, answers[b.id] ?? null);
    if (err) errors[b.id] = err;
  }
  return errors;
}

/** Fields whose answers should be kept — everything currently visible. */
export function visibleFieldIds(blocks: FormBlock[], answers: Answers): Set<string> {
  return new Set(fields(visibleBlocks(blocks, answers)).map((b) => b.id));
}

/**
 * The answers a condition can test this field against, when they are FIXED —
 * so the logic editor offers a list instead of a box to mistype into. A ranking
 * has no single answer to compare, so it is not offered as a condition source.
 */
export function choicesOf(b: FormBlock | undefined): string[] | null {
  if (!b) return null;
  if (b.type === 'yes_no' || b.type === 'checkbox') return ['Yes', 'No'];
  if (b.type === 'rating') return ['1', '2', '3', '4', '5'];
  if (b.type === 'scale') {
    const { min, max } = scaleRange(b);
    return Array.from({ length: max - min + 1 }, (_, i) => String(min + i));
  }
  if (b.type === 'ranking') return null;
  return b.options?.length ? b.options : null;
}

/** Can this block be the "when" of another block's condition? */
export const canDriveLogic = (b: FormBlock) => isField(b.type) && b.type !== 'ranking' && b.type !== 'file';

/**
 * A condition as a plain English sentence. Returns null when the rule is broken
 * (its source field was deleted) so the UI can say so.
 */
export function conditionSentence(cond: Condition, blocks: FormBlock[]): string | null {
  const source = blocks.find((b) => b.id === cond.fieldId);
  if (!source) return null;
  const name = source.type === 'hidden' ? blockName(source) : source.label?.trim() || 'a question';
  if (isUnaryOp(cond.op)) return `“${name}” ${OP_LABEL[cond.op]}`;
  return `“${name}” ${OP_LABEL[cond.op]} “${cond.value ?? ''}”`;
}

// ── Pages ─────────────────────────────────────────────────────────────────
/**
 * The form split at its page breaks. Pass the VISIBLE blocks, so a page whose
 * every question is hidden by logic is skipped rather than shown empty — and a
 * page holding nothing a person can see (only hidden fields) is no page at all.
 */
export function pagesOf(blocks: FormBlock[]): FormBlock[][] {
  const pages: FormBlock[][] = [[]];
  for (const b of blocks) {
    if (b.type === 'page_break') { pages.push([]); continue; }
    pages[pages.length - 1].push(b);
  }
  return pages.filter((p) => p.some((b) => b.type !== 'hidden'));
}

// ── Filling a form in from its link ───────────────────────────────────────
/**
 * Answers carried in by the link: `?email=dana@northstar.co` fills the question
 * whose parameter is `email`, and a hidden field takes its value the same way.
 *
 * Every value is UNTRUSTED — anyone can edit a URL — so each is held to what
 * its question accepts: a choice must name a real option (or land in "Other"
 * where the question has one), a number must be a number, a date must be a
 * date. Anything that does not fit is dropped, never coerced.
 */
export function prefillAnswers(blocks: FormBlock[], params: URLSearchParams): Answers {
  const out: Answers = {};
  for (const b of fields(blocks)) {
    const key = b.param;
    if (!key) continue;
    const raw = params.get(key);
    if (raw === null) continue;
    const v = raw.trim().slice(0, 500);
    if (!v) continue;
    const pick = (o: string) => (b.options ?? []).find((x) => x.toLowerCase() === o.trim().toLowerCase());
    switch (b.type) {
      case 'select':
      case 'dropdown': {
        const hit = pick(v);
        if (hit) out[b.id] = hit;
        else if (b.type === 'select' && b.other) out[b.id] = v;
        break;
      }
      case 'multi_select': {
        const hits = v.split(',').map(pick).filter((x): x is string => !!x);
        if (hits.length) out[b.id] = [...new Set(hits)];
        break;
      }
      case 'yes_no':
        if (/^(yes|true|1)$/i.test(v)) out[b.id] = 'Yes';
        else if (/^(no|false|0)$/i.test(v)) out[b.id] = 'No';
        break;
      case 'checkbox':
        if (/^(yes|true|1|on)$/i.test(v)) out[b.id] = true;
        break;
      case 'rating':
      case 'scale': {
        const n = Number(v);
        const { min, max } = b.type === 'rating' ? { min: 1, max: 5 } : scaleRange(b);
        if (Number.isInteger(n) && n >= min && n <= max) out[b.id] = n;
        break;
      }
      case 'number':
        if (Number.isFinite(Number(v))) out[b.id] = v;
        break;
      case 'date':
        if (DATE_RE.test(v)) out[b.id] = v;
        break;
      case 'time':
        if (TIME_RE.test(v)) out[b.id] = v;
        break;
      case 'ranking':
      case 'file':
        break; // an order or an upload cannot honestly arrive in a URL
      default:
        out[b.id] = v;
    }
  }
  return out;
}

// ── Option order ──────────────────────────────────────────────────────────
/**
 * The options in a seeded random order (Fisher–Yates over mulberry32). Seeded,
 * so one person sees one order for the whole visit — a list that reshuffled on
 * every render would move the option they were reaching for.
 */
export function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** One-line display of an answer — used by the response drawer, insights and CSV export. */
export function answerToText(block: FormBlock, value: AnswerValue): string {
  if (block.type === 'checkbox') return value === true ? 'Yes' : '';
  if (isEmpty(value)) return '';
  // yes/no arrives as the option STRING ('Yes'/'No') from the radio, and as a
  // boolean from anything programmatic — match case-insensitively so a "Yes"
  // can never be reported as a "No" in the table, the drawer, or the export.
  if (block.type === 'yes_no') {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value).trim().toLowerCase() === 'yes' ? 'Yes' : 'No';
  }
  // A file answer is a storage path `<formId>/<token>-<original name>`. Show the
  // original name: drop the folder, then the dash-delimited token prefix (the
  // token carries no dash, so the first dash is always the name boundary).
  if (block.type === 'file') {
    const base = String(value).split('/').pop() ?? '';
    const dash = base.indexOf('-');
    return dash >= 0 ? base.slice(dash + 1) : base;
  }
  // A ranking reads as the order it was given in.
  if (block.type === 'ranking' && Array.isArray(value)) return value.map((v, i) => `${i + 1}. ${v}`).join(', ');
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

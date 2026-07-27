// The form content model — a PLAIN module (no 'use server', no 'server-only') so
// the builder (client), the renderer (client), the loaders (server) and the
// actions (server) all agree on one shape. Mirrors the block-list idiom of
// lib/blocks.ts: an ordered list of typed blocks, each with a stable id.
//
// A field block's `id` doubles as its key in a response's `answers` jsonb — that
// is why ids are generated once and never rewritten (renaming a label keeps the
// answers attached to it).

export const FIELD_TYPES = [
  'short_text', 'long_text', 'email', 'phone', 'number', 'date',
  'select', 'multi_select', 'dropdown', 'yes_no', 'rating', 'file',
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
  options?: string[];        // select / multi_select / dropdown
  showWhen?: Condition;      // undefined = always shown
};

export type FormContent = { blocks: FormBlock[] };

export type FormMode = 'page' | 'focus';
export type FormSettings = {
  mode?: FormMode;           // F1 renders 'page'; 'focus' lands in F2
  thanks?: string;           // message shown after submit
  collectIdentity?: boolean; // ask name + email before submitting
  limit?: number | null;     // max complete responses
  closeAt?: string | null;   // ISO date after which the form stops accepting
  webhookUrl?: string | null;// F4: POST each complete response here (https only)
  notifyByEmail?: boolean;   // F4: email the owner on each complete response
  turnstile?: boolean;       // F4: require a Cloudflare Turnstile spam check to submit
  paymentUrl?: string | null;// F4: a Stripe Payment Link, shown after they submit
  paymentLabel?: string;     // F4: the pay button's words (defaults to "Pay now")
};

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
// suggests (Contact · Choice · Text · Date & number · Layout). Labels here are
// the ONE name for each field type across the whole product.
export const FIELD_GROUPS = ['Text', 'Contact', 'Choice', 'Date & number', 'Layout'] as const;
export type FieldGroup = (typeof FIELD_GROUPS)[number];

export const BLOCK_META: Record<FormBlockType, { label: string; group: FieldGroup; hint?: string }> = {
  short_text:   { label: 'Short text',    group: 'Text',          hint: 'A single line' },
  long_text:    { label: 'Long text',     group: 'Text',          hint: 'A paragraph' },
  email:        { label: 'Email',         group: 'Contact' },
  phone:        { label: 'Phone',         group: 'Contact',       hint: 'Optional by default' },
  select:       { label: 'Single choice', group: 'Choice' },
  multi_select: { label: 'Multiple choice', group: 'Choice' },
  dropdown:     { label: 'Dropdown',      group: 'Choice' },
  yes_no:       { label: 'Yes / no',      group: 'Choice' },
  number:       { label: 'Number',        group: 'Date & number' },
  date:         { label: 'Date',          group: 'Date & number' },
  rating:       { label: 'Rating',        group: 'Date & number', hint: '1 to 5' },
  file:         { label: 'File upload',   group: 'Text',          hint: 'One attachment' },
  heading:      { label: 'Heading',       group: 'Layout' },
  statement:    { label: 'Text',          group: 'Layout',        hint: 'Explain something' },
  divider:      { label: 'Divider',       group: 'Layout' },
  page_break:   { label: 'Page break',    group: 'Layout' },
};

export function isField(type: FormBlockType): type is FieldType {
  return (FIELD_TYPES as readonly string[]).includes(type);
}
export function hasOptions(type: FormBlockType): boolean {
  return type === 'select' || type === 'multi_select' || type === 'dropdown';
}

export function genBlockId(): string {
  // Stable, collision-safe enough for a single document's block list.
  return `f${Math.random().toString(36).slice(2, 10)}`;
}

const DEFAULT_LABEL: Partial<Record<FormBlockType, string>> = {
  email: 'Email', phone: 'Phone', yes_no: 'Yes or no?', rating: 'How would you rate this?',
  file: 'Upload a file',
  heading: 'Section', statement: '', divider: '', page_break: '',
};

export function emptyBlock(type: FormBlockType): FormBlock {
  const block: FormBlock = { id: genBlockId(), type, label: DEFAULT_LABEL[type] ?? '' };
  if (hasOptions(type)) block.options = ['Option 1', 'Option 2'];
  // Phone stays optional by default — the single biggest field-level abandonment
  // fix in the research (-36.9pp when optional).
  if (isField(type) && type !== 'phone') block.required = false;
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

// Defensive parse — content arrives as unknown jsonb. Anything malformed
// degrades to an empty form rather than throwing in a render.
export function toFormContent(raw: unknown): FormContent {
  if (!raw || typeof raw !== 'object') return { blocks: [] };
  const blocks = (raw as { blocks?: unknown }).blocks;
  if (!Array.isArray(blocks)) return { blocks: [] };
  const clean: FormBlock[] = [];
  for (const b of blocks) {
    if (!b || typeof b !== 'object') continue;
    const { id, type, label, help, placeholder, required, options } = b as Record<string, unknown>;
    if (typeof id !== 'string' || typeof type !== 'string') continue;
    if (!(type in BLOCK_META)) continue;
    clean.push({
      id,
      type: type as FormBlockType,
      label: typeof label === 'string' ? label : '',
      ...(typeof help === 'string' && help ? { help } : {}),
      ...(typeof placeholder === 'string' && placeholder ? { placeholder } : {}),
      ...(required === true ? { required: true } : {}),
      ...(Array.isArray(options) ? { options: options.filter((o): o is string => typeof o === 'string') } : {}),
      ...(toCondition((b as Record<string, unknown>).showWhen) ? { showWhen: toCondition((b as Record<string, unknown>).showWhen)! } : {}),
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
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmpty(value: AnswerValue): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Returns a plain-sentence error, or null when the answer is acceptable. */
export function validateAnswer(block: FormBlock, value: AnswerValue): string | null {
  if (!isField(block.type)) return null;
  if (isEmpty(value)) return block.required ? 'This one is required.' : null;

  switch (block.type) {
    case 'email':
      return typeof value === 'string' && EMAIL_RE.test(value.trim()) ? null : 'That doesn’t look like an email address.';
    case 'phone': {
      const digits = String(value).replace(/\D/g, '');
      return digits.length >= 6 ? null : 'That doesn’t look like a phone number.';
    }
    case 'number':
      return Number.isFinite(Number(value)) ? null : 'Please enter a number.';
    case 'rating': {
      const n = Number(value);
      return Number.isFinite(n) && n >= 1 && n <= 5 ? null : 'Please pick a rating.';
    }
    case 'file':
      // The answer is a storage path the upload action already vetted (size,
      // type, ownership). Presence is all that's left to check, and the empty
      // guard above already did it — a non-empty path is a good answer.
      return null;
    default:
      if (typeof value === 'string' && value.length > 10000) return 'That answer is too long.';
      return null;
  }
}

// ── Visibility ────────────────────────────────────────────────────────────
/**
 * Does this block's condition currently hold? A condition pointing at a field
 * that no longer exists is treated as INERT (block stays visible) rather than
 * silently hiding a question — losing a question is worse than showing one, and
 * the Logic summary flags the broken rule for the author.
 */
export function conditionHolds(cond: Condition, blocks: FormBlock[], answers: Answers): boolean {
  const source = blocks.find((b) => b.id === cond.fieldId);
  if (!source) return true; // inert — the referenced field was deleted
  const raw = answers[cond.fieldId] ?? null;

  if (cond.op === 'answered') return !isEmpty(raw);
  if (cond.op === 'not_answered') return isEmpty(raw);

  const target = (cond.value ?? '').trim().toLowerCase();
  if (cond.op === 'gt' || cond.op === 'lt') {
    const a = Number(raw);
    const b = Number(cond.value);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    return cond.op === 'gt' ? a > b : a < b;
  }

  // Multi-select compares against the set of chosen options.
  const picked = Array.isArray(raw) ? raw.map((v) => String(v).trim().toLowerCase()) : [String(raw ?? '').trim().toLowerCase()];
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
 * A condition as a plain English sentence, for the Logic summary. Returns null
 * when the rule is broken (its source field was deleted) so the UI can say so.
 */
export function conditionSentence(cond: Condition, blocks: FormBlock[]): string | null {
  const source = blocks.find((b) => b.id === cond.fieldId);
  if (!source) return null;
  const name = source.label?.trim() || 'a question';
  if (isUnaryOp(cond.op)) return `“${name}” ${OP_LABEL[cond.op]}`;
  return `“${name}” ${OP_LABEL[cond.op]} “${cond.value ?? ''}”`;
}

/** One-line display of an answer — used by the response drawer and CSV export. */
export function answerToText(block: FormBlock, value: AnswerValue): string {
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
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

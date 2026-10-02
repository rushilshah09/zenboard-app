// ── COMPARING WHAT SOMEONE WROTE WITH WHAT THEY WROTE BEFORE ─────────────────
//
// One tokeniser, shared by everything that has to decide whether two pieces of a person's own
// writing are about the same thing: a quote against a transcript (lib/meeting-suggest.ts), a
// captured thought against the tasks already filed in a project (lib/inbox-file.ts).
//
// It is deliberately NOT the search tokeniser. Search answers "does this record contain the word I
// typed", where a near miss costs a scroll. These answer "did you already say this", where a near
// miss costs trust — so the rules here are about forgiving how a person TYPED something (curly
// apostrophes, a stray dash, ALL CAPS) without ever forgiving a different word.
//
// No stemming, on purpose, WITH ONE EXCEPTION. "invoice"/"invoicing" not matching is a missed
// suggestion, which is quiet; "bill"/"billing"/"billed" collapsing into a stem that also swallows
// "billboard" is a wrong suggestion, which is loud. Silence is the cheaper error everywhere this is
// used. The exception is the plural — "send two alternative palettes" and "palette review" are the
// same subject to any reader, and a filing suggestion that cannot see that is not worth having.

/**
 * Text reduced to letters and digits, for comparing one piece of writing with another. Apostrophes
 * vanish (so I'll, I’ll and Ill agree) and every other run of punctuation or space becomes one
 * space, so a straightened curly quote or a dropped dash is still the same words.
 */
export function flatten(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/['’‘‛`´]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * The words that carry the meaning of a task title, with the ones every task shares removed.
 *
 * THE LIST IS SHORT AND IT IS THE VERBS THAT MATTER. A to-do list is written in a tiny vocabulary —
 * send, email, call, finish, check, follow up — and those words appear in every project, so a
 * thought that says "send the invoice" would otherwise match whichever project happens to hold the
 * most tasks beginning with "send". Inverse document frequency already discounts them; dropping
 * them outright means a one-project match can never rest on one alone.
 *
 * Nothing longer is filtered. Names, deliverables and materials — Meridian, palette, dieline,
 * kraft — are exactly what distinguishes one project from another, and a stopword list that grows
 * past the glue words starts deleting the signal.
 */
const STOP = new Set([
  // glue
  'the', 'a', 'an', 'and', 'or', 'but', 'for', 'to', 'of', 'in', 'on', 'at', 'by', 'with', 'from',
  'about', 'into', 'up', 'out', 'off', 'over', 'then', 'than', 'that', 'this', 'these', 'those',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'it', 'its', 'as', 'if', 'so', 'not', 'no',
  'my', 'me', 'we', 'our', 'you', 'your', 'i', 'he', 'she', 'they', 'them', 'their', 'his', 'her',
  'do', 'does', 'did', 'doing', 'have', 'has', 'had', 'will', 'would', 'can', 'could', 'should',
  'get', 'got', 'need', 'needs', 'want', 'wants', 'make', 'makes', 'let', 'lets', 'via', 're',
  // the to-do verbs every project shares
  'add', 'ask', 'call', 'check', 'confirm', 'draft', 'email', 'finish', 'fix', 'follow', 'go',
  'look', 'prep', 'prepare', 'review', 'send', 'set', 'share', 'sort', 'start', 'update', 'write',
  // the words a to-do wraps its subject in
  'task', 'todo', 'note', 'thing', 'stuff', 'new', 'back', 'again', 'also', 'just', 'now', 'soon',
  'today', 'tomorrow', 'tonight', 'week', 'month', 'day', 'days', 'weeks', 'asap', 'please',
]);

/** A word shorter than this carries no meaning on its own; "ok", "hi", "v2" is the boundary. */
const MIN_TOKEN = 2;

/**
 * A plural, folded to its singular — the one piece of stemming here, kept as narrow as it can be.
 *
 * Only a trailing "s", only on a word of four letters or more, and never after another "s". That
 * last rule is what keeps "press", "address" and "business" whole. Words that merely END in s
 * ("status", "analysis") are folded too, but they are folded the SAME WAY on both sides of every
 * comparison, so they still match themselves — the only thing a fold can break is telling two
 * different words apart, and "cost"/"costs" collapsing is the outcome we want.
 */
function singular(t: string): string {
  return t.length >= 4 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t;
}

/**
 * The distinguishing words of one piece of writing, in order, with duplicates kept. Callers that
 * want a set make one — a title that says "palette" twice IS about palettes more than one that
 * says it once, and throwing that away here would take the choice from them.
 */
export function contentTokens(s: string): string[] {
  return flatten(s)
    .split(' ')
    .filter((t) => t.length >= MIN_TOKEN && !STOP.has(t) && !/^\d+$/.test(t))
    .map(singular);
}

/** Is `word` one of the words of `text`, whole? Used for names, where a substring is a false match. */
export function saysWord(text: string, word: string): boolean {
  const w = flatten(word);
  if (!w) return false;
  return ` ${flatten(text)} `.includes(` ${w} `);
}

/**
 * Does `text` contain `phrase` as a whole run of words? A project called "Meridian Coffee" is named
 * by "the Meridian Coffee cups" but not by "coffee with Dev", which `saysWord` alone would allow
 * for a one-word name and get wrong in both directions for a two-word one.
 */
export function saysPhrase(text: string, phrase: string): boolean {
  const p = flatten(phrase);
  if (!p) return false;
  return ` ${flatten(text)} `.includes(` ${p} `);
}

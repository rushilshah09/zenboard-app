// Acceptance — the block that turns a Doc into a signed proposal (§7M).
//
// THE DECISION THIS FILE EXISTS TO ENFORCE: an acceptance is a FACT ABOUT A
// MOMENT, not a state on the document.
//
// The obvious build is to put `{ accepted: true, by: 'Sam', at: … }` in the
// block's payload, next to the statement. That is wrong in a way that only
// shows up when it matters. `pages.content` is written by the OWNER's autosave —
// so the "signature" would live in a field the person who benefits from it can
// edit, and an autosave race could erase it. A signature has to be produced by
// the counterparty and stored where the beneficiary cannot rewrite it.
//
// So the split is:
//   · the BLOCK holds the terms — what is being asked, and in what words;
//   · the RECORD (table `acceptances`, migration 0034) holds the fact — who
//     typed what, when by the server's clock, from which address, and what the
//     document said at that instant.
//
// This file is pure and client-safe: no crypto, no database. The sha256 of
// `canonicalizeForSignature` is taken server-side in lib/actions/acceptance.ts.
import type { Block } from '@/lib/blocks';

// ── The terms (block payload) ────────────────────────────────────────────────

export type AcceptTerms = {
  /** The exact words the signer agrees to. Shown directly above the name field. */
  statement?: string;
  /** The button. "Accept" for a proposal, "Sign" for a contract. */
  label?: string;
  /** Ask for an email too. Off by default — one field is a better signature rate. */
  requireEmail?: boolean;
};

// Click-wrap wording: names the artifact, says what typing does, and stays one
// sentence. Deliberately not legal boilerplate — Zenboard is not a law firm and
// says so in the UI rather than pretending in the copy.
export const DEFAULT_STATEMENT =
  'By typing my name below, I agree to the scope and prices set out in this document.';
export const DEFAULT_LABEL = 'Accept';

export const acceptStatement = (t?: AcceptTerms | null): string =>
  t?.statement?.trim() || DEFAULT_STATEMENT;
export const acceptLabel = (t?: AcceptTerms | null): string =>
  t?.label?.trim() || DEFAULT_LABEL;

export const STATEMENT_MAX = 600;
export const NAME_MAX = 120;

// ── Validating a signature ───────────────────────────────────────────────────

/**
 * Is this typed name a signature?
 *
 * The bar is low on purpose — people sign as "sam", "Dr. A. Roy-Smith", "王伟" —
 * but it is not zero: a field holding "." or "1234" is someone clicking through,
 * and accepting that as a signature is worse than asking again. So: at least two
 * characters, and at least one of them a letter in any script.
 */
export function validateSignerName(raw: string): { name: string } | { error: string } {
  const name = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < 2) return { error: 'Please type your full name.' };
  if (name.length > NAME_MAX) return { error: 'That name is too long.' };
  if (!/\p{L}/u.test(name)) return { error: 'Please type your name as you write it.' };
  return { name };
}

/** Optional, so an empty value is valid — but a typo'd address is not. */
export function validateSignerEmail(raw: string | null | undefined): { email: string | null } | { error: string } {
  const email = (raw ?? '').trim();
  if (email === '') return { email: null };
  if (email.length > 200 || !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) {
    return { error: 'That email doesn’t look right.' };
  }
  return { email: email.toLowerCase() };
}

// ── What was signed ──────────────────────────────────────────────────────────

/**
 * A stable string standing for "the terms in this document".
 *
 * Hashed server-side and stored with the acceptance, so "has this changed since
 * it was signed?" is one string comparison instead of a deep diff of two
 * documents on every render.
 *
 * Two deliberate exclusions:
 *
 *   · BLOCK IDS. They are storage keys, not content. A doc that survives a
 *     round-trip through the editor can come back with re-minted ids and
 *     identical words; flagging that as tampering would be a lie.
 *
 *   · INLINE FORMATTING (`spans`). Bolding a word does not change a term — the
 *     text is the term, and it is captured. A warning that fires when someone
 *     italicises a heading is a warning people learn to ignore, which costs more
 *     than the case it catches. The full snapshot is stored alongside the hash,
 *     so a genuine dispute can always be answered exactly.
 */
export function canonicalizeForSignature(blocks: Block[], { uploads = true }: { uploads?: boolean } = {}): string {
  return blocks.map((b) => canonBlock(b, uploads)).join('\n');
}

function canonBlock(b: Block, uploads: boolean): string {
  const head = `${b.type}:${b.text ?? ''}`;
  switch (b.type) {
    case 'todo':
      return `${head}|${b.checked ? 'x' : ' '}`;
    case 'table':
      return `${head}|${(b.rows ?? []).map((r) => r.join('')).join('')}`;
    // The prices are the part of a proposal a signature is actually about.
    case 'lineitems':
      return `${head}|${(b.items ?? []).map((i) => `${i.description}${i.quantity}${i.unitAmount}`).join('')}`;
    case 'accept':
      return `${head}|${acceptStatement(b.accept)}`;
    // `uploads: false` is the form a signature taken before 2026-09-21 was fingerprinted in: the document was read
    // through a normalize() that dropped every upload's `fileId`, so an uploaded image read as an empty src.
    case 'image': case 'bookmark': case 'embed':
    case 'video': case 'audio': case 'pdf': case 'file':
      return `${head}|${b.src ?? (uploads ? b.fileId : undefined) ?? ''}`;
    case 'code':
      return `${head}|${b.lang ?? ''}`;
    default:
      return head;
  }
}

// ── The record, and what the document shows about it ─────────────────────────

/** One row of `acceptances`, as the app reads it. */
export type Acceptance = {
  id: string;
  blockId: string;
  signerName: string;
  signerEmail: string | null;
  acceptedAt: string;
  statement: string;
  contentHash: string;
  amount: number | null;
  /**
   * The invoice the accept crossing drafted (§7M, 0035), if any. Null before
   * 0035 is applied, when the document quoted no prices, or when the draft was
   * withdrawn — all three mean "not invoiced", which is re-runnable.
   */
  invoiceId: string | null;
};

/**
 * `edited` is not an error state. The document legitimately gets typo fixes and
 * new sections after a client signs; what matters is that the owner can SEE that
 * what is on screen is no longer what was agreed, and can still produce what was.
 */
export type AcceptanceStatus = 'awaiting' | 'accepted' | 'edited';

/**
 * `current` is every fingerprint the document as it stands may have been signed under — its own, and the one a
 * signature taken before uploads survived a reload saw (`canonicalizeForSignature(…, { uploads: false })`). A
 * signature matching either has not been edited: an old one never recorded which image was agreed, so it cannot
 * say the image changed. Empty or absent means "not known", which never reads as edited.
 */
export function acceptanceStatus(record: Acceptance | null | undefined, current?: readonly string[] | null): AcceptanceStatus {
  if (!record) return 'awaiting';
  if (current?.length && record.contentHash && !current.includes(record.contentHash)) return 'edited';
  return 'accepted';
}

/** Find the acceptance belonging to a given block. */
export const acceptanceFor = (records: Acceptance[] | null | undefined, blockId: string): Acceptance | null =>
  (records ?? []).find((r) => r.blockId === blockId) ?? null;

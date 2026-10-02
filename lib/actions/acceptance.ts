'use server';
// The accept path (§7M). Owner reads through RLS; the client signs through a
// token-scoped service-role write, exactly like `submitApprovalDecision`.
//
// THE RULE THIS FILE KEEPS: the browser supplies the NAME and nothing else that
// matters. The statement, the document snapshot, the fingerprint, the amount and
// the timestamp are all read or produced HERE, from the row the token proves
// access to. A signature assembled out of fields the signer posted would prove
// only that someone could post fields.
import { notReady } from '@/lib/not-ready';
import { createHash } from 'crypto';
import { headers } from 'next/headers';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { toBlocks, type Block } from '@/lib/blocks';
import {
  canonicalizeForSignature, validateSignerName, validateSignerEmail,
  acceptStatement, type Acceptance,
} from '@/lib/acceptance';
import { itemsTotal, meaningfulItems } from '@/lib/line-items';
import { nextInvoiceNumber } from '@/lib/invoice-number';
import { notifyOwner } from '@/lib/notify';

type DB = Awaited<ReturnType<typeof createClient>>;
// The numbering helper is written against the plain client type, and both the
// authenticated and the service-role client satisfy it.
type AnyDB = Parameters<typeof nextInvoiceNumber>[0];

const BASE_COLS = 'id, block_id, signer_name, signer_email, accepted_at, statement, content_hash, amount';
type Row = {
  id: string; block_id: string; signer_name: string; signer_email: string | null;
  accepted_at: string; statement: string; content_hash: string; amount: number | null;
  invoice_id?: string | null;
};

const toAcceptance = (r: Row): Acceptance => ({
  id: r.id, blockId: r.block_id, signerName: r.signer_name, signerEmail: r.signer_email,
  acceptedAt: r.accepted_at, statement: r.statement, contentHash: r.content_hash,
  // numeric(12,2) comes back as a string from PostgREST on some drivers.
  amount: r.amount === null ? null : Number(r.amount),
  invoiceId: r.invoice_id ?? null,
});

/** Is 0034 applied? A new table, so its absence is unambiguous. */
export async function acceptancesSupported(db?: DB): Promise<boolean> {
  try {
    const supabase = db ?? await createClient();
    const { error } = await supabase.from('acceptances').select('id').limit(0);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Is 0035 applied? Probes the COLUMN, not the table — by the time this matters
 * `acceptances` already exists, so a table probe would answer the wrong
 * question and answer it yes.
 */
async function crossingSupported(db: DB): Promise<boolean> {
  try {
    const { error } = await db.from('acceptances').select('invoice_id').limit(0);
    return !error;
  } catch {
    return false;
  }
}

/** The columns to ask for, given what the database currently has. */
const cols = (crossing: boolean) => (crossing ? `${BASE_COLS}, invoice_id` : BASE_COLS);

// ── What is being signed ─────────────────────────────────────────────────────

/** sha256 of the canonical form. The comparator behind "edited since signing". */
export async function fingerprint(blocks: Block[]): Promise<string> {
  return sha256(canonicalizeForSignature(blocks));
}

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

/**
 * Every fingerprint this document may have been signed under. Until 2026-09-21 a document was read through a
 * normalize() that dropped every upload's reference, so a signature taken then hashed an uploaded image as nothing;
 * the fix made those references survive, which would have turned every such signature "edited" overnight. Not
 * exported: in a 'use server' file an exported async function is a server action.
 */
function fingerprintsOf(blocks: Block[]): string[] {
  const now = sha256(canonicalizeForSignature(blocks));
  const blind = sha256(canonicalizeForSignature(blocks, { uploads: false }));
  return blind === now ? [now] : [now, blind];
}

/**
 * The money on the page. Summed across every line-items block, because a
 * proposal may price phases separately and the figure someone agreed to is the
 * one at the bottom of the document, not the bottom of the first table.
 */
function docAmount(blocks: Block[]): number | null {
  const tables = blocks.filter((b) => b.type === 'lineitems' && (b.items?.length ?? 0) > 0);
  if (!tables.length) return null;
  return Math.round(tables.reduce((sum, b) => sum + itemsTotal(b.items ?? []), 0) * 100) / 100;
}

// ── Owner side ───────────────────────────────────────────────────────────────

export type AcceptanceState = {
  acceptances: Acceptance[];
  /** The fingerprints of the page AS SAVED (`fingerprintsOf`). Empty when unknown. */
  hashes: string[];
  /** Invoices the crossing produced, by id — so the block can name and link one. */
  invoices: Record<string, { number: string; status: string }>;
  /** False until 0035 is applied: the block hides the invoice line entirely. */
  crossing: boolean;
};

/**
 * Everything a document needs to render its accept blocks: the signatures, and
 * the fingerprint of the page AS SAVED.
 *
 * One round trip rather than two, and the hash is taken from the server's own
 * copy — which is the right definition anyway. "Edited since accepted" is a fact
 * about what is stored, not about the keystroke the owner is in the middle of;
 * computing it live would flash the warning while someone fixes a typo and
 * un-flash it when they undo. It refreshes on reload, like the document itself.
 *
 * Empty and null (never throwing) before 0034 is applied.
 */
const NOTHING: AcceptanceState = { acceptances: [], hashes: [], invoices: {}, crossing: false };

export async function loadAcceptanceState(pageId: string): Promise<AcceptanceState> {
  try {
    const supabase = await createClient();
    const crossing = await crossingSupported(supabase);
    const [rows, page] = await Promise.all([
      supabase.from('acceptances').select(cols(crossing)).eq('page_id', pageId),
      supabase.from('pages').select('content').eq('id', pageId).maybeSingle(),
    ]);
    if (rows.error) return NOTHING;

    const acceptances = ((rows.data as unknown as Row[]) ?? []).map(toAcceptance);
    const invoiceIds = acceptances.map((a) => a.invoiceId).filter((x): x is string => !!x);
    const invoices: AcceptanceState['invoices'] = {};
    if (invoiceIds.length) {
      const { data } = await supabase.from('invoices').select('id, number, status').in('id', invoiceIds);
      for (const inv of data ?? []) invoices[inv.id] = { number: inv.number, status: inv.status };
    }

    return {
      acceptances,
      hashes: page.data ? fingerprintsOf(toBlocks(page.data.content)) : [],
      invoices,
      crossing,
    };
  } catch {
    return NOTHING;
  }
}

/**
 * Withdraw a signature. Deliberately a DELETE and not a status flag: an
 * acceptance is evidence, and evidence that can be marked "void" while staying
 * on screen invites arguments about which state is authoritative. Either the
 * document was accepted or the record is gone.
 */
export async function withdrawAcceptance(id: string): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };
  const { error } = await supabase.from('acceptances').delete().eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

// ── The crossing: accept → invoice draft (§7M) ───────────────────────────────

type Crossing = { acceptanceId: string; userId: string; projectId: string | null; pageTitle: string; blocks: Block[]; signerName: string };

/**
 * Turn the accepted line items into a DRAFT invoice.
 *
 * §7M's pain is "retyping scope into the PM tool after acceptance", and the
 * fields already line up — `lib/line-items.ts` was named for `invoice_items` in
 * sprint 1 precisely so this could be a copy rather than a translation.
 *
 * A DRAFT and not a sent invoice, deliberately. Zero retyping is the win; the
 * decisions that remain — dates, deposit split, whether to bill at all yet — are
 * the owner's, and a draft is a filled-in form nobody has seen but them. Nothing
 * leaves the building because a client typed their name.
 *
 * Best-effort by design: a failure here must never cost the signature, which is
 * the part that cannot be recreated. It returns null and the owner is one click
 * from retrying (`invoiceForAcceptance`), which the recorded link makes safe.
 */
async function crossToInvoice(db: DB, c: Crossing): Promise<{ id: string; number: string } | null> {
  const items = c.blocks.filter((b) => b.type === 'lineitems').flatMap((b) => b.items ?? []);
  const billable = meaningfulItems(items);
  if (!billable.length) return null;   // a proposal with no prices is not an invoice

  try {
    const [{ data: project }, number] = await Promise.all([
      c.projectId
        ? db.from('projects').select('client_id').eq('id', c.projectId).maybeSingle()
        : Promise.resolve({ data: null }),
      nextInvoiceNumber(db as unknown as AnyDB, c.userId),
    ]);

    const { data: inv, error } = await db.from('invoices').insert({
      user_id: c.userId,
      number,
      client_id: project?.client_id ?? null,
      project_id: c.projectId,
      status: 'draft',
      // Provenance ON the artifact, not only in a log — this is a note the owner
      // would have written anyway, and it answers "where did this come from?"
      // when the invoice is opened months later on its own.
      notes: `From ${c.pageTitle}, accepted by ${c.signerName}.`,
    }).select('id, number').single();
    if (error || !inv) return null;

    const { error: ie } = await db.from('invoice_items').insert(
      billable.map((i, idx) => ({
        invoice_id: inv.id,
        description: i.description.trim() || 'Item',
        quantity: i.quantity,
        unit_amount: i.unitAmount,
        sort_order: idx,
      })),
    );
    if (ie) return null;

    await db.from('acceptances').update({ invoice_id: inv.id }).eq('id', c.acceptanceId);
    if (c.projectId) {
      await db.from('project_activity').insert({
        project_id: c.projectId, user_id: c.userId, type: 'invoiced',
        body: `${inv.number} drafted from ${c.pageTitle} (${billable.length} line${billable.length === 1 ? '' : 's'})`,
      });
    }
    return { id: inv.id, number: inv.number };
  } catch {
    return null;
  }
}

/**
 * Owner-side re-run, for when the crossing did not fire — 0035 was not applied
 * at signing time, the document had no prices when it was signed, or the insert
 * failed. Refuses if this acceptance already has an invoice, which is what the
 * recorded link is for.
 */
export async function invoiceForAcceptance(acceptanceId: string): Promise<{ error: string } | { id: string; number: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };
  if (!await crossingSupported(supabase)) return notReady('Invoicing from a proposal isn’t available yet.', '0035');

  const { data: acc } = await supabase.from('acceptances')
    .select('id, page_id, project_id, signer_name, invoice_id').eq('id', acceptanceId).maybeSingle();
  if (!acc) return { error: 'Not found.' };
  if (acc.invoice_id) return { error: 'This proposal already has an invoice.' };

  const { data: page } = await supabase.from('pages').select('title, content').eq('id', acc.page_id).maybeSingle();
  if (!page) return { error: 'The document is gone.' };

  const made = await crossToInvoice(supabase, {
    acceptanceId: acc.id, userId: user.id, projectId: acc.project_id,
    pageTitle: page.title?.trim() || 'Proposal', blocks: toBlocks(page.content), signerName: acc.signer_name,
  });
  return made ?? { error: 'That document has no prices to invoice.' };
}

// ── Client side (public) ─────────────────────────────────────────────────────

/**
 * Best-effort address of whoever is signing.
 *
 * `cf-connecting-ip` first because this deploys to Cloudflare Workers, where it
 * is the only header the edge sets itself; `x-forwarded-for` is a client-settable
 * list that a proxy appends to, so the FIRST entry is the claim and everything
 * after it is hearsay. Recorded as click-wrap evidence, never as identity —
 * which is why a null here is not an error.
 */
async function requestOrigin(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const ip = h.get('cf-connecting-ip')
      ?? h.get('x-real-ip')
      ?? h.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? null;
    return { ip: ip || null, userAgent: h.get('user-agent')?.slice(0, 400) || null };
  } catch {
    return { ip: null, userAgent: null };
  }
}

export type AcceptResult = { error: string } | { ok: true; acceptance: Acceptance };

/**
 * PUBLIC: the client accepts. Token-scoped; the page must belong to the token's
 * project AND be shared with the client — holding a portal link is permission to
 * sign what that portal shows, not any page id that can be guessed.
 */
export async function submitAcceptance(
  token: string,
  pageId: string,
  blockId: string,
  signerName: string,
  signerEmail?: string,
): Promise<AcceptResult> {
  if (!token || token.length < 8) return { error: 'Invalid link.' };
  if (!pageId || !blockId) return { error: 'Nothing to accept.' };

  const name = validateSignerName(signerName);
  if ('error' in name) return name;
  const email = validateSignerEmail(signerEmail);
  if ('error' in email) return email;

  const svc = createServiceClient();
  const { data: project } = await svc.from('projects')
    .select('id, user_id, name, portal_enabled, share_files').eq('portal_token', token).maybeSingle();
  if (!project || !project.portal_enabled) return { error: 'This portal isn’t available.' };

  // The page must be one the portal actually shows. `share_files` is the flag
  // that projects documents into the portal at all (lib/portal.ts).
  const { data: page } = await svc.from('pages')
    .select('id, title, content, project_id, client_visible').eq('id', pageId).maybeSingle();
  if (!page || page.project_id !== project.id || !page.client_visible || !project.share_files) {
    return { error: 'This document isn’t available to sign.' };
  }

  // The terms come from the SERVER's copy of the document. Everything below is
  // derived from `blocks`; nothing but the name came from the browser.
  const blocks = toBlocks(page.content);
  const block = blocks.find((b) => b.id === blockId && b.type === 'accept');
  if (!block) return { error: 'This document isn’t available to sign.' };

  const supported = await acceptancesSupported(svc as unknown as DB);
  if (!supported) return { error: 'This document can’t take signatures yet. Please contact your studio.' };

  const crossing = await crossingSupported(svc as unknown as DB);

  // Already signed? Then this is a refresh or a second tab, not a second
  // signature — hand back the one that exists. This is also what keeps the
  // crossing below from firing twice: only the branch that actually inserted
  // reaches it.
  const { data: prior } = await svc.from('acceptances')
    .select(cols(crossing)).eq('page_id', pageId).eq('block_id', blockId).maybeSingle();
  if (prior) return { ok: true, acceptance: toAcceptance(prior as unknown as Row) };

  const { ip, userAgent } = await requestOrigin();
  const { data: row, error } = await svc.from('acceptances').insert({
    user_id: project.user_id,
    page_id: pageId,
    project_id: project.id,
    block_id: blockId,
    signer_name: name.name,
    signer_email: email.email,
    ip,
    user_agent: userAgent,
    statement: acceptStatement(block.accept),
    content: { blocks },
    content_hash: await fingerprint(blocks),
    amount: docAmount(blocks),
  }).select(cols(crossing)).single();

  if (error) {
    // 23505 = the unique index caught the race the read above could not: two
    // tabs, one document. Both callers should see the same signature.
    if (error.code === '23505') {
      const { data: won } = await svc.from('acceptances')
        .select(cols(crossing)).eq('page_id', pageId).eq('block_id', blockId).maybeSingle();
      if (won) return { ok: true, acceptance: toAcceptance(won as unknown as Row) };
    }
    return { error: 'Could not record that. Please try again.' };
  }

  const signed = toAcceptance(row as unknown as Row);
  const what = page.title?.trim() || 'Document';

  // ── The crossing (§7M) ────────────────────────────────────────────────────
  // Everything below is best-effort: the signature is recorded and returned
  // whatever happens next. An invoice can be re-created with one click; a
  // signature cannot be re-obtained, so nothing here is allowed to fail it.
  const invoice = crossing
    ? await crossToInvoice(svc as unknown as DB, {
        acceptanceId: signed.id, userId: project.user_id, projectId: project.id,
        pageTitle: what, blocks, signerName: name.name,
      })
    : null;
  if (invoice) signed.invoiceId = invoice.id;

  await svc.from('project_activity').insert({
    project_id: project.id, user_id: project.user_id, type: 'accepted',
    body: `${name.name} accepted ${what}`,
  });

  await notifyOwner(svc, {
    userId: project.user_id,
    kind: 'portal.accept',
    title: `${name.name} accepted ${what}`,
    // The money is the thing the owner wants to know, so it goes in the
    // notification rather than one screen further in.
    body: invoice ? `${project.name} · ${invoice.number} drafted` : project.name,
    link: { href: `/documents/${pageId}` },
  });

  return { ok: true, acceptance: signed };
}

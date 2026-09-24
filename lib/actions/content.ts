'use server';
// Content mutations that must not go through the page editor.
//
// THE REASON THIS FILE EXISTS: a piece's stage lives inside the page's content
// JSON, next to its script. Saving it from the board would mean sending a
// `content` object the board does not have the blocks for — and `updatePage`
// replaces the column, so the first stage change from a card would have deleted
// the script. The merge has to happen where the current value is known, which is
// the server.
import { requireSession } from '@/lib/auth';
import { readContent, writeContent, inboxCapture, contentFromProject, repurpose, ideaFromReference, isReference, isAutoTitle, readPreview, STAGES, BUCKETS, type Stage, type Bucket } from '@/lib/content';
import { activeSpaceId } from '@/lib/active-space';
import { attachmentCover } from '@/lib/covers';
import { genId } from '@/lib/blocks';

export async function setContentStage(
  pageId: string,
  stage: Stage,
): Promise<{ error: string } | { ok: true }> {
  if (!STAGES.includes(stage)) return { error: 'Unknown stage.' };
  const { supabase } = await requireSession();

  const { data, error: readErr } = await supabase
    .from('pages').select('content').eq('id', pageId).maybeSingle();
  if (readErr || !data) return { error: readErr?.message ?? 'Not found.' };

  // Read-modify-write on the whole object: every other key in there — blocks,
  // cover, props, comments, the full-width flag — belongs to someone else and
  // has to survive a stage change untouched.
  const content = (data.content as Record<string, unknown>) ?? {};
  const next = { ...content, ...writeContent({ ...readContent(content), stage }) };

  const { error } = await supabase.from('pages').update({ content: next }).eq('id', pageId);
  return error ? { error: error.message } : { ok: true };
}

/**
 * Capture anything into the inbox.
 *
 * The whole point is that this asks for ONE field. A creator dumping "make a
 * post about AI agents" between meetings will not fill in a format, a channel
 * and a publish date, and a capture box that demands them is a capture box that
 * gets used twice. Everything else is decided later, at triage.
 *
 * `sourceUrl` is stored RAW and sanitised at the render site (`safeHref`), so a
 * later tightening of the URL rules applies to everything already saved rather
 * than only to what is captured after it.
 */
export async function captureToInbox(
  input: { title: string; sourceUrl?: string; note?: string },
): Promise<{ error: string } | { ok: true; id: string }> {
  const title = input.title.trim();
  if (!title) return { error: 'Give it a line of text first.' };
  const { supabase, user } = await requireSession();
  const spaceId = await activeSpaceId(supabase, user.id);

  // `inboxCapture` is the rule: no stage claim, `bucket: 'inbox'`. The MCP
  // tool writes through the same function, so both doors make the same thing.
  const { data, error } = await supabase
    .from('pages')
    .insert(inboxCapture({ userId: user.id, spaceId, title, sourceUrl: input.sourceUrl, note: input.note }))
    .select('id')
    .single();
  if (error || !data) return { error: error?.message ?? 'Could not save that.' };
  return { ok: true, id: (data as { id: string }).id };
}

/**
 * Make an uploaded picture the capture's image.
 *
 * Called once the bytes have landed and the attachment row exists (the upload
 * spine in lib/use-attachment.ts). The attachment must belong to THIS page — the
 * `page_id` check — and RLS already limits it to the caller's own files, so a
 * page cannot be pointed at somebody else's picture. Read-modify-write, like
 * every other write into the content JSON, so nothing else in it is lost.
 */
export async function setContentImage(
  pageId: string,
  attachmentId: string,
): Promise<{ error: string } | { ok: true }> {
  const { supabase } = await requireSession();
  const { data: file } = await supabase
    .from('attachments').select('id').eq('id', attachmentId).eq('page_id', pageId).maybeSingle();
  if (!file) return { error: 'Not found.' };

  const { data, error: readErr } = await supabase
    .from('pages').select('content').eq('id', pageId).maybeSingle();
  if (readErr || !data) return { error: readErr?.message ?? 'Not found.' };

  const content = (data.content as Record<string, unknown>) ?? {};
  const next = { ...content, ...writeContent({ ...readContent(content), image: attachmentCover(attachmentId) }) };
  const { error } = await supabase.from('pages').update({ content: next }).eq('id', pageId);
  return error ? { error: error.message } : { ok: true };
}

/**
 * Remember what a linked page said about itself, on the row.
 *
 * A CACHE WRITE, and treated as one: the browser sends what `/api/unfurl` told
 * it, and this re-reads it through `readPreview` (capped, https images only,
 * dated) rather than trusting the shape, then stores it ONLY if it describes a
 * link the row actually has — its source or its live link. Read-modify-write,
 * like every write into the content JSON.
 */
export async function rememberLinkPreview(pageId: string, raw: unknown): Promise<{ error: string } | { ok: true }> {
  const preview = readPreview(raw);
  if (!preview) return { error: 'Nothing to remember.' };
  const { supabase } = await requireSession();

  const { data, error: readErr } = await supabase
    .from('pages').select('content').eq('id', pageId).maybeSingle();
  if (readErr || !data) return { error: readErr?.message ?? 'Not found.' };

  const content = (data.content as Record<string, unknown>) ?? {};
  const current = readContent(content);
  if (preview.url !== current.sourceUrl && preview.url !== current.liveUrl) return { error: 'Not this link.' };

  const next = { ...content, ...writeContent({ ...current, preview }) };
  const { error } = await supabase.from('pages').update({ content: next }).eq('id', pageId);
  return error ? { error: error.message } : { ok: true };
}

/**
 * Triage: move a capture onto a shelf.
 *
 * Read-modify-write for the same reason `setContentStage` is — the bucket lives
 * in the page's content JSON beside whatever the capture has grown since (notes,
 * a pasted screenshot, a first draft), and `updatePage` REPLACES that column.
 *
 * Sorting a capture into the pipeline sets `idea` explicitly rather than
 * relying on the stored value: the stage a capture carried was never a decision
 * anyone made, and the moment it becomes a piece it needs to be one.
 */
export async function sortInboxItem(
  pageId: string,
  bucket: Bucket,
  /**
   * The link's own title, as the person saw it on the row they sorted. Adopted
   * ONLY while the stored title is still the placeholder the capture box derived
   * from the link — re-checked here, against the stored row — so a piece lands on
   * the board named what the inbox showed ("How I got my attention span back",
   * not "youtube.com/watch"), and a name someone typed is never replaced.
   */
  linkTitle?: string,
): Promise<{ error: string } | { ok: true }> {
  if (!BUCKETS.includes(bucket)) return { error: 'Unknown destination.' };
  const { supabase } = await requireSession();

  const { data, error: readErr } = await supabase
    .from('pages').select('title, content').eq('id', pageId).maybeSingle();
  if (readErr || !data) return { error: readErr?.message ?? 'Not found.' };

  const content = (data.content as Record<string, unknown>) ?? {};
  const current = readContent(content);
  const next = {
    ...content,
    ...writeContent({ ...current, bucket, stage: bucket === 'piece' ? 'idea' : current.stage }),
  };

  const adopt = linkTitle?.trim().slice(0, 300);
  const patch: { content: Record<string, unknown>; title?: string } = { content: next };
  if (adopt && isAutoTitle(data.title as string | null, current.sourceUrl)) patch.title = adopt;

  const { error } = await supabase.from('pages').update(patch).eq('id', pageId);
  return error ? { error: error.message } : { ok: true };
}

/**
 * Turn a finished project into content — PRODUCT_CONTEXT §15, Scenario D.
 *
 * Every piece is created carrying its PROJECT and its CLIENT, which is the whole
 * value: the alternative is opening Content, typing the project's name from
 * memory, and picking a client that the system already knew. That re-entry is
 * what §25 calls a UX leak.
 *
 * The client comes from the project rather than from the caller — one object,
 * referenced, never copied (§24).
 */
export async function createContentFromProject(
  projectId: string,
  presetIds: string[],
): Promise<{ error: string } | { ok: true; ids: string[] }> {
  if (!presetIds.length) return { ok: true, ids: [] };
  const { supabase, user } = await requireSession();

  const { data: proj } = await supabase
    .from('projects').select('id, name, client_id, space_id').eq('id', projectId).maybeSingle();
  if (!proj) return { error: 'Project not found.' };

  const spaceId = proj.space_id ?? await activeSpaceId(supabase, user.id);
  const pieces = contentFromProject(proj.name, presetIds);

  const rows = pieces.map((p) => ({
    user_id: user.id,
    space_id: spaceId,
    type: 'content',
    title: p.title,
    project_id: proj.id,
    // The client is the project's, read here rather than passed in: a caller
    // that supplies it can supply the wrong one.
    client_id: proj.client_id,
    content: {
      blocks: p.sections.map((text) => ({ id: genId(), type: 'h2', text })),
      ...writeContent(p.meta),
    },
  }));

  const { data, error } = await supabase.from('pages').insert(rows).select('id');
  if (error || !data) return { error: error?.message ?? 'Could not create the content.' };
  return { ok: true, ids: (data as { id: string }[]).map((r) => r.id) };
}

/**
 * Cut a finished piece into shorter ones.
 *
 * ── WHY THE SOURCE IS RE-READ HERE ──────────────────────────────────────────
 * The caller sends an id and a list of preset ids, and nothing else is trusted.
 * `repurpose()` refuses a cut that was never on offer — you cannot write up an
 * article, and an atom offers nothing — but it can only refuse if it is given
 * the source's REAL format, which is in the row, not in the request. A caller
 * that supplies the format can supply the wrong one, exactly as the project
 * close-out found with `client_id`.
 *
 * Project and client are the SOURCE's, for the same reason: a cut belongs to
 * the same job as the thing it came from, and re-deriving that here means a
 * piece can never end up filed under a client it was not made for.
 */
export async function repurposePiece(
  sourceId: string,
  presetIds: string[],
): Promise<{ error: string } | { ok: true; ids: string[] }> {
  if (!presetIds.length) return { ok: true, ids: [] };
  const { supabase, user } = await requireSession();

  const { data: src } = await supabase
    .from('pages')
    .select('id, title, content, project_id, client_id, space_id, type')
    .eq('id', sourceId)
    .maybeSingle();
  if (!src || src.type !== 'content') return { error: 'Piece not found.' };

  const meta = readContent(src.content);
  const pieces = repurpose({ id: src.id, title: src.title ?? '', meta }, presetIds);
  // Empty means every requested cut was refused — a stale menu, or a format
  // changed since the panel opened. Saying so beats silently doing nothing.
  if (!pieces.length) return { error: 'That piece cannot be cut into those.' };

  const spaceId = src.space_id ?? await activeSpaceId(supabase, user.id);
  const rows = pieces.map((p) => ({
    user_id: user.id,
    space_id: spaceId,
    type: 'content',
    title: p.title,
    project_id: src.project_id,
    client_id: src.client_id,
    content: {
      blocks: p.sections.map((text) => ({ id: genId(), type: 'h2', text })),
      ...writeContent(p.meta),
    },
  }));

  const { data, error } = await supabase.from('pages').insert(rows).select('id');
  if (error || !data) return { error: error?.message ?? 'Could not create the cuts.' };
  return { ok: true, ids: (data as { id: string }[]).map((r) => r.id) };
}

/**
 * Start a piece from something you saved.
 *
 * The reference is READ, never written: it stays on the shelf, because one reel
 * can spark three ideas over a year and consuming it would delete the thing
 * that makes the shelf worth keeping.
 *
 * Re-reading it here also enforces the one rule this action has — you can only
 * spark from something that is actually a reference. A caller passing a piece
 * id would otherwise quietly create a second copy of work already in flight.
 */
export async function makeIdeaFromReference(
  referenceId: string,
  title = '',
): Promise<{ error: string } | { ok: true; id: string }> {
  const { supabase, user } = await requireSession();

  const { data: ref } = await supabase
    .from('pages')
    .select('id, title, content, space_id, type')
    .eq('id', referenceId)
    .maybeSingle();
  if (!ref || ref.type !== 'content') return { error: 'Not found.' };

  const meta = readContent(ref.content);
  if (!isReference({ meta })) return { error: 'That is already a piece of your own.' };

  const idea = ideaFromReference({ id: ref.id }, title);
  const spaceId = ref.space_id ?? await activeSpaceId(supabase, user.id);
  const { data, error } = await supabase
    .from('pages')
    .insert({
      user_id: user.id,
      space_id: spaceId,
      type: 'content',
      // Untitled is honest here — see `ideaFromReference` for why inheriting the
      // reference's title is worse than an empty one.
      title: idea.title,
      content: { blocks: [], ...writeContent(idea.meta) },
    })
    .select('id')
    .single();
  if (error || !data) return { error: error?.message ?? 'Could not start that.' };
  return { ok: true, id: (data as { id: string }).id };
}

'use server';
// Document version history. `page_versions` has existed since 0001 with correct
// RLS (ownership resolved through `pages`) and had NO code referencing it — this
// is the file that finally uses it. No migration required.
//
// The snapshot RULE lives in lib/version-policy.ts (pure, tested); this file is
// only the database half.
import { decideSnapshot, versionsToPrune, MAX_VERSIONS } from '@/lib/version-policy';
import { requireSession } from '@/lib/auth';

export type PageVersion = { id: string; created_at: string };

/** Newest first. Metadata only — bodies are fetched one at a time on preview. */
export async function listVersions(pageId: string): Promise<{ error: string } | { versions: PageVersion[] }> {
  const { supabase } = await requireSession();
  const { data, error } = await supabase
    .from('page_versions')
    .select('id, created_at')
    .eq('page_id', pageId)
    .order('created_at', { ascending: false })
    .limit(MAX_VERSIONS);
  if (error) return { error: error.message };
  return { versions: (data ?? []) as PageVersion[] };
}

export async function getVersion(versionId: string): Promise<{ error: string } | { content: Record<string, unknown> }> {
  const { supabase } = await requireSession();
  const { data, error } = await supabase
    .from('page_versions').select('content').eq('id', versionId).single();
  if (error) return { error: error.message };
  return { content: (data?.content ?? {}) as Record<string, unknown> };
}

/**
 * Offer the current content as a version. Returns `{ saved: false }` when the
 * policy declines (unchanged, or still inside the coalescing window) — that is
 * the normal case on most autosaves, not a failure.
 *
 * Called from the doc's autosave, so it must never throw into that path.
 */
export async function saveVersion(
  pageId: string,
  content: Record<string, unknown>,
): Promise<{ error: string } | { saved: boolean }> {
  const { supabase } = await requireSession();

  const { data: latest, error: readErr } = await supabase
    .from('page_versions')
    .select('id, created_at, content')
    .eq('page_id', pageId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (readErr) return { error: readErr.message };

  const newest = latest?.[0] as { id: string; created_at: string; content: unknown } | undefined;
  // Content equality by serialisation: the blob is plain JSON with no key-order
  // guarantees worth defending, and this runs at most once per autosave.
  const changed = !newest || JSON.stringify(newest.content) !== JSON.stringify(content);
  const decision = decideSnapshot({ lastVersionAt: newest?.created_at ?? null, changed });
  if (!decision.snapshot) return { saved: false };

  const { error: insErr } = await supabase.from('page_versions').insert({ page_id: pageId, content });
  if (insErr) return { error: insErr.message };

  // Prune oldest beyond the cap. Best-effort: a page that keeps 51 versions for a
  // while is not worth failing a save over.
  const { data: all } = await supabase
    .from('page_versions').select('id, created_at').eq('page_id', pageId);
  const stale = versionsToPrune((all ?? []) as PageVersion[]);
  if (stale.length) await supabase.from('page_versions').delete().in('id', stale);

  return { saved: true };
}

/**
 * Restore a version onto its page. The CURRENT content is snapshotted first, so
 * restoring is itself undoable — otherwise "restore" is a destructive act with no
 * way back, which is the one thing a history feature must never be.
 */
export async function restoreVersion(versionId: string): Promise<{ error: string } | { pageId: string }> {
  const { supabase } = await requireSession();

  const { data: version, error: vErr } = await supabase
    .from('page_versions').select('id, page_id, content').eq('id', versionId).single();
  if (vErr || !version) return { error: vErr?.message ?? 'Version not found.' };

  const { data: page, error: pErr } = await supabase
    .from('pages').select('content').eq('id', version.page_id).single();
  if (pErr) return { error: pErr.message };

  // Snapshot what we are about to overwrite, bypassing the window policy — this
  // is a discrete act, not typing, so it always earns an entry.
  await supabase.from('page_versions').insert({ page_id: version.page_id, content: page?.content ?? {} });

  const { error: upErr } = await supabase
    .from('pages')
    .update({ content: version.content, updated_at: new Date().toISOString() })
    .eq('id', version.page_id);
  if (upErr) return { error: upErr.message };

  return { pageId: version.page_id as string };
}

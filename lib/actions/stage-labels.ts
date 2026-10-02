'use server';
// Persisting a renamed pipeline stage. See lib/stage-labels.ts for why only the
// LABEL is renameable and why it lives in `profiles.preferences`.
import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { STAGES, type Stage } from '@/lib/content';
import {
  readStageLabels, writeStageLabels, normalizeStageName, withStageName,
} from '@/lib/stage-labels';

/**
 * Rename one stage, or clear the rename by passing an empty name.
 *
 * READ-MODIFY-WRITE, twice over — the same shape as `setPropertyLayout`, and for
 * the same two reasons. `preferences` is one JSON column shared with the accent,
 * the density, the timezone, the Google-sync metadata, the sidebar pins and the
 * property layouts, so writing this key alone would take all of them with it.
 * And within the key, the other stages' names are read back and rewritten,
 * because renaming `edit` must not erase what someone called `review`.
 *
 * The stage id is validated even though it comes from our own component: it
 * arrives from a client boundary, so it is an argument like any other, and a
 * name stored under a key no reader recognises is a silent no-op that the person
 * experiences as "it didn't save".
 */
export async function setStageName(stage: Stage, name: string): Promise<{ ok: true } | { error: string }> {
  if (!STAGES.includes(stage)) return { error: 'Could not rename that column.' };
  try {
    const { supabase, user } = await requireSession();
    const { data: prof } = await supabase.from('profiles').select('preferences').eq('id', user.id).maybeSingle();
    const prefs = { ...((prof?.preferences as Record<string, unknown>) ?? {}) };
    const next = withStageName(readStageLabels(prof?.preferences), stage, normalizeStageName(name, stage));
    Object.assign(prefs, writeStageLabels(next));
    const { error } = await supabase.from('profiles').update({ preferences: prefs }).eq('id', user.id);
    if (error) return { error: 'Could not rename that column.' };
    // The names are read by the page, so the page has to re-render. Scoped to
    // the layout tree because `preferences` feeds the shell as well.
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch {
    return { error: 'Could not rename that column.' };
  }
}

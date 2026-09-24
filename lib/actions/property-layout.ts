'use server';
// Persisting how a person arranged a record's property block. See
// lib/property-layout.ts for what a layout IS and why it lives in
// `profiles.preferences` rather than a table of its own.
import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import {
  readPropLayouts, writePropLayouts, PROP_SETS,
  type PropLayout, type PropSet,
} from '@/lib/property-layout';

/**
 * Replace one record kind's layout.
 *
 * READ-MODIFY-WRITE, twice over. `preferences` is one JSON column shared by the
 * accent, the density, the display font, the timezone, the Google-sync metadata
 * and the sidebar's pins — writing `{ propertyLayouts }` on its own would take
 * every one of them with it. And within this key, the OTHER record kinds' layouts
 * are read back and rewritten, because a project's arrangement must not erase a
 * client's.
 *
 * The whole layout is sent rather than a diff, for the same reason pins are: the
 * ORDER is the value being edited, so a drag is not "move key X", it is "the
 * order is now this".
 */
export async function setPropertyLayout(set: PropSet, layout: PropLayout): Promise<{ ok: true } | { error: string }> {
  // Normalise the set name too. It arrives from a client component, so it is an
  // argument like any other — a layout stored under a key no reader recognises
  // is a silent no-op the person would experience as "it didn't save".
  if (!PROP_SETS.includes(set)) return { error: 'Could not save your properties.' };
  try {
    const { supabase, user } = await requireSession();
    const { data: prof } = await supabase.from('profiles').select('preferences').eq('id', user.id).maybeSingle();
    const prefs = { ...((prof?.preferences as Record<string, unknown>) ?? {}) };
    const all = readPropLayouts(prof?.preferences);
    all[set] = layout;
    Object.assign(prefs, writePropLayouts(all));
    const { error } = await supabase.from('profiles').update({ preferences: prefs }).eq('id', user.id);
    if (error) return { error: 'Could not save your properties.' };
    // The layout is read by the page, so the page has to be re-rendered. Scoped
    // to the layout tree because `preferences` feeds the shell as well.
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch {
    return { error: 'Could not save your properties.' };
  }
}

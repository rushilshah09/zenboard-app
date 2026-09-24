'use server';
// Persisting the sidebar's pins. See lib/pins.ts for what a pin IS and why it
// lives in `profiles.preferences` rather than a table of its own.
import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { readPins, writePins, type Pin } from '@/lib/pins';
import { ENTITY_TYPES } from '@/lib/connected';

/**
 * Replace the pin list.
 *
 * READ-MODIFY-WRITE, always. `preferences` is one JSON column shared by the
 * accent, the density, the display font and the Google-sync metadata; writing
 * `{ pins }` on its own would take every one of them with it. `google-calendar`
 * merges into this column the same way, for the same reason.
 *
 * The whole list is sent rather than a diff because the ORDER is the value the
 * user is editing — a drag is not "move pin X", it is "the list is now this".
 */
export async function setPins(pins: Pin[]): Promise<{ ok: true } | { error: string }> {
  try {
    const { supabase, user } = await requireSession();
    const { data: prof } = await supabase.from('profiles').select('preferences').eq('id', user.id).maybeSingle();
    const prefs = { ...((prof?.preferences as Record<string, unknown>) ?? {}) };
    // Normalise on the way in as well as the way out: a client that sends an
    // unknown type would otherwise store a row nothing can navigate to.
    Object.assign(prefs, writePins(readPins({ pins }, ENTITY_TYPES)));
    const { error } = await supabase.from('profiles').update({ preferences: prefs }).eq('id', user.id);
    if (error) return { error: 'Could not save your pins.' };
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch {
    return { error: 'Could not save your pins.' };
  }
}

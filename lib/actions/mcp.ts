'use server';

// Minting and revoking the MCP token.
//
// Mirrors `getCalendarFeedToken` — same `profiles.preferences` jsonb, so no
// migration — with one deliberate difference: **this one is never lazy.**
//
// The feed token is created on first use because a read-only view of your own
// schedule behind an unguessable URL is close to harmless. This token reads AND
// WRITES a whole workspace, so it exists only because a person asked for it.
// An account that never connects an AI tool never has one, and there is nothing
// to leak.
import { createClient } from '@/lib/supabase/server';
import { MCP_TOKEN_KEY, newMcpToken, looksLikeMcpToken } from '@/lib/mcp';

/** The current token, if one has been minted. Never creates one. */
export async function getMcpToken(): Promise<{ error: string } | { token: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: prof } = await supabase.from('profiles').select('preferences').eq('id', user.id).maybeSingle();
  const prefs = (prof?.preferences as Record<string, unknown>) ?? {};
  const existing = prefs[MCP_TOKEN_KEY];
  return { token: typeof existing === 'string' && looksLikeMcpToken(existing) ? existing : null };
}

/**
 * Create one, or replace the existing one.
 *
 * Rotating is the only defence a bearer credential has, and it is destructive
 * in a way no dialog can undo — every tool configured with the old token stops
 * working the moment this returns. The caller confirms first.
 *
 * READ-MODIFY-WRITE of the whole `preferences` object, which the column's own
 * type comment demands: it is a bag shared with accent, density, pins and the
 * Google-sync metadata, and writing only this key would clobber all of them.
 */
export async function createMcpToken(): Promise<{ error: string } | { token: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: prof } = await supabase.from('profiles').select('preferences').eq('id', user.id).maybeSingle();
  const prefs = (prof?.preferences as Record<string, unknown>) ?? {};
  const token = newMcpToken();
  const { error } = await supabase.from('profiles')
    .upsert({ id: user.id, preferences: { ...prefs, [MCP_TOKEN_KEY]: token } }, { onConflict: 'id' });
  return error ? { error: error.message } : { token };
}

/** Cut every connected tool off. The key is REMOVED, not blanked. */
export async function revokeMcpToken(): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: prof } = await supabase.from('profiles').select('preferences').eq('id', user.id).maybeSingle();
  const prefs = { ...((prof?.preferences as Record<string, unknown>) ?? {}) };
  // Deleting the key rather than setting it to '' matters: `.contains()` is how
  // the route finds an owner, and a stored empty string would still be a value
  // that some future query could match.
  delete prefs[MCP_TOKEN_KEY];
  const { error } = await supabase.from('profiles')
    .upsert({ id: user.id, preferences: prefs }, { onConflict: 'id' });
  return error ? { error: error.message } : { ok: true };
}

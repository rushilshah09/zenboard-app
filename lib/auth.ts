import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { sessionUserFromClaims, type SessionUser } from '@/lib/session-user';
import type { User } from '@supabase/supabase-js';

// Who is signed in, asked once per request.
//
// THE BUG THIS EXISTS FOR. Every page under `(app)` wrote `user!.id`, on a
// comment that said "auth is enforced by the (app) layout". The layout does
// call `redirect('/login')` — but a layout cannot gate a page: in the App
// Router a layout and its page render CONCURRENTLY, so the page body runs
// before the layout's redirect can stop it. Signed out, `user` is null and the
// `!` becomes `TypeError: Cannot read properties of null (reading 'id')` — an
// unhandled server error on seventeen call sites, seen in the dev log on
// `/today`.
//
// A non-null assertion is a claim the type system cannot check, and this one
// was false. `requireUser()` makes it true instead: it returns a `User`, never
// null, because the only other path out is the redirect.
//
// It is also where the duplicate `getUser()` round trips go. `cache()` keys on
// arguments, so it only memoises usefully on a ZERO-ARGUMENT function — the
// same reason `spaceList()` is shaped the way it is, and the reason
// `activeSpaceId(supabase, id)` could not be wrapped. A navigation used to
// spend three of these at ~220ms each.

// ── READING A PAGE'S IDENTITY COSTS NOTHING NOW (2026-09-11) ────────────────
// `getUser()` is a NETWORK CALL: it asks the Auth server to vouch for the
// session, and at ~200ms from Seoul that round trip sat in FRONT of every page
// — nothing else could start until it answered, on every navigation.
//
// This project signs its sessions with an asymmetric key (ES256), and its
// public half is published. So the server can check the signature itself, in
// about a millisecond, which is what `getClaims()` does — Supabase's own
// recommendation for exactly this. (`auth-js` keeps the key set in a
// module-level cache for ten minutes, so a warm worker fetches nothing; a
// symmetric secret or a missing WebCrypto would make it fall back to
// `getUser()` on its own, so this is safe wherever it runs.)
//
// WHAT CHANGES, HONESTLY. A token is proof that this session was issued to
// this person and has not expired — not that it is still wanted. Sign out on
// another device and this tab can keep RENDERING pages until the token
// expires (an hour by default). What it cannot do is read or write anything
// new: every query carries the same token to Postgres, which checks it and
// applies row-level security regardless of what this helper decided. Anything
// that CHANGES data goes through `requireSession()` below, which still asks
// the Auth server.

/** The signed-in user for a page render, proved by the session's own token. */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return sessionUserFromClaims(data?.claims);
});

/**
 * The signed-in user, re-verified with the Auth server — a network round trip.
 *
 * For anything that must know the session is still live at this instant: every
 * write, and any read of somebody else's data. Pages use `currentUser()`.
 */
export const verifiedUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

/**
 * The signed-in user, or a redirect to `/login`.
 *
 * For pages and their loaders. A server ACTION must use `requireSession()`
 * instead — an action answers a fetch, and redirecting a POST is not the same
 * thing as failing it.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * The client and the user, for a server ACTION. Throws when signed out.
 *
 * Twenty-two server actions had written this out privately — twenty-one of them
 * byte-identical — under the same name as the page-side helper but with
 * different behaviour. One name meaning two things is worse than either, and an
 * action that redirected a POST instead of failing it would be a real bug, so
 * the two shapes are named apart and defined once.
 *
 * It throws rather than redirects on purpose: a Server Action's job is to answer
 * the caller. Callers surface `{ error }`; the thrown message is the last resort
 * for one that doesn't.
 */
export async function requireSession() {
  const supabase = await createClient();
  // `verifiedUser`, not `currentUser`: an action changes data, so it asks the
  // Auth server whether this session is still live rather than trusting a
  // token that was handed out up to an hour ago.
  const user = await verifiedUser();
  if (!user) throw new Error('Not authenticated');
  return { supabase, user };
}

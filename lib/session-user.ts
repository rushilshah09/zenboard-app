// Who a request is, as proved by the session's own signed token.
//
// Kept apart from `lib/auth.ts` on purpose: that module is `server-only` and
// pulls in the Supabase client, so this rule — the one piece worth testing —
// would not be reachable from a test without it.
//
// The shape is deliberately narrow. A page needs an id (every query is scoped
// by it) and an email (the display-name fallback), and those are exactly the
// two things a verified token carries. Anything wider would be a promise the
// token cannot keep.

/** The identity in a verified session token. */
export type SessionUser = { id: string; email: string | null };

/** The claims a Supabase JWT carries, as far as this app reads them. */
export type SessionClaims = { sub?: unknown; email?: unknown } | null | undefined;

/**
 * The identity a verified token carries, or null when it carries none.
 *
 * `sub` is the user id. A token without one is not an identity, however well
 * it is signed — treat it as signed out rather than inventing a user.
 */
export function sessionUserFromClaims(claims: SessionClaims): SessionUser | null {
  const id = claims?.sub;
  if (typeof id !== 'string' || id === '') return null;
  const email = claims?.email;
  return { id, email: typeof email === 'string' && email !== '' ? email : null };
}

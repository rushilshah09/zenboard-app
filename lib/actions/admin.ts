'use server';
// The two writes behind the admin door. Nothing here reads platform data — that stays in
// lib/waitlist-data.ts, under `server-only`, where it cannot become an endpoint.

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ADMIN_COOKIE, adminToken, passwordOk } from '@/lib/admin';

/** A wrong password costs a second. Not a real rate limit — enough to make guessing over a network
 *  pointless, without holding a correct sign-in up. */
const WRONG_DELAY_MS = 1000;

export async function signInAdmin(password: string): Promise<{ ok: true } | { error: string }> {
  if (!process.env.ADMIN_PASSWORD) return { error: 'No admin password is set on this deployment.' };
  if (!(await passwordOk(password ?? ''))) {
    await new Promise((r) => setTimeout(r, WRONG_DELAY_MS));
    return { error: 'That password is not right.' };
  }
  const token = await adminToken();
  if (!token) return { error: 'No admin password is set on this deployment.' };
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,                                   // no script can read it
    secure: process.env.NODE_ENV === 'production',    // off localhost, which has no TLS
    sameSite: 'lax',                                  // never travels on a cross-site request
    path: '/admin',                                   // it is only ever needed here
    maxAge: 60 * 60 * 24 * 14,
  });
  revalidatePath('/admin/waitlist');
  return { ok: true };
}

export async function signOutAdmin(): Promise<void> {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: '/admin' });
  revalidatePath('/admin/waitlist');
}

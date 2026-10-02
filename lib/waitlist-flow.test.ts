import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isAdminEmail, adminEmails } from './admin';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

describe('the one way in, and the ways that are shut', () => {
  const action = read('lib/actions/waitlist.ts');
  const data = read('lib/waitlist-data.ts');

  it('exports only the two things that are MEANT to be endpoints', () => {
    // Every export of a `'use server'` file is a public endpoint, so this list is a decision, not an
    // inventory. Both are things a stranger may legitimately do: join, and ask whether a handle is
    // free. Nothing here returns anybody else's address — the reads that do live in
    // lib/waitlist-data.ts, under `server-only`.
    expect(action.trimStart().startsWith("'use server'")).toBe(true);
    const exported = [...action.matchAll(/^export (?:async )?function (\w+)/gm)].map((m) => m[1]).sort();
    expect(exported).toEqual(['joinWaitlist', 'usernameAvailable']);
  });

  it('claims the handle in the SAME INSERT, so there is no second step to authorise', () => {
    // The handle used to be claimed afterwards by a second action, authorised by the row's uuid
    // handed to the browser. Claiming it with the row removed that step AND its bearer capability:
    // joining and claiming cannot half-happen, and there is no id-shaped key in the page to spend.
    expect(action).toMatch(/\.insert\(\{ email, name, source, \.\.\.\(wanted \? \{ username: wanted/);
    // A stripped copy, so this cannot pass on the banner that explains the deletion.
    const code = action.replace(/^\s*\/\/.*$/gm, '');
    expect(code, 'the second-step action is gone, not just unused').not.toMatch(/claimUsername/);
    expect(code).not.toMatch(/\.is\('username', null\)/);
  });

  it('keeps the READS out of that file — they return other people’s addresses', () => {
    expect(data.trimStart().startsWith("import 'server-only'")).toBe(true);
    // A DIRECTIVE, not a mention: this file's own comments explain why it is not a 'use server'
    // module, and a bare substring search matches that prose and fails on correct code.
    const directive = /^\s*(['"])use server\1\s*;?\s*$/m;
    expect(directive.test(data), 'a read must never become a POST endpoint').toBe(false);
    expect(directive.test(read('lib/actions/waitlist.ts')), 'the write IS one').toBe(true);
    for (const fn of ['waitlistReady', 'waitlistCount', 'listWaitlist']) {
      expect(data, fn).toMatch(new RegExp(`export async function ${fn}`));
    }
  });

  it('runs the same two spam guards the public form renderer runs', () => {
    // Shared, not copied: lib/spam-guard.ts. Two copies of a rule like this drift — one gets a fix
    // and the other keeps the bug.
    expect(action).toMatch(/from '@\/lib\/spam-guard'/);
    expect(read('lib/actions/forms.ts')).toMatch(/from '@\/lib\/spam-guard'/);
    expect(action).toMatch(/trippedHoneypot\(input\.honeypot\) \|\| tooFast\(input\.startedAt, MIN_FILL_MS_SINGLE_FIELD\)/);
    // A tripped guard answers like a success: a bot learns nothing, and a real person who trips one
    // is not shown a wall.
    expect(action).toMatch(/\{ ok: true, id: '', number: 0, name: null, username: null, already: true \}/);
  });

  it('hands a second submit the number they already hold', () => {
    // Joining twice is a second tab or a refresh, not an error to show someone.
    expect(action).toMatch(/error\?\.code === '23505'/);
    expect(action).toMatch(/return \{ ok: true, id: mine\.id, number: mine\.number, name: mine\.name, username: mine\.username, already: true \}/);
  });

  it('probes with a request the answer can come back from', () => {
    // THE BUG THIS EXISTS FOR (found live, 2026-09-30). `waitlistReady()` asked with `head: true`.
    // A HEAD response has no body, so PostgREST's 404 for a missing table arrived with ZERO bytes,
    // supabase-js had nothing to parse and returned `error: null` — and the probe cheerfully
    // answered "ready" for a table that did not exist. The site showed a live form that failed the
    // moment anybody used it. Measured against the deployed project: HEAD → 404, 0 bytes;
    // GET → 404, 166 bytes carrying PGRST205.
    const probe = data.slice(data.indexOf('export async function waitlistReady'), data.indexOf('export async function waitlistCount'));
    expect(probe, 'the readiness probe must read a body').not.toMatch(/head: true/);
    expect(probe).toMatch(/\.select\('id'\)\.limit\(1\)/);
    // The count MAY use head (it only wants the number), but must then treat a null count as
    // "could not read" rather than as zero.
    const count = data.slice(data.indexOf('export async function waitlistCount'), data.indexOf('export async function listWaitlist'));
    expect(count).toMatch(/count == null/);
  });

  it('recognises the code PostgREST actually returns for a missing table', () => {
    // The write goes through PostgREST, which answers PGRST205; Postgres's own 42P01 only appears
    // when the relation vanishes under a prepared statement. Checking 42P01 alone turned a missing
    // migration into "Something went wrong."
    expect(action).toMatch(/error\?\.code === '42P01' \|\| error\?\.code === 'PGRST205'/);
  });

  it('shows the admin the handle it asked people for', () => {
    // A handle is COLLECTED at the door and HELD until launch, which is a promise only the person
    // who runs the platform can keep — and they cannot keep it if the list never shows them who
    // claimed what. The first version stored `username` and then selected five other columns, so
    // `@rushil` existed in the database and nowhere a human could see it.
    expect(data).toMatch(/\.select\('id, number, email, name, username, username_claimed_at, source, created_at'\)/);
    expect(data).toMatch(/username: string \| null;/);

    const table = read('components/admin/waitlist-table.tsx');
    expect(table, 'a column to read it in').toMatch(/key: 'username', header: 'Username'/);
    expect(table, 'a field to export it in').toMatch(/\['number', 'email', 'name', 'username', 'source', 'joined_at'\]/);
    expect(table, 'and a way to search for one').toMatch(/r\.username \?\? ''\)\.includes\(handle\)/);
  });

  it('names the export file after the day the READER is standing in', () => {
    // lib/date.ts, not `toISOString().slice(0, 10)`: the second is the UTC date, so every export
    // taken in IST between midnight and 05:30 would be filed under yesterday. The same rule the
    // rest of the product follows for every calendar date it writes down.
    const table = read('components/admin/waitlist-table.tsx');
    const code = table.replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/toISOString\(\)\.slice\(0, 10\)/);
    expect(code).toMatch(/zenboard-waitlist-\$\{todayISO\(\)\}\.csv/);
  });

  it('never throws — an action that rejects is a page with no message on it', () => {
    expect(action).toMatch(/} catch \{\s*return \{ error:/);
    for (const fn of ['waitlistReady', 'waitlistCount', 'listWaitlist']) {
      expect(data.split(`export async function ${fn}`)[1]).toMatch(/} catch \{/);
    }
  });
});

describe('public sign-up is closed at the ROUTE, not just on the screen', () => {
  it('refuses the endpoint, so hiding the form is only a courtesy', () => {
    // A hidden form is not a closed door: without this, a stranger could POST straight to it.
    const route = read('app/api/auth/signup/route.ts');
    expect(route).toMatch(/import \{ SIGNUPS_OPEN \} from '@\/lib\/waitlist';/);
    expect(route).toMatch(/if \(!SIGNUPS_OPEN\) \{[\s\S]*?status: 403/);
    expect(read('lib/waitlist.ts')).toMatch(/export const SIGNUPS_OPEN = false;/);
  });

  it('and the screen offers the thing that DOES exist', () => {
    const login = read('app/login/page.tsx');
    expect(login).toMatch(/const isSignup = SIGNUPS_OPEN && mode === 'signup';/);
    // The href and the label, not their adjacency: the icon sits between them in the markup, so a
    // regex spanning the two breaks on a line wrap rather than on a real change.
    expect(login).toMatch(/href="\/waitlist"/);
    expect(login).toMatch(/Join the waitlist/);
  });

  it('sends every call to action on the site to the same door, saying the same words', () => {
    const chrome = read('components/site/site-chrome.tsx');
    expect(chrome).toMatch(/export const SIGN_UP = '\/waitlist';/);
    expect(chrome).toMatch(/export const SIGN_UP_LABEL = 'Join the waitlist';/);
    // No page writes the words itself, so no two buttons can disagree.
    for (const f of ['components/site/site-chrome.tsx', 'components/site/site-home.tsx', 'components/site/page-kit.tsx']) {
      expect(read(f), `${f} still says "Start free"`).not.toMatch(/>Start free</);
    }
  });
});

describe('the admin list is gated by who is asking', () => {
  it('lets nobody in when the list is unset — a missing variable is not an open door', () => {
    const before = process.env.ADMIN_EMAILS;
    try {
      delete process.env.ADMIN_EMAILS;
      expect(adminEmails()).toEqual([]);
      expect(isAdminEmail('anyone@example.com')).toBe(false);
      process.env.ADMIN_EMAILS = '';
      expect(isAdminEmail('anyone@example.com')).toBe(false);
    } finally {
      if (before === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = before;
    }
  });

  it('folds case and spacing, so a capital in the dashboard is not a locked door', () => {
    const before = process.env.ADMIN_EMAILS;
    try {
      process.env.ADMIN_EMAILS = ' Owner@Example.com , second@example.com ';
      expect(isAdminEmail('owner@example.com')).toBe(true);
      expect(isAdminEmail('OWNER@EXAMPLE.COM')).toBe(true);
      expect(isAdminEmail('second@example.com')).toBe(true);
      expect(isAdminEmail('someone@example.com')).toBe(false);
      expect(isAdminEmail(null)).toBe(false);
      expect(isAdminEmail('')).toBe(false);
    } finally {
      if (before === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = before;
    }
  });

  it('gates the PAGE, because a layout is not a gate', () => {
    const page = read('app/admin/waitlist/page.tsx');
    // The FIRST statement, and it renders a door rather than redirecting: someone holding the
    // password has no Supabase account, so a login screen would be a door with no handle.
    expect(page).toMatch(/export default async function Page\(\) \{[\s\S]{0,400}?if \(!\(await adminOk\(\)\)\) return <AdminGate \/>;/);
    expect(page).toMatch(/robots: \{ index: false, follow: false \}/);
    expect(read('lib/site-pages.ts'), 'robots.txt keeps it out too').toMatch(/NON_PAGE_PATHS = \[[^\]]*'\/admin'/);
  });

  it('exports what is on SCREEN, not quietly everything', () => {
    // A Download that gives you the whole list when you asked for a subset is the kind of thing
    // people discover after they have sent it to somebody.
    const table = read('components/admin/waitlist-table.tsx');
    expect(table).toMatch(/toCsv\(shown\)/);
    // And a name or address holding a comma must not shift every later column.
    expect(table).toMatch(/function csvField/);
    expect(table).toMatch(/\/\[",\\n\\r\]\/\.test\(v\)/);
  });
});

describe('the password door', () => {
  const admin = read('lib/admin.ts');

  it('never puts the password in the source', () => {
    // It is `ADMIN_PASSWORD`, read at runtime. A literal here would be in the repository, in every
    // clone of it, and in its history for good.
    expect(admin).toMatch(/process\.env\.ADMIN_PASSWORD/);
    expect(admin, 'no password literal').not.toMatch(/ADMIN_PASSWORD\s*=\s*['"`]/);
    expect(read('lib/actions/admin.ts'), 'nor in the action').not.toMatch(/ADMIN_PASSWORD\s*=\s*['"`]/);
  });

  it('never puts the password in the COOKIE either', () => {
    // The cookie carries an HMAC of a fixed string keyed BY the password: it cannot be turned back
    // into it, cannot be forged without it, and every cookie stops working the moment it changes —
    // which is what makes changing it safe.
    // `[^)]*` cannot cross the `)` in `enc.encode(password)` — the same fixed-window trap the
    // worker-budget guard hit. Match lazily across whatever sits between.
    expect(admin).toMatch(/crypto\.subtle\.importKey\('raw',[\s\S]*?'HMAC'/);
    expect(admin).toMatch(/crypto\.subtle\.sign\('HMAC'/);
  });

  it('compares in constant time, and refuses when no password is set', () => {
    // A comparison that stops at the first wrong character tells an attacker how much of the guess
    // was right, one request at a time.
    expect(admin).toMatch(/function sameSecret/);
    expect(admin).toMatch(/diff \|= a\.charCodeAt\(i\) \^ b\.charCodeAt\(i\)/);
    expect(admin, 'a missing variable is not an open door').toMatch(/if \(!real\) return false;/);
  });

  it('sets a cookie no script can read, scoped to where it is needed', () => {
    const act = read('lib/actions/admin.ts');
    expect(act).toMatch(/httpOnly: true/);
    expect(act).toMatch(/sameSite: 'lax'/);
    expect(act).toMatch(/path: '\/admin'/);
    expect(act).toMatch(/secure: process\.env\.NODE_ENV === 'production'/);
    // A wrong password costs a second, so guessing over a network is pointless.
    expect(act).toMatch(/WRONG_DELAY_MS/);
  });
});
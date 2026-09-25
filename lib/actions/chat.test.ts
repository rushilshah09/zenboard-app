import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// ── CHAT SECURITY, AS SOURCE GUARDS ────────────────────────────────────────
//
// A client reaches chat through a portal LINK, not an account, so every property that keeps one
// client out of another's conversation lives in code a later edit could quietly break. Each guard
// below names the attack it exists for.

const src = readFileSync('lib/actions/chat.ts', 'utf8');
const code = src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const sql = readFileSync('supabase/migrations/0043_project_messages.sql', 'utf8');
const ddl = sql.replace(/--.*$/gm, '');

/** The body of one exported function, up to the next top-level declaration. */
const fn = (name: string) => {
  const start = code.indexOf(`export async function ${name}(`);
  expect(start, `${name} exists`).toBeGreaterThan(-1);
  const next = code.slice(start + 1).search(/\n(export )?(async )?function /);
  return next === -1 ? code.slice(start) : code.slice(start, start + 1 + next);
};

describe('the client door', () => {
  it('keeps the service-role resolver private', () => {
    // In a 'use server' file every EXPORTED async function is callable from the browser. Exporting
    // this would hand anyone a service-role database client.
    expect(code).toMatch(/\nasync function resolvePortal\(/);
    expect(code).not.toMatch(/export async function resolvePortal/);
  });

  it('re-resolves the token on EVERY client call', () => {
    // A token checked once and then trusted is a token that keeps working after the owner turns
    // the portal off.
    for (const name of ['portalLoadChat', 'portalSendMessage', 'portalMarkRead', 'portalLoadOlder', 'portalEditMessage', 'portalDeleteMessage']) {
      expect(fn(name), name).toMatch(/await resolvePortal\(token\)/);
    }
  });

  it('refuses a short token, an unknown token and a disabled portal', () => {
    const resolve = code.slice(code.indexOf('async function resolvePortal('), code.indexOf('const GONE'));
    expect(resolve).toMatch(/token\.length < 8\) return null/);
    expect(resolve).toMatch(/\.eq\('portal_token', token\)/);
    expect(resolve).toMatch(/!p\.portal_enabled\) return null/);
  });

  it('scopes every client query to the token’s own project', () => {
    for (const name of ['portalLoadChat', 'portalSendMessage', 'portalMarkRead', 'portalLoadOlder', 'portalEditMessage', 'portalDeleteMessage']) {
      expect(fn(name), name).toMatch(/portal\.projectId/);
      // …and never to an id the caller supplied.
      expect(fn(name), name).not.toMatch(/projectId: string/);
    }
  });

  it('can only ever author as the client', () => {
    // Whatever the browser sends, a portal message is the client's. A link must not be able to
    // post words in the owner's name.
    expect(fn('portalSendMessage')).toMatch(/author: 'client'/);
    expect(fn('portalSendMessage')).not.toMatch(/author: 'team'/);
    expect(fn('portalMarkRead')).toMatch(/reader: 'client'/);
  });

  it('caps a burst, so a leaked link cannot flood a channel', () => {
    const send = fn('portalSendMessage');
    // The COMPARISON and its early return — not merely the ingredients. The first version of this
    // guard checked that the constant and the time query were present, and a mutant that kept both
    // but never compared them passed it (caught by mutation-testing this file, 2026-09-25).
    const cap = send.search(/if \(\(count \?\? 0\) >= CLIENT_BURST_PER_MINUTE\) return \{ error:/);
    expect(cap, 'the cap is enforced').toBeGreaterThan(-1);
    expect(cap, 'and enforced BEFORE the write').toBeLessThan(send.indexOf('.insert('));
    expect(send).toMatch(/\.gte\('created_at', since\)/);
  });
});

describe('editing and deleting (C2)', () => {
  it('lets a link touch only ITS OWN side’s messages, in ITS OWN project, that still exist', () => {
    // Three scopes, every one load-bearing. Without the project scope a link could rewrite another
    // project's history; without the author scope it could put words in the studio's mouth; without
    // the deleted scope it could resurrect a message someone removed.
    for (const name of ['portalEditMessage', 'portalDeleteMessage']) {
      const body = fn(name);
      expect(body, `${name}: its own project`).toMatch(/\.eq\('project_id', portal\.projectId\)/);
      expect(body, `${name}: its own side`).toMatch(/\.eq\('author', 'client'\)/);
      expect(body, `${name}: still exists`).toMatch(/\.is\('deleted_at', null\)/);
      expect(body, `${name}: never the team's`).not.toMatch(/'team'/);
    }
  });

  it('holds the owner to the team’s own messages', () => {
    for (const name of ['editMessage', 'deleteMessage']) {
      expect(fn(name), name).toMatch(/\.eq\('author', 'team'\)/);
      expect(fn(name), name).toMatch(/\.is\('deleted_at', null\)/);
    }
  });

  it('OVERWRITES a deleted message’s words rather than hiding them', () => {
    // A hidden body would still ride every backup, every realtime payload and the client's next poll.
    for (const name of ['deleteMessage', 'portalDeleteMessage']) {
      expect(fn(name), name).toMatch(/body: DELETED_BODY, deleted_at:/);
    }
  });

  it('checks an edit’s words before any database call, on both doors', () => {
    for (const name of ['editMessage', 'portalEditMessage']) {
      const body = fn(name);
      expect(body.indexOf('normalizeBody(raw)'), name).toBeGreaterThan(-1);
      expect(body.indexOf('normalizeBody(raw)'), `${name} checks first`).toBeLessThan(body.indexOf('.update('));
    }
  });

  it('never passes a browser timestamp to a query unchecked', () => {
    for (const name of ['loadOlder', 'portalLoadOlder']) {
      const body = fn(name);
      expect(body.indexOf('validInstant(before)'), name).toBeGreaterThan(-1);
      expect(body.indexOf('validInstant(before)'), `${name} checks first`).toBeLessThan(body.indexOf('.lt('));
    }
  });

  it('answers a refused edit or delete out loud, never as a silent no-op', () => {
    expect(code.match(/You can only edit your own messages\./g)?.length).toBe(2);
    expect(code.match(/You can only delete your own messages\./g)?.length).toBe(2);
  });
});

describe('the owner door', () => {
  it('goes through the session, and authors only as the team', () => {
    for (const name of ['loadChannel', 'sendMessage', 'markChannelRead', 'loadOlder', 'editMessage', 'deleteMessage']) {
      expect(fn(name), name).toMatch(/await requireSession\(\)/);
    }
    expect(fn('sendMessage')).toMatch(/author: 'team'/);
  });

  it('shows the channels the Projects page shows, in the same space', () => {
    // The list is loaded by the PAGE through `pageScope()` (which already knows the user and the
    // space), so it lives outside the actions file and is scoped exactly as Projects is.
    const channels = readFileSync('lib/chat-channels.ts', 'utf8');
    expect(channels).toMatch(/\.eq\('space_id', sid\)/);
    expect(channels).toMatch(/\.not\('client_id', 'is', null\)/);
    const page = readFileSync('app/(app)/messages/page.tsx', 'utf8');
    expect(page).toMatch(/await pageScope\(\)/);
    expect(page).toMatch(/loadChannels\(supabase, sid\)/);
  });
});

describe('every write is checked before it is sent', () => {
  it('normalizes the body on both sides, before any database call', () => {
    for (const name of ['sendMessage', 'portalSendMessage']) {
      const body = fn(name);
      expect(body.indexOf('normalizeBody(raw)'), name).toBeGreaterThan(-1);
      expect(body.indexOf('normalizeBody(raw)'), `${name} checks first`).toBeLessThan(body.indexOf('.insert('));
    }
  });

  it('answers with { error } and keeps what the person typed', () => {
    expect(code).toMatch(/Could not send\. Your message is still here\./);
    expect(code).toMatch(/Messages need migration 0043\./);
  });
});

describe('the migration', () => {
  it('gives the client NO policy at all — every client path is the token action', () => {
    // An anon SELECT policy would expose every project's messages to anyone holding the public
    // anon key, which ships in the browser bundle.
    expect(ddl).not.toMatch(/\bto anon\b/i);
    expect(ddl).not.toMatch(/auth\.role\(\)\s*=\s*'anon'/);
    const policies = [...ddl.matchAll(/create policy (\w+) on (\w+)/g)].map((m) => `${m[2]}.${m[1]}`);
    expect(policies).toEqual([
      'project_messages.owner_sel', 'project_messages.owner_ins', 'project_messages.owner_upd',
      'project_message_reads.owner_all',
    ]);
  });

  it('lets the owner insert only as the team, so the app cannot forge a client message', () => {
    expect(ddl).toMatch(/owner_ins on project_messages for insert\s+with check \(author = 'team'/);
  });

  it('bounds a body in the database, not only in the app', () => {
    expect(ddl).toMatch(/check \(char_length\(body\) between 1 and 8000\)/);
  });

  it('is safe to run twice', () => {
    expect(ddl).toMatch(/create table if not exists project_messages/);
    expect(ddl).toMatch(/if not exists \(select 1 from pg_policies/);
    expect(ddl).toMatch(/if not exists \(\s*select 1 from pg_publication_tables/);
  });
});

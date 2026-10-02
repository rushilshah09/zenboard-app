import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  WAITLIST_SEED, formatTicket, joinedTotal, normaliseEmail, normaliseName,
  emailLooksValid, shareMessage, shareUrl, ticketFilename, isWaitlistSource,
} from './waitlist';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

describe('the number on the ticket is a place in a queue', () => {
  it('starts the first real person one above the seed, and the SQL agrees', () => {
    // The seed and the sequence are two spellings of one decision. If they ever disagree, the number
    // printed on someone's ticket stops matching the count they were shown the moment before.
    const sql = read('supabase/migrations/0048_waitlist.sql');
    expect(sql).toMatch(new RegExp(`start with ${WAITLIST_SEED + 1} minvalue ${WAITLIST_SEED + 1}`));
    expect(joinedTotal(0), 'before anyone joins, the list still counts the seed').toBe(WAITLIST_SEED);
    expect(joinedTotal(1), 'the first signup makes the count agree with their number').toBe(WAITLIST_SEED + 1);
  });

  it('pads to the ticket’s three digits and never truncates a longer number', () => {
    expect(formatTicket(81)).toBe('#081');
    expect(formatTicket(5)).toBe('#005');       // the width the reference ticket is drawn for
    expect(formatTicket(1042)).toBe('#1042');   // longer prints whole — truncating renumbers someone
    expect(ticketFilename(81)).toBe('zenboard-ticket-081.png');
  });

  it('never returns a count below the seed, whatever it is handed', () => {
    expect(joinedTotal(-5)).toBe(WAITLIST_SEED);
    expect(joinedTotal(1.9)).toBe(WAITLIST_SEED + 1);
  });
});

describe('one row per person', () => {
  it('folds case and spacing, the way the unique index does', () => {
    expect(normaliseEmail('  Jane@Acme.CO ')).toBe('jane@acme.co');
    // The index in 0048 is on lower(email) — the same fold, or a duplicate slips past.
    expect(read('supabase/migrations/0048_waitlist.sql')).toMatch(/unique index[^;]*waitlist \(lower\(email\)\)/);
  });

  it('asks the same question a form’s email field asks', () => {
    expect(emailLooksValid('jane@acme.co')).toBe(true);
    expect(emailLooksValid('jane@acme')).toBe(false);
    expect(emailLooksValid('not an email')).toBe(false);
    // Reused, not re-written: one regex for the whole product.
    expect(read('lib/waitlist.ts')).toMatch(/import \{ EMAIL_RE \} from '@\/lib\/form-schema';/);
  });

  it('keeps a name inside the column it is stored in', () => {
    expect(normaliseName('  Jane   Doe ')).toBe('Jane Doe');
    expect(normaliseName('')).toBe(null);
    expect(normaliseName(null)).toBe(null);
    expect(normaliseName('x'.repeat(200))!.length, 'the column caps at 80').toBe(80);
  });

  it('only accepts a source the column allows', () => {
    expect(isWaitlistSource('hero')).toBe(true);
    expect(isWaitlistSource('nonsense')).toBe(false);
    expect(isWaitlistSource(null)).toBe(false);
  });
});

describe('sharing opens a composer, it never posts for someone', () => {
  it('writes the number into the words, in sentence case', () => {
    const m = shareMessage(81);
    expect(m).toContain('#081');
    expect(m, 'no slogan, no shouting').not.toMatch(/[A-Z]{4,}|!{1,}/);
  });

  it('sends each network its own composer, carrying our address only', () => {
    const origin = 'https://zenboard.life';
    expect(shareUrl('x', 81, origin)).toMatch(/^https:\/\/x\.com\/intent\/tweet\?text=/);
    expect(shareUrl('linkedin', 81, origin)).toMatch(/^https:\/\/www\.linkedin\.com\/sharing\/share-offsite\/\?url=/);
    expect(shareUrl('whatsapp', 81, origin)).toMatch(/^https:\/\/wa\.me\/\?text=/);
    for (const t of ['x', 'linkedin', 'whatsapp'] as const) {
      expect(shareUrl(t, 81, origin), 'the shared address is ours').toContain(encodeURIComponent('https://zenboard.life/waitlist'));
    }
    // A trailing slash on the origin must not produce a double slash in the shared link.
    expect(shareUrl('x', 81, 'https://zenboard.life/')).toContain(encodeURIComponent('https://zenboard.life/waitlist'));
  });
});

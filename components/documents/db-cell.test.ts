import { describe, it, expect } from 'vitest';
import { valueAction } from './db-cell';

// A link, an email address and a phone number are text you can edit, with their
// action beside them (plan T10, after Notion). The action is a URL the app hands
// to the browser, so what it will and will not build is the security boundary.
describe('valueAction — what a text-like value offers beside it', () => {
  it('opens a link, and gives a bare domain its scheme', () => {
    expect(valueAction('url', 'https://zenboard.app/x')).toMatchObject({ href: 'https://zenboard.app/x', external: true });
    expect(valueAction('url', 'zenboard.app')).toMatchObject({ href: 'https://zenboard.app/' });
  });

  it('never builds a link the app would not vouch for', () => {
    expect(valueAction('url', 'javascript:alert(1)')).toBeNull();
    expect(valueAction('url', 'java\tscript:alert(1)')).toBeNull();
    expect(valueAction('url', '   ')).toBeNull();
  });

  it('writes to an address that looks like one, and calls a number with digits in it', () => {
    expect(valueAction('email', 'ana@studio.co')).toMatchObject({ href: 'mailto:ana@studio.co', external: false });
    expect(valueAction('email', 'not an email')).toBeNull();
    expect(valueAction('phone', '+91 98765 43210')).toMatchObject({ href: 'tel:+919876543210' });
    expect(valueAction('phone', 'call me')).toBeNull();
  });

  it('offers nothing for a type without an action', () => {
    expect(valueAction('text', 'https://zenboard.app')).toBeNull();
    expect(valueAction('number', '42')).toBeNull();
  });
});

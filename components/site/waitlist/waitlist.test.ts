import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const art = read('components/site/waitlist/ticket-art.ts');
const css = read('app/ticket.css');
const ticket = read('components/site/waitlist/golden-ticket.tsx');

describe('the golden ticket is the user’s artwork, not a copy of it', () => {
  it('shows WHY a username cannot be taken, where the person is looking', () => {
    // This is what makes `setStatus({ kind: 'bad' })` an accepted failure channel in
    // app/design-system.test.ts rather than a way to mark an error handled while showing nothing.
    const claim = read('components/site/waitlist/waitlist-form.tsx');
    expect(claim).toMatch(/\{ kind: 'bad'; why: string \}/);
    // The Field renders the reason as its error, and the line under it carries the live answer.
    expect(claim, 'the reason is rendered').toMatch(/error=\{handle\.kind === 'bad' \? handle\.why : undefined\}/);
    expect(claim, 'in a live region under the field').toMatch(/<p aria-live="polite"/);
    // Claimed AS they join, in one insert — no second step, and no capability token in the browser.
    expect(read('lib/actions/waitlist.ts')).toMatch(/\.insert\(\{ email, name, source, \.\.\.\(wanted \?/);
  });

  it('keeps the export’s own proportions, not a rounded-off ratio', () => {
    // Every layer shares the holder's box from Frame 15917.svg: 618 × 401 in the export's units.
    expect(art).toMatch(/export const VIEWBOX = '411 239\.5 618 401';/);
    expect(art).toMatch(/export const TICKET_RATIO = 618 \/ 401;/);
    expect(css).toMatch(/aspect-ratio: 618 \/ 401;/);
  });

  it('draws its grain rather than shipping 1.6 MB of it', () => {
    // Figma embedded the brushed texture as a 1024px noise PNG. feTurbulence makes the same grain
    // for nothing (theme-paper.css: "a theme never waits on a network request").
    expect(art).toMatch(/<feTurbulence type=\\"fractalNoise\\"/);
    expect(art, 'no embedded raster survived the extraction').not.toMatch(/base64/);
    expect(art, 'and nothing reaches out over the network').not.toMatch(/href=\\"http/);
    const kb = statSync(join(root, 'components/site/waitlist/ticket-art.ts')).size / 1024;
    expect(kb, `ticket-art.ts is ${kb.toFixed(0)} KB`).toBeLessThan(120);
  });

  it('prints the name, the number and the address ON the ticket, in its own gold', () => {
    expect(art, 'no baked-in print').not.toMatch(/<text/);
    expect(ticket).toMatch(/className="zb-ticket-number"/);
    expect(ticket).toMatch(/className="zb-ticket-name"/);
    expect(ticket).toMatch(/const ADDRESS = 'zenboard\.life';/);
    // The logo glyphs' own treatment: their gold ramp and their emboss, so the print catches the
    // same light as the lockup.
    expect(ticket).toMatch(/filter=\{`url\(#\$\{art\.id\('zb-print-emboss'\)\}\)`\}/);
    expect(ticket).toMatch(/fill=\{`url\(#\$\{art\.id\('zb-print-gold'\)\}\)`\}/);
    // And it lives in the ticket layer, so it travels with the card when it slides out.
    expect(ticket.indexOf('{print}')).toBeGreaterThan(ticket.indexOf('zb-ticket-front'));
  });

  it('is one object to a screen reader, and its parts are decoration', () => {
    expect(ticket).toMatch(/role="img"/);
    expect(ticket).toMatch(/Zenboard waitlist ticket for \$\{name\}, number/);
    expect(ticket).toMatch(/Zenboard waitlist ticket, number/);
    // The one control is a real button that says what it does.
    expect(ticket).toMatch(/<button type="button" className="zb-ticket-turn" onClick=\{turn\} aria-pressed=\{flipped\}>/);
  });

  it('moves the ticket’s own light, and gives the export back at rest', () => {
    // The shine is the gold gradients themselves sliding, never a band laid over the art.
    expect(ticket).toMatch(/g\.setAttribute\('gradientTransform', `translate\(\$\{dx\} \$\{dy\}\)/);
    expect(ticket, 'at rest the export’s own value comes back').toMatch(/if \(now\.shine === 0\)/);
    expect(ticket).not.toMatch(/mix-blend-mode: soft-light|soft-light/);
    // A ticket that glitters forever is a casino, and this page is asking someone for their email.
    expect(css).not.toMatch(/infinite/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(ticket).toMatch(/prefers-reduced-motion: reduce/);
  });

  it('takes every duration from the one ladder, never a number', () => {
    // No duration is typed as a number: every one names a token from the product's ladder.
    const timed = [...(css.match(/(?:animation|transition):[^;]+;/g) ?? [])];
    expect(timed.length).toBeGreaterThan(3);
    for (const d of timed) {
      expect(d, `raw duration in ${d}`).not.toMatch(/\b\d+m?s\b/);
      expect(d, `${d} names no token`).toMatch(/var\(--(duration|site)-|animation: none|transition: none/);
    }
  });
});

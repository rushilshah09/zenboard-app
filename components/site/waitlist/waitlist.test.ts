import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const holder = read('public/site/ticket-holder.svg');
const art = read('public/site/ticket-card.svg');
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
    // The holder's box is 2000 × 1296.322. At 420px wide, using 1.58 leaves ~2px of black showing.
    expect(holder).toMatch(/viewBox="500 851\.678 2000 1296\.322"/);
    // The card is cropped to its OWN bounds, so a mesh of that shape maps the texture 1:1.
    expect(art).toMatch(/viewBox="594\.149 942\.205 1810\.5 1116\.48"/);
    expect(ticket).toMatch(/export const TICKET_RATIO = 2000 \/ 1296\.322;/);
    expect(css).toMatch(/aspect-ratio: 2000 \/ 1296\.322;/);
  });

  it('draws its grain rather than shipping 1.5 MB of it', () => {
    // Figma embedded the brushed texture as a 1024px noise PNG — 1.5 MB of the export's 2.1 MB, for
    // uniform grey grain. feTurbulence makes the same grain for nothing, which is how the Paper skin
    // draws its stock (theme-paper.css: "a theme never waits on a network request").
    expect(art).toMatch(/<feTurbulence type="fractalNoise"/);
    expect(art, 'no embedded raster survived the extraction').not.toMatch(/base64/);
    expect(art, 'and nothing reaches out over the network').not.toMatch(/xlink:href="http/);
    for (const f of ['public/site/ticket-card.svg', 'public/site/ticket-holder.svg']) {
      expect(read(f), `${f} embeds a raster`).not.toMatch(/base64/);
      const kb = statSync(join(root, f)).size / 1024;
      expect(kb, `${f} is ${kb.toFixed(0)} KB`).toBeLessThan(120);
    }
  });

  it('takes the NUMBER out of the drawing, because it is the part that differs', () => {
    expect(art, 'no baked-in number').not.toMatch(/<text/);
    expect(ticket).toMatch(/className="zb-ticket-number tabular-nums"/);
    // Positioned from the export's own coordinates, so it lands where Figma set it: the number's
    // right edge at 88.23% and its BASELINE at 82.75% of the cropped box.
    // Positioned as shares of the CARD's own box, so they travel with it when it slides out.
    expect(css).toMatch(/right: 7\.74%;/);
    expect(css).toMatch(/top: 87\.98%;/);
    expect(css).toMatch(/font-size: 2\.513cqw;/);
  });

  it('is one object to a screen reader, and its parts are decoration', () => {
    expect(ticket).toMatch(/role="img"/);
    expect(ticket).toMatch(/Zenboard waitlist ticket for \$\{name\}, number/);
    expect(ticket).toMatch(/Zenboard waitlist ticket, number/);
    // The layer holding the print is hidden as a whole, so its parts are not announced one by one.
    expect(ticket).toMatch(/<span aria-hidden className="zb-ticket-card">/);
    expect(ticket).toMatch(/<img src=\{TICKET_HOLDER\} alt="" aria-hidden/);
  });

  it('catches the light once, and never loops', () => {
    // A ticket that glitters forever is a casino, and this page is asking someone for their email.
    expect(css).not.toMatch(/infinite/);
    // Both sweeps end OFF the face AND invisible: a band parked inside the right edge sits there as
    // a pale rectangle for the life of the page, which is exactly what the first version did.
    for (const name of ['zb-ticket-sweep', 'zb-ticket-sweep-again']) {
      const frames = css.match(new RegExp(`@keyframes ${name} \\{[^}]*\\}[^}]*\\}`));
      expect(frames?.[0], name).toMatch(/to\s*\{[^}]*opacity: 0/);
    }
    // The hover sweep has a DIFFERENT name on purpose: re-applying the same animation never restarts it.
    expect(css).toMatch(/\.zb-ticket:hover \.zb-ticket-sheen::after \{\s*animation: zb-ticket-sweep-again/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
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

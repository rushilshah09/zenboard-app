import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// The client's two actions in the portal — sign a proposal, reply to the team —
// were DISABLED until the client had typed. The DS gives every disabled button a
// pale wash (`bg-surface-disabled` + `ink-300`), measured 1.74:1 in light and
// 1.20:1 in dark on the portal card, so the one action on the page read as
// absent to anyone who had not typed yet. WCAG exempts disabled controls from
// contrast, so a contrast pass is the wrong instrument: this is discoverability.
// They stay pressable and validate on press — which the accept block had been
// built to do all along (`validateSignerName` + a role="alert" line).
const accept = readFileSync('components/documents/accept-block.tsx', 'utf8');
const portal = readFileSync('components/portal/portal-document.tsx', 'utf8');

describe("the client's primary actions stay visible", () => {
  it('Accept is disabled only where signing is impossible or already in flight', () => {
    expect(accept).toMatch(/disabled=\{!canSign \|\| busy\}/);
    expect(accept, 'never for a missing name').not.toMatch(/disabled=\{[^}]*name\.trim\(\)/);
  });

  it('and pressing it validates the name out loud', () => {
    expect(accept).toMatch(/const checked = validateSignerName\(name\)/);
    expect(accept).toMatch(/role="alert"/);
  });

  it('Reply is disabled only while a send is in flight', () => {
    expect(portal).toMatch(/disabled=\{sending\}/);
    expect(portal, 'never for an empty message').not.toMatch(/disabled=\{[^}]*reply\.trim\(\)/);
  });

  it('every way out of send() says something', () => {
    // Verified in the browser first: pressing Reply on the preview did nothing
    // at all, because `if (preview || !token) return` sat ABOVE the nudge. Four
    // silent exits — empty, preview, no token, server refusal.
    const body = portal.slice(portal.indexOf('async function send()'), portal.indexOf('\n  }', portal.indexOf('async function send()')));
    const silent = body.split('\n').filter((l) => /\breturn;/.test(l) && !/setHint\(/.test(l));
    expect(silent, `these exits say nothing:\n${silent.join('\n')}`).toEqual([]);
    expect(body).toMatch(/setHint\(\{ text: 'Write a reply first\.', field: true \}\)/);
    expect(body, 'the preview explains itself').toMatch(/preview\) \{ setHint\(/);
    expect(body, 'a link with no token explains itself').toMatch(/!token\) \{ setHint\(/);
    expect(body, "and the server's own refusal reaches the client").toMatch(/'error' in res\) \{ setHint\(\{ text: res\.error \}\)/);
  });

  it('and an empty reply says so, and puts the cursor where the words go', () => {
    expect(portal).toMatch(/setHint\(\{ text: 'Write a reply first\.', field: true \}\); document\.getElementById\(replyId\)\?\.focus\(\)/);
    expect(portal).toMatch(/\{hint && <p role="alert"/);
    // Only a FIELD hint marks the textarea invalid: a red box around text that is
    // perfectly fine (the link cannot send) tells a screen reader the wrong thing.
    expect(portal).toMatch(/aria-invalid=\{!!hint\?\.field\}/);
  });
});

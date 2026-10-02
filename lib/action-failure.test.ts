import { describe, it, expect } from 'vitest';
// Next's REAL error class and detector, not a look-alike: the stale-deployment
// branch is only worth anything if it recognises what Next actually throws.
import {
  UnrecognizedActionError,
  unstable_isUnrecognizedActionError,
} from 'next/dist/client/components/unrecognized-action-error';
import { classifyRejection, FAILURE_COPY } from './action-failure';

const classify = (reason: unknown) =>
  classifyRejection(reason, { isStaleDeployment: unstable_isUnrecognizedActionError });

/** What Next hands the client when a server action throws. */
const fromServer = (message = 'Not authenticated') =>
  Object.assign(new Error(message), { digest: '2847362910' });

describe('which failure an unhandled rejection is', () => {
  it('an action that threw on the server — the expired-session case', () => {
    expect(classify(fromServer())).toBe('server');
  });

  // The case the first net missed: no digest at all, so it fell through silently
  // on every edit made in a tab left open across a deploy.
  it('a tab from an older deployment than the server', () => {
    const stale = new UnrecognizedActionError('Server Action "abc123" was not found on the server.');
    expect((stale as { digest?: unknown }).digest).toBeUndefined();
    expect(classify(stale)).toBe('stale');
  });

  it('prefers stale over server if both signals are ever present', () => {
    const both = Object.assign(new UnrecognizedActionError('gone'), { digest: '1' });
    expect(classify(both)).toBe('stale');
  });

  it('a request that never arrived, in every engine’s wording', () => {
    for (const message of [
      'Failed to fetch',                                    // Chrome
      'NetworkError when attempting to fetch resource.',    // Firefox
      'Load failed',                                        // Safari
      'The network connection was lost.',                   // Safari
    ]) {
      expect(classify(new TypeError(message)), message).toBe('unreachable');
    }
  });
});

describe('what the net must stay silent about', () => {
  // A bug's TypeError is not a network failure. Saying "that didn't save" about
  // it would be a lie of its own.
  it('an ordinary TypeError from a bug', () => {
    expect(classify(new TypeError('Cannot read properties of undefined (reading "id")'))).toBeNull();
  });

  it('an error that never crossed the server boundary', () => {
    expect(classify(new Error('Something local'))).toBeNull();
  });

  it('a digest that is not a string', () => {
    expect(classify(Object.assign(new Error('x'), { digest: 42 }))).toBeNull();
  });

  it('things that are not errors at all', () => {
    for (const reason of [undefined, null, 'Failed to fetch', { digest: 'abc' }, 7]) {
      expect(classify(reason)).toBeNull();
    }
  });

  // "load failed" must be the whole message, or any error mentioning a failed
  // load would be read as the network.
  it('a message that merely contains Safari’s wording', () => {
    expect(classify(new TypeError('Image load failed because the id was null'))).toBeNull();
  });
});

describe('what each failure says', () => {
  it('is one sentence-case line per kind, and none claims a revert it did not do', () => {
    for (const copy of Object.values(FAILURE_COPY)) {
      expect(copy[0]).toBe(copy[0].toUpperCase());
      expect(copy.length).toBeLessThanOrEqual(60);        // one line in a 360px toast
      expect(copy).not.toMatch(/undone/i);                // nothing here knows which edit to undo
    }
  });
});

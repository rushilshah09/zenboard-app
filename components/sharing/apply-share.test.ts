import { describe, it, expect, vi } from 'vitest';
import { applyShare } from './apply-share';

describe('applyShare', () => {
  it('keeps the optimistic mark when the write succeeds', async () => {
    const revert = vi.fn(), onError = vi.fn();
    await expect(applyShare(async () => ({ ok: true }), revert, onError)).resolves.toBe(true);
    expect(revert).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('reverts on a returned error and says why', async () => {
    const revert = vi.fn(), onError = vi.fn();
    await expect(applyShare(async () => ({ error: 'row not found' }), revert, onError)).resolves.toBe(false);
    expect(revert).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith('row not found');
  });

  it('ALSO reverts when the action THROWS', async () => {
    // THE BUG THIS PREVENTS: `requireSession()` throws on an expired session,
    // and a bare `await` leaves the chip reading "Client" for a row the
    // database never marked — the app telling you a client can see something
    // that nobody shared.
    const revert = vi.fn(), onError = vi.fn();
    await expect(applyShare(async () => { throw new Error('Not authenticated'); }, revert, onError)).resolves.toBe(false);
    expect(revert).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('connection'));
  });

  it('never leaks the raw throw to the person reading it', async () => {
    // "Not authenticated" is a stack-trace sentence. What the reader needs is
    // that the change did not stick.
    const onError = vi.fn();
    await applyShare(async () => { throw new Error('TypeError: fetch failed'); }, () => {}, onError);
    expect(onError.mock.calls[0][0]).not.toContain('TypeError');
  });
});

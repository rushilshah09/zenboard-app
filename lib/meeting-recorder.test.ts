import { describe, expect, it } from 'vitest';

import { CUT_SILENCE_SECONDS, MAX_CHUNK_SECONDS, MIN_CHUNK_SECONDS, shouldCut } from './meeting-recorder';
import { MAX_CHUNK_SECONDS as SERVER_MAX } from './ai/transcribe';

// The recorder's one decision, every tenth of a second: end this piece now? Whole sentences reach
// the recogniser, and the transcript keeps pace with the talk.
describe('where a piece of the meeting ends', () => {
  it('waits for a pause once the piece is long enough to be worth sending', () => {
    expect(shouldCut(MIN_CHUNK_SECONDS - 0.1, 5)).toBe(false);
    expect(shouldCut(MIN_CHUNK_SECONDS, CUT_SILENCE_SECONDS - 0.1)).toBe(false);
    expect(shouldCut(MIN_CHUNK_SECONDS, CUT_SILENCE_SECONDS)).toBe(true);
  });

  it('cuts at the limit even mid-sentence, so a monologue still arrives', () => {
    expect(shouldCut(MAX_CHUNK_SECONDS, 0)).toBe(true);
    expect(shouldCut(MAX_CHUNK_SECONDS - 0.1, 0)).toBe(false);
  });

  it('never makes a piece the server would refuse', () => {
    expect(MAX_CHUNK_SECONDS).toBeLessThan(SERVER_MAX);
  });
});

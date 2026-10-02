import { describe, expect, it } from 'vitest';

import {
  ENERGY_STEP_MS, MAX_SEGMENTS, SPEECH_RMS, formatStamp, mergeSegments, placeSegments, retryableProblem,
  speakerFor, speakingLevel, transcriptSchema, transcriptText, turns, vocabularyPrompt,
  type EnergyTimeline, type TranscriptSegment,
} from './meeting-transcript';

const PER_SECOND = 1000 / ENERGY_STEP_MS;

/** A timeline built from stretches: [seconds, me level, them level]. */
function timeline(stretches: [number, number, number][], call = true): EnergyTimeline {
  const me: number[] = [];
  const them: number[] = [];
  for (const [secs, m, t] of stretches) {
    for (let i = 0; i < secs * PER_SECOND; i++) { me.push(m); them.push(t); }
  }
  return { me, them: call ? them : null };
}

describe('who spoke, measured from the two channels', () => {
  it('gives a stretch to the channel that carried it', () => {
    // 0–3 s I talk into the mic; 3–6 s the client talks on the call.
    const e = timeline([[3, 0.2, 0.001], [3, 0.004, 0.3]]);
    expect(speakerFor(0, 3, e)).toBe('me');
    expect(speakerFor(3, 6, e)).toBe('them');
  });

  it('is not fooled by the call leaking into the microphone', () => {
    // On laptop speakers the mic hears the client too — real energy, but quiet next to me at the
    // mic. Judged against each channel's own speaking level, the client still owns their stretch.
    const e = timeline([[4, 0.25, 0.0], [4, 0.06, 0.3]]);
    expect(speakerFor(4, 8, e)).toBe('them');
    expect(speakerFor(0, 4, e)).toBe('me');
  });

  it('says nothing when only the microphone was recorded, or nobody was speaking', () => {
    expect(speakerFor(0, 3, timeline([[3, 0.2, 0]], false))).toBeNull();
    expect(speakerFor(0, 3, timeline([[3, 0.001, 0.002]]))).toBeNull();
  });

  it('sets each channel’s scale by how loud it gets when someone is talking, not by a cough', () => {
    const quiet = Array.from({ length: 100 }, () => 0.001);
    expect(speakingLevel(quiet)).toBe(SPEECH_RMS);
    const talk = [...quiet, ...Array.from({ length: 50 }, (_, i) => 0.1 + i * 0.001), 0.9];
    expect(speakingLevel(talk)).toBeGreaterThan(0.1);
    expect(speakingLevel(talk)).toBeLessThan(0.9);
  });
});

describe('placing a piece on the meeting’s clock', () => {
  it('offsets the transcriber’s times by where the piece began, and attributes from the piece’s own readings', () => {
    const piece = timeline([[2, 0.2, 0.0], [2, 0.003, 0.25]]);
    const out = placeSegments(
      [{ start: 0, end: 1.9, text: ' I will send the palettes. ' }, { start: 2.1, end: 3.8, text: 'Great, thanks.' }, { start: 3.8, end: 4, text: '  ' }],
      120, piece, (i) => `c1-${i}`,
    );
    expect(out).toEqual([
      { id: 'c1-0', start: 120, end: 121.9, speaker: 'me', text: 'I will send the palettes.' },
      { id: 'c1-1', start: 122.1, end: 123.8, speaker: 'them', text: 'Great, thanks.' },
    ]);
  });

  it('never lets a transcriber move time backwards', () => {
    const [s] = placeSegments([{ start: 3, end: 1, text: 'x' }], 10, timeline([[4, 0.2, 0]], false), () => 'a');
    expect(s.end).toBeGreaterThanOrEqual(s.start);
  });
});

describe('merging pieces into one transcript', () => {
  const seg = (start: number, text: string, speaker: TranscriptSegment['speaker'] = 'me'): TranscriptSegment =>
    ({ id: `${start}`, start, end: start + 2, speaker, text });

  it('keeps time order when pieces come back out of order', () => {
    const merged = mergeSegments([seg(10, 'b')], [seg(0, 'a'), seg(20, 'c')]);
    expect(merged.map((s) => s.text)).toEqual(['a', 'b', 'c']);
  });

  it('does not add a piece twice when a retry’s first answer arrives late', () => {
    const once = mergeSegments([], [seg(5, 'hello')]);
    expect(mergeSegments(once, [seg(5.04, 'hello')])).toBe(once);
  });
});

describe('reading a transcript', () => {
  const segs: TranscriptSegment[] = [
    { id: '1', start: 0, end: 3, speaker: 'them', text: 'We loved the moodboard.' },
    { id: '2', start: 3.2, end: 5, speaker: 'them', text: 'But the green is too corporate.' },
    { id: '3', start: 5.5, end: 9, speaker: 'me', text: 'I’ll send two palettes by Thursday.' },
    { id: '4', start: 30, end: 33, speaker: 'me', text: 'Anything else?' },
  ];

  it('groups a speaker’s consecutive sentences into turns, and a long pause starts a new one', () => {
    expect(turns(segs).map((t) => [t.speaker, t.segments.length])).toEqual([['them', 2], ['me', 1], ['me', 1]]);
  });

  it('reads as Me: and Them: — the labels the clerk already uses to tell mine from theirs', () => {
    expect(transcriptText(segs)).toBe(
      'Them: We loved the moodboard. But the green is too corporate.\nMe: I’ll send two palettes by Thursday.\nMe: Anything else?',
    );
    expect(transcriptText([{ ...segs[0], speaker: null }])).toBe('We loved the moodboard.');
  });

  it('writes positions the way players do', () => {
    expect(formatStamp(0)).toBe('0:00');
    expect(formatStamp(65.9)).toBe('1:05');
    expect(formatStamp(3723)).toBe('1:02:03');
  });
});

describe('what may be saved', () => {
  it('accepts a real transcript and refuses one that is not', () => {
    expect(transcriptSchema.safeParse([{ id: 'a', start: 0, end: 1, speaker: 'me', text: 'hi' }]).success).toBe(true);
    expect(transcriptSchema.safeParse([{ id: 'a', start: 0, end: 1, speaker: 'boss', text: 'hi' }]).success).toBe(false);
    expect(transcriptSchema.safeParse([{ id: 'a', start: -1, end: 1, speaker: null, text: 'hi' }]).success).toBe(false);
    expect(transcriptSchema.safeParse([{ id: 'a', start: 0, end: 1, speaker: null, text: '' }]).success).toBe(false);
    const huge = Array.from({ length: MAX_SEGMENTS + 1 }, (_, i) => ({ id: `${i}`, start: i, end: i + 1, speaker: null, text: 'x' }));
    expect(transcriptSchema.safeParse(huge).success).toBe(false);
  });
});

describe('the vocabulary the recogniser is handed', () => {
  it('names the meeting, the client and their projects in one short sentence', () => {
    expect(vocabularyPrompt({ title: 'Brand refresh kickoff', client: 'Meridian Coffee', projects: ['Brand refresh', 'Menu board'] }))
      .toBe('Brand refresh kickoff with Meridian Coffee about Brand refresh, Menu board.');
  });

  it('leaves out what it does not know, and says nothing rather than something empty', () => {
    expect(vocabularyPrompt({ title: 'Meeting', client: null })).toBeUndefined();
    expect(vocabularyPrompt({ client: 'Atlas' })).toBe('with Atlas.');
    expect((vocabularyPrompt({ title: 'x'.repeat(400) }) ?? '').length).toBeLessThanOrEqual(221);
  });
});

describe('what a failed piece does next', () => {
  it('tries again only where waiting can help', () => {
    expect(['unavailable', 'invalid', 'offline'].every((p) => retryableProblem(p as never))).toBe(true);
    expect(['limit', 'auth', 'missing', 'format', 'too-long', 'empty', 'forbidden', 'migration'].some((p) => retryableProblem(p as never))).toBe(false);
  });
});

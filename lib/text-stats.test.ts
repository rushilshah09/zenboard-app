import { describe, it, expect } from 'vitest';
import { textStats, readingSeconds, speakingSeconds, formatDuration } from './text-stats';

describe('textStats', () => {
  it('counts a simple sentence', () => {
    const s = textStats('Hello world.');
    expect(s.words).toBe(2);
    expect(s.characters).toBe(12);
    expect(s.sentences).toBe(1);
    expect(s.paragraphs).toBe(1);
  });

  it('counts sentences by terminal punctuation, including ! and ?', () => {
    expect(textStats('One. Two! Three?').sentences).toBe(3);
  });

  // The bug this guards: a writer mid-sentence should never read "0 sentences".
  it('counts a trailing sentence with no full stop', () => {
    expect(textStats('No terminator here').sentences).toBe(1);
  });

  it('excludes line breaks from the character count but keeps spaces', () => {
    // "ab" + "cd" = 4 chars, newline not counted
    expect(textStats('ab\ncd').characters).toBe(4);
    expect(textStats('a b').characters).toBe(3);
  });

  it('counts only non-empty lines as paragraphs', () => {
    expect(textStats('One\n\nTwo\n   \nThree').paragraphs).toBe(3);
  });

  it('is all zeros for empty input', () => {
    expect(textStats('')).toEqual({ characters: 0, words: 0, sentences: 0, paragraphs: 0 });
  });

  it('does not count whitespace-only text as a word or sentence', () => {
    const s = textStats('   \n  ');
    expect(s.words).toBe(0);
    expect(s.sentences).toBe(0);
    expect(s.paragraphs).toBe(0);
  });
});

describe('reading and speaking time', () => {
  it('reads faster than it speaks', () => {
    expect(readingSeconds(500)).toBeLessThan(speakingSeconds(500));
  });

  it('matches the expected rates', () => {
    expect(readingSeconds(200)).toBe(60);   // 200 wpm
    expect(speakingSeconds(130)).toBe(60);  // 130 wpm
  });
});

describe('formatDuration', () => {
  it('shows seconds under a minute, never "0 sec"', () => {
    expect(formatDuration(23)).toBe('23 sec');
    expect(formatDuration(0)).toBe('1 sec');
  });

  it('shows whole minutes', () => {
    expect(formatDuration(180)).toBe('3 min');
  });

  it('shows hours and minutes past an hour', () => {
    expect(formatDuration(3600)).toBe('1 hr');
    expect(formatDuration(3900)).toBe('1 hr 5 min');
  });
});

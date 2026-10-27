import { describe, expect, it } from 'vitest';
import { levelsConfig } from '../content/levelsConfig.ts';
import { readTimeS, wordCount } from './readTime.ts';

// DECISIONS 2026-10-26 (10): a pop-up or caption is on screen for 1.0 s + 0.3 s per word, between 1.5 s and 4.0 s.

describe('the reading time of a pop-up or caption', () => {
  it('holds the decided values', () => {
    expect(levelsConfig.readTime).toEqual({ baseS: 1.0, perWordS: 0.3, minS: 1.5, maxS: 4.0 });
  });

  it('counts words between spaces; symbols standing alone count as words', () => {
    expect(wordCount('Ice: your grip is only 307 N')).toBe(7);
    expect(wordCount('  two   words ')).toBe(2);
    expect(wordCount('')).toBe(0);
  });

  it('is 1.0 + 0.3 per word: 8 words stay 3.4 s (DECISIONS 2026-10-26 (10))', () => {
    expect(readTimeS('one two three four five six seven eight')).toBeCloseTo(3.4, 12);
    expect(readTimeS('one two three four five')).toBeCloseTo(2.5, 12);
  });

  it('is never under 1.5 s', () => {
    expect(readTimeS('Crash')).toBe(1.5);
    expect(readTimeS('')).toBe(1.5);
    expect(readTimeS('one two')).toBe(1.6); // 1.0 + 0.6 is already over the floor
  });

  it('is never over 4.0 s', () => {
    expect(readTimeS(Array.from({ length: 40 }, () => 'word').join(' '))).toBe(4);
    expect(readTimeS(Array.from({ length: 10 }, () => 'word').join(' '))).toBe(4); // 1.0 + 3.0 = 4.0 exactly
  });
});

import { describe, expect, it } from 'vitest';
import { levelsConfig } from '../content/levelsConfig.ts';
import { currentCaption, emptyQueue, enqueueCaption, MAX_WAITING_CAPTIONS, tickCaptions, type CaptionQueue } from './captionQueue.ts';

const MIN = levelsConfig.captions.minShowS; // 2.5 s (A4)
const cap = (key: string, durationS = 4) => ({ key, title: `title ${key}`, line: `line ${key}`, durationS });
const titleAt = (q: CaptionQueue) => currentCaption(q)?.title ?? null;

describe('caption queue (LEVELS_BUILD_PLAN A4: one caption at a time, queued, at least 2.5 s each)', () => {
  it('shows nothing when empty', () => {
    expect(currentCaption(emptyQueue)).toBeNull();
    expect(currentCaption(tickCaptions(emptyQueue, 10))).toBeNull();
  });

  it('shows the first caption at once, with a title and one line (two lines at most)', () => {
    const q = enqueueCaption(emptyQueue, cap('a'), 1);
    expect(currentCaption(q)).toEqual({ title: 'title a', line: 'line a' });
  });

  it('shows only one caption at a time: a second waits', () => {
    let q = enqueueCaption(emptyQueue, cap('a'), 0);
    q = enqueueCaption(q, cap('b'), 0.5);
    expect(titleAt(q)).toBe('title a');
    expect(titleAt(tickCaptions(q, 1))).toBe('title a');
  });

  it('never cuts a caption before 2.5 s, then moves to the next at once', () => {
    let q = enqueueCaption(emptyQueue, cap('a'), 0);
    q = enqueueCaption(q, cap('b'), 0.1);
    expect(titleAt(tickCaptions(q, MIN - 0.001))).toBe('title a');
    expect(titleAt(tickCaptions(q, MIN))).toBe('title b');
  });

  it('a caption alone stays for its own duration, then goes', () => {
    const q = enqueueCaption(emptyQueue, cap('a', 4), 0);
    expect(titleAt(tickCaptions(q, 3.999))).toBe('title a');
    expect(currentCaption(tickCaptions(q, 4))).toBeNull();
  });

  it('a duration shorter than 2.5 s is raised to 2.5 s', () => {
    const q = enqueueCaption(emptyQueue, cap('a', 1), 0);
    expect(titleAt(tickCaptions(q, 2.4))).toBe('title a');
    expect(currentCaption(tickCaptions(q, MIN))).toBeNull();
  });

  it('the next caption starts its own clock when it appears, so it also gets at least 2.5 s', () => {
    let q = enqueueCaption(emptyQueue, cap('a'), 0);
    q = enqueueCaption(q, cap('b'), 0);
    q = enqueueCaption(q, cap('c'), 0);
    q = tickCaptions(q, MIN); // b appears at 2.5
    expect(titleAt(q)).toBe('title b');
    expect(titleAt(tickCaptions(q, MIN + MIN - 0.01))).toBe('title b');
    expect(titleAt(tickCaptions(q, MIN + MIN))).toBe('title c');
  });

  it('keeps the order they arrived in', () => {
    let q = enqueueCaption(emptyQueue, cap('a'), 0);
    q = enqueueCaption(q, cap('b'), 0.1);
    q = enqueueCaption(q, cap('c'), 0.2);
    const seen: string[] = [];
    for (let t = 0; t <= 20; t += 0.1) {
      q = tickCaptions(q, t);
      const title = titleAt(q);
      if (title && seen[seen.length - 1] !== title) seen.push(title);
    }
    expect(seen).toEqual(['title a', 'title b', 'title c']);
  });

  it('merges a caption with the same key into the one showing, and restarts its clock', () => {
    let q = enqueueCaption(emptyQueue, { ...cap('slip'), title: 'Wheels slipping ×1' }, 0);
    q = enqueueCaption(q, { ...cap('slip'), title: 'Wheels slipping ×2' }, 3);
    expect(titleAt(q)).toBe('Wheels slipping ×2');
    expect(titleAt(tickCaptions(q, 6.9))).toBe('Wheels slipping ×2'); // 3 + 4 s
    expect(currentCaption(tickCaptions(q, 7))).toBeNull();
  });

  it('merges a caption with the same key as the last one waiting', () => {
    let q = enqueueCaption(emptyQueue, cap('a'), 0);
    q = enqueueCaption(q, { ...cap('b'), title: 'b1' }, 0.1);
    q = enqueueCaption(q, { ...cap('b'), title: 'b2' }, 0.2);
    expect(q.waiting).toHaveLength(1);
    expect(titleAt(tickCaptions(q, MIN))).toBe('b2');
  });

  it(`keeps at most ${MAX_WAITING_CAPTIONS} waiting, dropping the oldest, so a flood never shows stale news`, () => {
    let q = enqueueCaption(emptyQueue, cap('now'), 0);
    for (let i = 0; i < MAX_WAITING_CAPTIONS + 3; i++) q = enqueueCaption(q, cap(`w${i}`), 0.1);
    expect(q.waiting).toHaveLength(MAX_WAITING_CAPTIONS);
    expect(q.waiting[0]!.key).toBe('w3');
    expect(q.waiting[q.waiting.length - 1]!.key).toBe(`w${MAX_WAITING_CAPTIONS + 2}`);
  });

  it('does not change the queue it is given', () => {
    const q = enqueueCaption(emptyQueue, cap('a'), 0);
    const frozen = JSON.stringify(q);
    enqueueCaption(q, cap('b'), 1);
    tickCaptions(q, 10);
    expect(JSON.stringify(q)).toBe(frozen);
  });
});

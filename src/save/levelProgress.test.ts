import { describe, expect, it } from 'vitest';
import {
  emptyLevelProgress,
  isFinished,
  LEVEL_PROGRESS_STORAGE_KEY,
  loadLevelProgress,
  recordLevelResult,
  saveLevelProgress,
  starsOf,
  totalStars,
  type StorageLike,
} from './levelProgress.ts';

function fakeStorage(initial?: string): StorageLike {
  const data = new Map<string, string>(initial === undefined ? [] : [[LEVEL_PROGRESS_STORAGE_KEY, initial]]);
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('level progress (A2: only the best stars and time per level are saved)', () => {
  it('starts empty', () => {
    const p = emptyLevelProgress();
    expect(isFinished(p, 'first-tracks')).toBe(false);
    expect(starsOf(p, 'first-tracks')).toBe(0);
    expect(totalStars(p)).toBe(0);
  });

  it('records a first finish', () => {
    const p = recordLevelResult(emptyLevelProgress(), 'first-tracks', { stars: 2, timeS: 101.5 });
    expect(isFinished(p, 'first-tracks')).toBe(true);
    expect(starsOf(p, 'first-tracks')).toBe(2);
    expect(p.levels['first-tracks']).toEqual({ stars: 2, bestTimeS: 101.5 });
  });

  it('keeps the best stars and the best time, each on its own', () => {
    let p = recordLevelResult(emptyLevelProgress(), 'a', { stars: 3, timeS: 120 });
    p = recordLevelResult(p, 'a', { stars: 1, timeS: 100 }); // faster, fewer stars
    expect(p.levels.a).toEqual({ stars: 3, bestTimeS: 100 });
    p = recordLevelResult(p, 'a', { stars: 2, timeS: 130 }); // worse in both
    expect(p.levels.a).toEqual({ stars: 3, bestTimeS: 100 });
  });

  it('ignores a run that did not finish (0 stars), so it never opens the next level', () => {
    const p = recordLevelResult(emptyLevelProgress(), 'a', { stars: 0, timeS: 50 });
    expect(isFinished(p, 'a')).toBe(false);
    expect(p.levels).toEqual({});
  });

  it('does not change the object it is given', () => {
    const before = emptyLevelProgress();
    recordLevelResult(before, 'a', { stars: 1, timeS: 10 });
    expect(before.levels).toEqual({});
  });

  it('adds up the stars', () => {
    let p = recordLevelResult(emptyLevelProgress(), 'a', { stars: 3, timeS: 10 });
    p = recordLevelResult(p, 'b', { stars: 1, timeS: 10 });
    expect(totalStars(p)).toBe(4);
  });

  it('survives a reload: save then load gives the same data', () => {
    const storage = fakeStorage();
    const p = recordLevelResult(emptyLevelProgress(), 'ring-road', { stars: 2, timeS: 143.25 });
    expect(saveLevelProgress(p, storage)).toBe(true);
    expect(loadLevelProgress(storage)).toEqual(p);
  });

  it('loads the good levels and drops the bad ones', () => {
    const text = JSON.stringify({
      levels: {
        good: { stars: 2, bestTimeS: 90 },
        tooMany: { stars: 4, bestTimeS: 90 },
        noTime: { stars: 1, bestTimeS: -3 },
        junk: 'x',
      },
    });
    const p = loadLevelProgress(fakeStorage(text));
    expect(Object.keys(p.levels)).toEqual(['good']);
  });

  it('falls back to empty on broken data or throwing storage', () => {
    expect(loadLevelProgress(fakeStorage('nope'))).toEqual(emptyLevelProgress());
    expect(loadLevelProgress(undefined)).toEqual(emptyLevelProgress());
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
    };
    expect(loadLevelProgress(throwing)).toEqual(emptyLevelProgress());
    expect(saveLevelProgress(emptyLevelProgress(), throwing)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { levelCards } from '../content/levelCards.ts';
import { emptyLevelProgress, recordLevelResult } from '../save/levelProgress.ts';
import {
  continueTarget,
  developerUnlockFromSearch,
  isEndlessUnlocked,
  isLevelUnlocked,
  levelSummaries,
  nextLevelId,
} from './levelUnlock.ts';

const ids = levelCards.levels.map((l) => l.id);
const finish = (p: ReturnType<typeof emptyLevelProgress>, id: string, stars: 1 | 2 | 3 = 1) => recordLevelResult(p, id, { stars, timeS: 100 });

describe('level unlocking (LEVELS_BUILD_PLAN A2)', () => {
  it('opens only the first level on a fresh save', () => {
    const p = emptyLevelProgress();
    expect(isLevelUnlocked(ids, 0, p, false)).toBe(true);
    for (let i = 1; i < ids.length; i++) expect(isLevelUnlocked(ids, i, p, false)).toBe(false);
  });

  it('finishing a level opens the next one, and only the next one', () => {
    const p = finish(emptyLevelProgress(), ids[0]!);
    expect(isLevelUnlocked(ids, 1, p, false)).toBe(true);
    expect(isLevelUnlocked(ids, 2, p, false)).toBe(false);
  });

  it('a run that did not finish (0 stars) opens nothing', () => {
    const p = recordLevelResult(emptyLevelProgress(), ids[0]!, { stars: 0, timeS: 30 });
    expect(isLevelUnlocked(ids, 1, p, false)).toBe(false);
  });

  it('keeps a level open after a worse replay (the best is kept)', () => {
    let p = finish(emptyLevelProgress(), ids[0]!, 3);
    p = recordLevelResult(p, ids[0]!, { stars: 0, timeS: 10 });
    expect(isLevelUnlocked(ids, 1, p, false)).toBe(true);
  });

  it('a level out of range is locked', () => {
    expect(isLevelUnlocked(ids, ids.length, emptyLevelProgress(), false)).toBe(false);
    expect(isLevelUnlocked(ids, -1, emptyLevelProgress(), false)).toBe(false);
  });

  it('opens Endless after Crash Site, not before', () => {
    expect(isEndlessUnlocked(ids, emptyLevelProgress(), false)).toBe(false);
    expect(isEndlessUnlocked(ids, finish(emptyLevelProgress(), ids[1]!), false)).toBe(false); // level 2 alone does not do it
    expect(isEndlessUnlocked(ids, finish(emptyLevelProgress(), ids[0]!), false)).toBe(true);
  });

  it('the developer link opens every level and Endless without any progress', () => {
    const p = emptyLevelProgress();
    for (let i = 0; i < ids.length; i++) expect(isLevelUnlocked(ids, i, p, true)).toBe(true);
    expect(isEndlessUnlocked(ids, p, true)).toBe(true);
  });

  it('reads the developer link from the address and nothing else', () => {
    expect(developerUnlockFromSearch('?unlock=all')).toBe(true);
    expect(developerUnlockFromSearch('?a=1&unlock=all')).toBe(true);
    expect(developerUnlockFromSearch('unlock=all')).toBe(true);
    expect(developerUnlockFromSearch('')).toBe(false);
    expect(developerUnlockFromSearch('?unlock=none')).toBe(false);
    expect(developerUnlockFromSearch('?unlock')).toBe(false);
    expect(developerUnlockFromSearch('?xunlock=all')).toBe(false);
  });

  it('Continue goes to the first unlocked level that is not finished; none when all are finished', () => {
    let p = emptyLevelProgress();
    expect(continueTarget(ids, p)).toBe(ids[0]);
    p = finish(p, ids[0]!);
    expect(continueTarget(ids, p)).toBe(ids[1]);
    // finishing level 2 first (through the developer link) does not skip level 1's gap... level 1 is finished here
    p = finish(p, ids[1]!);
    expect(continueTarget(ids, p)).toBe(ids[2]);
    for (const id of ids) p = finish(p, id);
    expect(continueTarget(ids, p)).toBeNull();
  });

  it('Continue ignores the developer link: it follows the real progress', () => {
    expect(continueTarget(ids, emptyLevelProgress())).toBe(ids[0]);
  });

  it('nextLevelId gives the level after, or null after the last', () => {
    expect(nextLevelId(ids, ids[0]!)).toBe(ids[1]);
    expect(nextLevelId(ids, ids[ids.length - 1]!)).toBeNull();
    expect(nextLevelId(ids, 'nope')).toBeNull();
  });
});

describe('level summaries for the Levels screen (A3)', () => {
  it('lists number, name, hook, stars, best time and the lock', () => {
    let p = recordLevelResult(emptyLevelProgress(), ids[0]!, { stars: 2, timeS: 97.5 });
    p = finish(p, ids[1]!, 1);
    const rows = levelSummaries(levelCards.levels, p, false);
    expect(rows).toHaveLength(5); // Crash Site replaced First Tracks and Ring Road (R3); Gravity Wells folded into Crater Field (R6)
    expect(rows[0]).toEqual({
      id: ids[0],
      number: 1,
      name: 'Crash Site',
      hook: levelCards.levels[0]!.hook,
      stars: 2,
      bestTimeS: 97.5,
      locked: false,
    });
    expect(rows[2]!.locked).toBe(false); // level 2 finished -> level 3 open
    expect(rows[3]!.locked).toBe(true);
    expect(rows[3]!.stars).toBe(0);
    expect(rows[3]!.bestTimeS).toBeNull();
  });

  it('marks a level with no file as coming soon, even under the developer link', () => {
    const built = new Set(ids.slice(0, 4));
    const rows = levelSummaries(levelCards.levels, emptyLevelProgress(), true, built);
    expect(rows.slice(0, 4).every((r) => r.comingSoon === undefined)).toBe(true);
    expect(rows.slice(4).every((r) => r.comingSoon === true)).toBe(true);
  });

  it('marks nothing locked under the developer link', () => {
    expect(levelSummaries(levelCards.levels, emptyLevelProgress(), true).every((r) => !r.locked)).toBe(true);
  });
});

import type { StarCount } from '../game/contracts.ts';

// Level progress (LEVELS_BUILD_PLAN A2): only the best stars and the best time per level are saved. Every read and
// write is wrapped in try/catch; if storage fails, the game works with an empty record.

export const LEVEL_PROGRESS_STORAGE_KEY = 'rovem.levels.v1';

export interface LevelRecord {
  /** The best star count; 1 or more means the level was finished. */
  stars: StarCount;
  /** The fastest finish, in seconds. */
  bestTimeS: number | null;
}

export interface LevelProgress {
  levels: Record<string, LevelRecord>;
}

export const emptyLevelProgress = (): LevelProgress => ({ levels: {} });

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): StorageLike | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

const isStars = (v: unknown): v is StarCount => v === 0 || v === 1 || v === 2 || v === 3;
const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

export function loadLevelProgress(storage: StorageLike | undefined = defaultStorage()): LevelProgress {
  const out = emptyLevelProgress();
  try {
    const text = storage?.getItem(LEVEL_PROGRESS_STORAGE_KEY);
    if (!text) return out;
    const raw: unknown = JSON.parse(text);
    if (typeof raw !== 'object' || raw === null) return out;
    const levels = (raw as Record<string, unknown>).levels;
    if (typeof levels !== 'object' || levels === null || Array.isArray(levels)) return out;
    for (const [id, value] of Object.entries(levels)) {
      if (typeof value !== 'object' || value === null) continue;
      const r = value as Record<string, unknown>;
      if (!isStars(r.stars)) continue;
      if (r.bestTimeS !== null && !isTime(r.bestTimeS)) continue;
      out.levels[id] = { stars: r.stars, bestTimeS: r.bestTimeS };
    }
  } catch {
    return emptyLevelProgress();
  }
  return out;
}

/** Returns true if the data was saved. */
export function saveLevelProgress(progress: LevelProgress, storage: StorageLike | undefined = defaultStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(LEVEL_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

/**
 * What a finished level changes: the best stars and the fastest time, each kept on its own. A pure function; the
 * caller saves. A run with 0 stars did not finish, so it changes nothing and opens nothing.
 */
export function recordLevelResult(progress: LevelProgress, levelId: string, result: { stars: StarCount; timeS: number }): LevelProgress {
  if (result.stars < 1) return progress;
  const old = progress.levels[levelId];
  const stars = Math.max(old?.stars ?? 0, result.stars) as StarCount;
  const bestTimeS = old?.bestTimeS == null ? result.timeS : Math.min(old.bestTimeS, result.timeS);
  return { levels: { ...progress.levels, [levelId]: { stars, bestTimeS } } };
}

export const isFinished = (progress: LevelProgress, levelId: string): boolean => (progress.levels[levelId]?.stars ?? 0) >= 1;
export const starsOf = (progress: LevelProgress, levelId: string): StarCount => progress.levels[levelId]?.stars ?? 0;
export const totalStars = (progress: LevelProgress): number => Object.values(progress.levels).reduce((n, r) => n + r.stars, 0);

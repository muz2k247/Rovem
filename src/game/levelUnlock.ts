import { levelsConfig } from '../content/levelsConfig.ts';
import type { LevelCard } from '../content/levelCards.ts';
import { isFinished, starsOf, type LevelProgress } from '../save/levelProgress.ts';
import type { LevelSummary } from './contracts.ts';

// Which levels are open (LEVELS_BUILD_PLAN A2). Levels open in order: finishing a level opens the next. Endless opens
// after the first level. The hidden developer link (`?unlock=all`) opens everything; it is read from the address
// each time and is never saved.

/** True when the address carries the developer link, e.g. `?unlock=all`. */
export function developerUnlockFromSearch(search: string, query: string = levelsConfig.developerUnlockQuery): boolean {
  const [key, value] = query.split('=');
  const params = new URLSearchParams(search.replace(/^\?/, ''));
  return params.get(key ?? '') === value;
}

/** A level is open if it is the first, the one before it is finished, or the developer link is on. */
export function isLevelUnlocked(ids: readonly string[], index: number, progress: LevelProgress, developerUnlock: boolean): boolean {
  if (index < 0 || index >= ids.length) return false;
  if (developerUnlock || index === 0) return true;
  return isFinished(progress, ids[index - 1]!);
}

/** Endless opens once the first level is finished. */
export function isEndlessUnlocked(ids: readonly string[], progress: LevelProgress, developerUnlock: boolean): boolean {
  return developerUnlock || (ids[0] !== undefined && isFinished(progress, ids[0]));
}

/** Continue on Home: the first open level that is not finished, from the real progress. Null when all are finished. */
export function continueTarget(ids: readonly string[], progress: LevelProgress): string | null {
  for (let i = 0; i < ids.length; i++) {
    if (!isFinished(progress, ids[i]!)) return isLevelUnlocked(ids, i, progress, false) ? ids[i]! : null;
  }
  return null;
}

/** The level after `id`, or null after the last (or for an unknown id). */
export function nextLevelId(ids: readonly string[], id: string): string | null {
  const i = ids.indexOf(id);
  return i >= 0 && i + 1 < ids.length ? ids[i + 1]! : null;
}

/** The rows of the Levels screen. A level whose id is not in `built` (when given) is marked "coming soon". */
export function levelSummaries(
  levels: readonly LevelCard[],
  progress: LevelProgress,
  developerUnlock: boolean,
  built?: ReadonlySet<string>,
): LevelSummary[] {
  const ids = levels.map((l) => l.id);
  return levels.map((l, i) => ({
    id: l.id,
    number: i + 1,
    name: l.name,
    hook: l.hook,
    stars: starsOf(progress, l.id),
    bestTimeS: progress.levels[l.id]?.bestTimeS ?? null,
    locked: !isLevelUnlocked(ids, i, progress, developerUnlock),
    ...(built && !built.has(l.id) ? { comingSoon: true } : {}),
  }));
}

import type { Content, RunUnlock } from '../../content/index.ts';

// The unlock ladder (docs/DEMO_BUILD_PLAN.md A6): the starting parts are always open; the others open
// when the best distance reaches their step. Nothing is spent, so nothing can drift.

/** Part ids the student can fit now: the starting parts plus every step reached. */
export function unlockedPartIds(content: Content, bestDistanceM: number): string[] {
  const reached = new Set(content.run.unlocks.filter((u) => bestDistanceM >= u.atBestDistanceM).map((u) => u.partId));
  return content.parts.filter((p) => p.startsUnlocked || reached.has(p.id)).map((p) => p.id);
}

/** The next step above the best distance, for "Next part at 400 m"; undefined when everything is open. */
export function nextUnlock(content: Content, bestDistanceM: number): RunUnlock | undefined {
  return content.run.unlocks
    .filter((u) => u.atBestDistanceM > bestDistanceM)
    .sort((a, b) => a.atBestDistanceM - b.atBestDistanceM)[0];
}

/** Parts opened by raising the best distance from `beforeM` to `afterM`, in ladder order. */
export function newlyUnlocked(content: Content, beforeM: number, afterM: number): string[] {
  return content.run.unlocks
    .filter((u) => beforeM < u.atBestDistanceM && afterM >= u.atBestDistanceM)
    .sort((a, b) => a.atBestDistanceM - b.atBestDistanceM)
    .map((u) => u.partId);
}

/** Display only: "chassis" is shown as "body" (A8). `parts.json` keeps its names. */
export function displayPartName(name: string): string {
  return name.replace(/chassis/gi, (m) => (m[0] === 'C' ? 'Body' : 'body'));
}

/** "Unlocks at 400 m best distance", or undefined for a starting part. */
export function unlockText(content: Content, partId: string): string | undefined {
  const step = content.run.unlocks.find((u) => u.partId === partId);
  return step ? `Unlocks at ${step.atBestDistanceM} m best distance` : undefined;
}

import { isFinished, type LevelProgress } from '../save/levelProgress.ts';
import type { ShipPartText } from './level/text.ts';

// The ship on the Levels screen (SHOWCASE_PLAN §12): five parts, one for each level. A part is lit once its level is
// finished; a part whose level is not a Showcase level yet is shown locked. Read from the saved progress each time.

export type ShipPartState = 'recovered' | 'open' | 'locked';

export interface ShipPartView {
  levelId: string;
  name: string;
  state: ShipPartState;
}

export function shipParts(parts: readonly ShipPartText[], progress: LevelProgress): ShipPartView[] {
  return parts.map((p) => ({
    levelId: p.levelId,
    name: p.name,
    state: !p.built ? 'locked' : isFinished(progress, p.levelId) ? 'recovered' : 'open',
  }));
}

/** True once every part is recovered and every part's level is built: the launch ending opens (SHOWCASE_PLAN §12). */
export const launchReady = (views: readonly ShipPartView[]): boolean => views.length > 0 && views.every((v) => v.state === 'recovered');

export const partsRecovered = (views: readonly ShipPartView[]): number => views.filter((v) => v.state === 'recovered').length;

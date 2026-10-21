import { KEY_BINDINGS } from '../controls.ts';

// The keys that only levels use (CLAUDE.md, Controls). The driving keys and R are in `game/controls.ts`; Space is new
// here. One mapping, so they can change in one place.

export const LEVEL_KEYS = {
  /** Flip the rover magnet's pole between N and S. */
  flipPole: ['Space'],
  /** Back to the last checkpoint. */
  respawn: KEY_BINDINGS.restart,
  pause: ['Escape'],
  /** Fire the booster, once per level attempt (SHOWCASE_PLAN §3a). */
  booster: ['ShiftLeft', 'ShiftRight'],
} as const;

export type LevelKeyAction = 'flipPole' | 'respawn' | 'pause' | 'booster';

/** What a key press asks of the level, if anything. Driving keys are not here: the key tracker reads them. */
export function levelKeyAction(code: string): LevelKeyAction | undefined {
  for (const action of ['flipPole', 'respawn', 'pause', 'booster'] as const) {
    if ((LEVEL_KEYS[action] as readonly string[]).includes(code)) return action;
  }
  return undefined;
}

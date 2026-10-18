// The Game v4 screens (LEVELS_BUILD_PLAN A3). Home, Levels, Level intro and Settings have an address of their own; Pause is
// an overlay (`PauseMenu`) and the Report is shown by the run or level that just ended (it needs that run's data), so
// neither has one. The Level screen is Track B's (`LevelScreen.tsx`).
export const HASH_SCREENS = ['home', 'levels', 'levelIntro', 'settings'] as const;
export type HashScreen = (typeof HASH_SCREENS)[number];

/** The screen named by a URL hash like `#levels`, or null. The game opens on Home without one. */
export function screenFromHash(hash: string): HashScreen | null {
  const name = hash.replace(/^#/, '');
  return HASH_SCREENS.find((s) => s === name) ?? null;
}

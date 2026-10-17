// The Game v4 screens (LEVELS_BUILD_PLAN A3). Home, Levels, Level intro and Settings are built (Track A, A1); Pause is
// an overlay (`PauseMenu`) and has no screen of its own; the Report is still a placeholder until A3. The Level
// screen is Track B's (`LevelScreen.tsx`).
export const HASH_SCREENS = ['home', 'levels', 'levelIntro', 'settings', 'report'] as const;
export type HashScreen = (typeof HASH_SCREENS)[number];

/** Screens that still show a plain placeholder. */
export const PLACEHOLDER_SCREENS = ['report'] as const;
export type PlaceholderScreen = (typeof PLACEHOLDER_SCREENS)[number];

/** The screen named by a URL hash like `#levels`, or null. The game opens on Home without one. */
export function screenFromHash(hash: string): HashScreen | null {
  const name = hash.replace(/^#/, '');
  return HASH_SCREENS.find((s) => s === name) ?? null;
}

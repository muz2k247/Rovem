// The new Game v4 screens that Track A fills in (LEVELS_BUILD_PLAN A3). Until then each shows a plain
// placeholder, so both tracks have a slot in `App.tsx`. The Level screen is Track B's (`LevelScreen.tsx`).
export const PLACEHOLDER_SCREENS = ['home', 'levels', 'levelIntro', 'pause', 'settings', 'report'] as const;
export type PlaceholderScreen = (typeof PLACEHOLDER_SCREENS)[number];

/** The placeholder named by a URL hash like `#home`, or null. The game still opens on the garage without one. */
export function screenFromHash(hash: string): PlaceholderScreen | null {
  const name = hash.replace(/^#/, '');
  return PLACEHOLDER_SCREENS.find((s) => s === name) ?? null;
}

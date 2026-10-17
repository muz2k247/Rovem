import { PLACEHOLDER_SCREENS, type PlaceholderScreen as ScreenName } from './screens.ts';

const TITLES: Record<ScreenName, string> = {
  home: 'Home',
  levels: 'Levels',
  levelIntro: 'Level intro',
  pause: 'Pause',
  settings: 'Settings',
  report: 'Report',
};

/** A plain stand-in for a Game v4 screen that has not been built yet (LEVELS_BUILD_PLAN A3). */
export function PlaceholderScreen({ name, onNavigate, onBack }: { name: ScreenName; onNavigate: (to: ScreenName) => void; onBack: () => void }) {
  return (
    <main className="placeholder">
      <h1>{TITLES[name]}</h1>
      <p>Not built yet (Game v4, Track A).</p>
      <nav aria-label="Other screens">
        {PLACEHOLDER_SCREENS.filter((s) => s !== name).map((s) => (
          <button key={s} type="button" onClick={() => onNavigate(s)}>
            {TITLES[s]}
          </button>
        ))}
      </nav>
      <button type="button" onClick={onBack}>
        Back to garage
      </button>
    </main>
  );
}

import { HASH_SCREENS, type HashScreen, type PlaceholderScreen as ScreenName } from './screens.ts';

const TITLES: Record<HashScreen, string> = {
  home: 'Home',
  levels: 'Levels',
  levelIntro: 'Level intro',
  settings: 'Settings',
  report: 'Report',
};

/** A plain stand-in for a Game v4 screen that has not been built yet (LEVELS_BUILD_PLAN A3): now only the report. */
export function PlaceholderScreen({ name, onNavigate, onBack }: { name: ScreenName; onNavigate: (to: HashScreen) => void; onBack: () => void }) {
  return (
    <main className="screen placeholder">
      <h1>{TITLES[name]}</h1>
      <p>Not built yet (Game v4, Track A, session 3).</p>
      <nav aria-label="Other screens">
        {HASH_SCREENS.filter((s) => s !== name).map((s) => (
          <button key={s} type="button" className="btn small" onClick={() => onNavigate(s)}>
            {TITLES[s]}
          </button>
        ))}
      </nav>
      <button type="button" className="btn" onClick={onBack}>
        Back to Home
      </button>
    </main>
  );
}

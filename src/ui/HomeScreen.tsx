import type { LevelCard } from '../content/levelCards.ts';
import { controlsList } from '../game/controlsText.ts';

/** Home (LEVELS_BUILD_PLAN A3): wordmark, Continue (the next unfinished level), Levels, Endless Canyon, Garage, Settings, and the controls line. */
export function HomeScreen({
  continueCard,
  endlessUnlocked,
  onContinue,
  onLevels,
  onEndless,
  onGarage,
  onSettings,
}: {
  continueCard: LevelCard | null;
  endlessUnlocked: boolean;
  onContinue: () => void;
  onLevels: () => void;
  onEndless: () => void;
  onGarage: () => void;
  onSettings: () => void;
}) {
  const controls = controlsList();
  return (
    <main className="screen home">
      <div className="home-top">
        <h1 className="wordmark">ROVEM</h1>
        <p className="tagline">Build a rover. Drive it. See the physics in your own numbers.</p>
      </div>
      <nav className="home-menu" aria-label="Main menu">
        {continueCard && (
          <button type="button" className="btn cta" onClick={onContinue} autoFocus>
            Continue
            <small>{continueCard.name}</small>
          </button>
        )}
        <button type="button" className={continueCard ? 'btn' : 'btn cta'} onClick={onLevels} autoFocus={!continueCard}>
          Levels
        </button>
        <button type="button" className="btn" onClick={onEndless} disabled={!endlessUnlocked}>
          Endless Canyon
          {!endlessUnlocked && <small>Finish the first level to open it</small>}
        </button>
        <button type="button" className="btn" onClick={onGarage}>
          Garage
        </button>
        <button type="button" className="btn" onClick={onSettings}>
          Settings
        </button>
      </nav>
      <p className="controls-line">
        {controls.map((c) => (
          <span key={c.does}>
            <kbd>{c.keys}</kbd> {c.does.split('.')[0]}
          </span>
        ))}
      </p>
    </main>
  );
}

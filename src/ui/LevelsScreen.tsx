import type { NamedCard } from '../content/levelCards.ts';
import type { LevelSummary } from '../game/contracts.ts';
import { formatClock } from '../game/controlsText.ts';
import type { ShipPartView } from '../game/ship.ts';
import { ShipSilhouette } from './ShipSilhouette.tsx';
import { Stars } from './Stars.tsx';

export interface EndlessCardInfo extends NamedCard {
  locked: boolean;
  bestDistanceM: number;
}

/**
 * Levels (LEVELS_BUILD_PLAN A3): a 4-column grid of cards with number, name, hook and stars. The next level is
 * marked "NEXT"; later ones show a lock and "Finish the previous level". The Endless card shows the best distance.
 * The Dust Storm card is always locked. Above them, the ship shows the five parts and which are recovered.
 */
export function LevelsScreen({
  levels,
  nextId,
  endless,
  dustStorm,
  ship,
  onOpenLevel,
  onEndless,
  onBack,
}: {
  levels: LevelSummary[];
  nextId: string | null;
  endless: EndlessCardInfo;
  dustStorm: NamedCard;
  /** The ship's five parts and which are recovered (SHOWCASE_PLAN §12). */
  ship: ShipPartView[];
  onOpenLevel: (id: string) => void;
  onEndless: () => void;
  onBack: () => void;
}) {
  return (
    <main className="screen levels">
      <header className="screen-header">
        <button type="button" className="btn small" onClick={onBack}>
          ← Home
        </button>
        <h1>Levels</h1>
      </header>
      <ShipSilhouette parts={ship} />
      <div className="level-grid">
        {levels.map((l) => {
          const isNext = l.id === nextId;
          const closed = l.locked || l.comingSoon === true;
          return (
            <button
              key={l.id}
              type="button"
              className={`level-card${closed ? ' locked' : ''}${isNext ? ' next' : ''}`}
              disabled={closed}
              onClick={() => onOpenLevel(l.id)}
              aria-label={`Level ${l.number}, ${l.name}${l.comingSoon ? ', coming soon' : l.locked ? ', locked' : ''}`}
            >
              <span className="level-number">{l.number}</span>
              {isNext && <span className="badge next-badge">NEXT</span>}
              <strong>{l.name}</strong>
              <span className="hook">{l.comingSoon ? 'Coming soon' : l.locked ? 'Finish the previous level' : l.hook}</span>
              <span className="card-foot">
                {closed ? (
                  <span className="lock" aria-hidden="true">
                    🔒
                  </span>
                ) : (
                  <Stars count={l.stars} />
                )}
                {l.bestTimeS !== null && <span className="best">{formatClock(l.bestTimeS)}</span>}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          className={`level-card endless${endless.locked ? ' locked' : ''}`}
          disabled={endless.locked}
          onClick={onEndless}
          aria-label={`${endless.name}${endless.locked ? ', locked' : ''}`}
        >
          <span className="level-number">∞</span>
          <strong>{endless.name}</strong>
          <span className="hook">{endless.locked ? 'Finish the first level' : endless.hook}</span>
          <span className="card-foot">
            {endless.locked ? (
              <span className="lock" aria-hidden="true">
                🔒
              </span>
            ) : (
              <span className="best">Best {Math.round(endless.bestDistanceM)} m</span>
            )}
          </span>
        </button>
        <div className="level-card locked dust" aria-label={`${dustStorm.name}, locked`}>
          <span className="level-number">?</span>
          <strong>{dustStorm.name}</strong>
          <span className="hook">{dustStorm.hook}</span>
          <span className="card-foot">
            <span className="lock" aria-hidden="true">
              🔒
            </span>
          </span>
        </div>
      </div>
    </main>
  );
}

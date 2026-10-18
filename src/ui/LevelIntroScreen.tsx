import { useEffect } from 'react';
import type { LevelCard } from '../content/levelCards.ts';
import { controlsList } from '../game/controlsText.ts';
import { LevelDiagram } from './LevelDiagram.tsx';

/**
 * Level intro (LEVELS_BUILD_PLAN A3): name, goal, "New here", a small diagram, the three star rules, the controls,
 * and Back / Change rover / Start (Enter).
 */
export function LevelIntroScreen({
  card,
  number,
  parS,
  onBack,
  onChangeRover,
  onStart,
}: {
  card: LevelCard;
  number: number;
  /** The par time in seconds, once it is known (set in I1); until then the rule is shown without a number. */
  parS?: number | null;
  onBack: () => void;
  onChangeRover: () => void;
  onStart: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const onControl = e.target instanceof HTMLElement && (e.target.tagName === 'BUTTON' || e.target.tagName === 'A');
      if (e.code === 'Enter' && !onControl) onStart();
      if (e.code === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart, onBack]);

  const controls = controlsList({ levels: true, extra: card.extraControls });
  return (
    <main className="screen intro">
      <header className="screen-header">
        <button type="button" className="btn small" onClick={onBack}>
          ← Levels
        </button>
        <p className="eyebrow">Level {number}</p>
      </header>
      <div className="intro-body">
        <section className="intro-main" aria-label="About this level">
          <h1>{card.name}</h1>
          <p className="goal">{card.goal}</p>
          <h2>New here</h2>
          <ul className="new-here">
            {card.newHere.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <LevelDiagram id={card.diagram} />
        </section>
        <aside className="intro-side">
          <section aria-label="Stars">
            <h2>Stars</h2>
            <ul className="star-rules">
              <li>
                <span className="star on" aria-hidden="true">
                  ★
                </span>{' '}
                Reach the beacon
              </li>
              <li>
                <span className="star on" aria-hidden="true">
                  ★
                </span>{' '}
                Collect all 3 samples
              </li>
              <li>
                <span className="star on" aria-hidden="true">
                  ★
                </span>{' '}
                Beat the par time{parS ? ` (${parS} s)` : ''}
              </li>
            </ul>
          </section>
          <section aria-label="Controls">
            <h2>Controls</h2>
            <ul className="control-list">
              {controls.map((c) => (
                <li key={c.keys + c.does}>
                  <kbd>{c.keys}</kbd> {c.does}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
      <footer className="intro-buttons">
        <button type="button" className="btn" onClick={onBack}>
          Back
        </button>
        <button type="button" className="btn" onClick={onChangeRover}>
          Change rover
        </button>
        <button type="button" className="btn cta" onClick={onStart} autoFocus>
          Start <kbd>Enter</kbd>
        </button>
      </footer>
    </main>
  );
}

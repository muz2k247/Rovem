import type { HudModel } from '../../game/contracts.ts';
import { controlsList, formatClock } from '../../game/controlsText.ts';

/**
 * The driving HUD (LEVELS_BUILD_PLAN A3, A4). It only draws the model it is handed. Top left: speed and the badges.
 * Top centre: the level name and progress. Top right: time and a pause button. Right: one caption. Bottom centre:
 * the F = ma line. Bottom left: the controls hint (first 10 s). The force arrows are drawn in the 3D scene.
 * Shared by the Endless run and by Track B's level screen.
 */
export function Hud({
  model,
  showControlsHint,
  levelControls = false,
  onPause,
}: {
  model: HudModel;
  showControlsHint: boolean;
  /** Include the level keys (R, Space) in the controls hint. */
  levelControls?: boolean;
  onPause: () => void;
}) {
  const { badges } = model;
  const hint = controlsList({ levels: levelControls });
  return (
    <div className="hud2">
      <div className="hud2-top">
        <div className="hud2-speed">
          <strong className={model.speedTone ? `speed-big speed-${model.speedTone}` : 'speed-big'}>{model.speedMps.toFixed(2)}</strong>
          <span className="speed-unit">m/s</span>
          <small className="speed-kmh">{Math.round(model.speedKmh)} km/h</small>
          <span className="badges">
            {badges.reverse && (
              <span className="badge reverse" aria-label="Reverse gear">
                R
              </span>
            )}
            {badges.slip && <span className="badge slip">WHEELS SLIP</span>}
            {model.booster && (
              <span className={`badge booster booster-${model.booster.state}`} aria-label={`Booster ${model.booster.state}`}>
                {model.booster.state === 'ready' ? 'BOOST ●' : model.booster.state === 'firing' ? 'BOOST ▶' : 'BOOST ○'}
              </span>
            )}
            {badges.pole && (
              <span className={`badge pole pole-${badges.pole}`} aria-label={`Magnet pole ${badges.pole}`}>
                {badges.pole}
              </span>
            )}
          </span>
        </div>
        <div className="hud2-progress">
          <span className="level-name">{model.levelName}</span>
          <span className="progress-text">{model.progressText}</span>
          <span
            className="bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(model.progressFraction * 100)}
            aria-label="Progress"
          >
            <span style={{ width: `${(model.progressFraction * 100).toFixed(1)}%` }} />
          </span>
          {model.scoreText && <small className="score-text">{model.scoreText}</small>}
        </div>
        <div className="hud2-time">
          <strong className="time-big">{formatClock(model.timeS)}</strong>
          <button type="button" className="btn small pause-button" onClick={onPause} aria-label="Pause">
            ❚❚ <kbd>Esc</kbd>
          </button>
        </div>
      </div>

      {model.split && (
        <div className={`hud2-split ${model.split.behind ? 'behind' : 'ahead'}`} aria-live="polite">
          {model.split.text}
        </div>
      )}

      {model.caption && (
        <div className="hud2-caption" aria-live="polite">
          <strong>{model.caption.title}</strong>
          {model.caption.line && <span>{model.caption.line}</span>}
        </div>
      )}

      {model.forceLine && (
        <div className="hud2-forceline" aria-live="off">
          {model.forceLine}
        </div>
      )}

      {showControlsHint && (
        <div className="hud2-hint">
          {hint.map((c) => (
            <span key={c.keys + c.does}>
              <kbd>{c.keys}</kbd> {c.does.split('.')[0]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

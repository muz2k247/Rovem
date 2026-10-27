import type { HudModel } from '../../game/contracts.ts';
import { controlsList, formatClock } from '../../game/controlsText.ts';

/**
 * The driving HUD (LEVELS_BUILD_PLAN A3, A4). It only draws the model it is handed. Top left: speed and the badges.
 * Top centre: the level name and progress. Top right: time and a pause button. Right: one caption. Bottom centre:
 * the F = ma line. Bottom left: the controls hint (first 10 s). The force arrows are drawn in the 3D scene.
 * Shared by the Endless run and by Track B's level screen.
 */
/** A ring that fills as `fraction` goes from 0 to 1 (the booster's recharge, the stuck return). */
function Ring({ fraction, className }: { fraction: number; className: string }) {
  const r = 10;
  const circumference = 2 * Math.PI * r;
  return (
    <svg className={`ring ${className}`} viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <circle className="ring-track" cx="12" cy="12" r={r} fill="none" strokeWidth="3" />
      <circle
        className="ring-fill" cx="12" cy="12" r={r} fill="none" strokeWidth="3" strokeLinecap="round"
        strokeDasharray={`${(Math.max(0, Math.min(1, fraction)) * circumference).toFixed(2)} ${circumference.toFixed(2)}`}
        transform="rotate(-90 12 12)"
      />
    </svg>
  );
}

/**
 * The water meter (R12, DECISIONS 2026-10-26 (6)): two bars, upthrust (green) against weight (violet), shown only while the rover is in water. The green
 * grows with the depth; when it passes the violet the rover floats, and the meter says so. Both bars share one scale, so they can be compared by eye.
 */
export function WaterMeter({ water }: { water: NonNullable<HudModel['water']> }) {
  const scaleN = Math.max(water.weightN, water.maxUpthrustN) * 1.05;
  const percent = (n: number) => `${Math.max(0, Math.min(100, (n / scaleN) * 100)).toFixed(1)}%`;
  return (
    <div className={water.floating ? 'hud2-water floating' : 'hud2-water'} role="status" aria-live="polite" aria-label={`Upthrust ${Math.round(water.upthrustN)} newtons, weight ${Math.round(water.weightN)} newtons${water.floating ? ', you float' : ''}`}>
      {water.floating && <strong className="water-float">You float</strong>}
      <div className="water-bars">
        <div className="water-col">
          <span className="water-bar water-up">
            <span style={{ height: percent(water.upthrustN) }} />
          </span>
          <small>Upthrust</small>
          <b>{Math.round(water.upthrustN)} N</b>
        </div>
        <div className="water-col">
          <span className="water-bar water-weight">
            <span style={{ height: percent(water.weightN) }} />
          </span>
          <small>Weight</small>
          <b>{Math.round(water.weightN)} N</b>
        </div>
      </div>
    </div>
  );
}

export function Hud({
  model,
  showControlsHint,
  levelControls = false,
  scavengerLabel,
  onPause,
}: {
  model: HudModel;
  /** A small label while the Scavenger fires its booster (AUDIT_R9 G3): never in the pop-up channel. */
  scavengerLabel?: string | null;
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
              <span
                className={`badge booster booster-${model.booster.state}`}
                aria-label={model.booster.state === 'recharging' ? `Booster recharging, ${Math.ceil(model.booster.rechargeLeftS)} seconds` : `Booster ${model.booster.state}`}
              >
                <Ring fraction={model.booster.state === 'firing' ? model.booster.leftS / 1.5 : model.booster.rechargeFraction} className="booster-ring" />
                {model.booster.state === 'ready' ? 'BOOST' : model.booster.state === 'firing' ? 'BOOST ▶' : `${Math.ceil(model.booster.rechargeLeftS)} s`}
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

      {model.stuck && (
        <div className={`hud2-stuck stuck-${model.stuck.cause}`} role="status" aria-live="polite">
          <Ring fraction={model.stuck.progress} className="stuck-ring" />
          <span>
            {model.stuck.atWall ? 'Going back unless you reverse: press S' : model.stuck.boosterReady ? 'Going back… press Shift for the booster' : 'Going back…'}
          </span>
        </div>
      )}

      {model.water && <WaterMeter water={model.water} />}

      {model.launcherWarning && (
        <div className={`hud2-launcher-warning ${model.launcherWarning}`} role="status" aria-label={`Launcher on your ${model.launcherWarning}, about to fire from behind`}>
          <span aria-hidden="true">{model.launcherWarning === 'left' ? '◀' : '▶'}</span>
        </div>
      )}

      {scavengerLabel && (
        <div className="hud2-scavenger-label" aria-live="polite">
          {scavengerLabel}
        </div>
      )}

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

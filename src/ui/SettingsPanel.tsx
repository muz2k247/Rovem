import { useState } from 'react';
import { controlsList } from '../game/controlsText.ts';
import { disarmReset, pressReset, resetIdle, type ResetState } from '../game/resetConfirm.ts';
import type { Graphics, Settings } from '../save/settings.ts';

const VOLUMES = [
  { key: 'masterVolume', label: 'Master' },
  { key: 'engineVolume', label: 'Engine' },
  { key: 'effectsVolume', label: 'Effects' },
] as const;

const TOGGLES = [
  { key: 'forceArrows', label: 'Force arrows', hint: 'Arrows on the rover show the forces on it.' },
  { key: 'showMaths', label: 'Show the maths', hint: 'The F = ma line and the worked numbers in captions.' },
  { key: 'cameraShake', label: 'Camera shake', hint: 'The camera shakes when you crash.' },
] as const;

/**
 * The settings (LEVELS_BUILD_PLAN A3): volumes and Mute, Force arrows, Show the maths, Camera shake, Graphics, the
 * controls list, Replay tutorial and Reset progress (press twice to confirm). Used by the Settings screen and, as an
 * overlay, by the pause menu.
 */
export function SettingsPanel({
  settings,
  onChange,
  onReplayTutorial,
  onResetProgress,
}: {
  settings: Settings;
  onChange: (next: Settings) => void;
  onReplayTutorial: () => void;
  onResetProgress: () => void;
}) {
  const [reset, setReset] = useState<ResetState>(resetIdle);
  const [tutorialNote, setTutorialNote] = useState(false);
  // Changing anything else disarms the Reset button.
  const change = (next: Settings) => {
    setReset(disarmReset());
    onChange(next);
  };
  const press = () => {
    const r = pressReset(reset);
    setReset(r.state);
    if (r.confirmed) onResetProgress();
  };

  return (
    <div className="settings-panel">
      <section aria-label="Sound">
        <h2>Sound</h2>
        {VOLUMES.map(({ key, label }) => (
          <label key={key} className="slider">
            <span>{label}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(settings[key] * 100)}
              onChange={(e) => change({ ...settings, [key]: Number(e.target.value) / 100 })}
              aria-valuetext={`${Math.round(settings[key] * 100)} percent`}
            />
            <output>{Math.round(settings[key] * 100)}%</output>
          </label>
        ))}
        <label className="check">
          <input type="checkbox" checked={settings.muted} onChange={(e) => change({ ...settings, muted: e.target.checked })} />
          <span>Mute</span>
        </label>
      </section>

      <section aria-label="Display">
        <h2>Display</h2>
        {TOGGLES.map(({ key, label, hint }) => (
          <label key={key} className="check">
            <input type="checkbox" checked={settings[key]} onChange={(e) => change({ ...settings, [key]: e.target.checked })} />
            <span>
              {label}
              <small>{hint}</small>
            </span>
          </label>
        ))}
        <fieldset className="choice">
          <legend>Graphics</legend>
          {(['low', 'high'] as const satisfies readonly Graphics[]).map((g) => (
            <label key={g} className="radio">
              <input type="radio" name="graphics" checked={settings.graphics === g} onChange={() => change({ ...settings, graphics: g })} />
              <span>{g === 'low' ? 'Low' : 'High'}</span>
            </label>
          ))}
          <small>Low turns off the dust, to help slower computers.</small>
        </fieldset>
      </section>

      <section aria-label="Controls">
        <h2>Controls</h2>
        <ul className="control-list">
          {controlsList({ levels: true, extra: ['Space: flip your magnet (Polar Pass)'] }).map((c) => (
            <li key={c.keys + c.does}>
              <kbd>{c.keys}</kbd> {c.does}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Progress">
        <h2>Progress</h2>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setReset(disarmReset());
            onReplayTutorial();
            setTutorialNote(true);
          }}
        >
          Replay tutorial
        </button>
        {tutorialNote && <small role="status">The tutorial will show again at the start of your next Endless run.</small>}
        <button type="button" className={`btn danger${reset.armed ? ' armed' : ''}`} onClick={press}>
          {reset.armed ? 'Press again to erase all stars, times and bests' : 'Reset progress'}
        </button>
      </section>
    </div>
  );
}

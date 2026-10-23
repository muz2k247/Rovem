import { useState } from 'react';
import { controlsList } from '../game/controlsText.ts';
import { disarmReset, pressReset, resetIdle, type ResetState } from '../game/resetConfirm.ts';
import type { Graphics, Settings } from '../save/settings.ts';

// One plain sentence under every option (placeholder wording: k._muz reviews it).
const VOLUMES = [
  { key: 'masterVolume', label: 'Master', hint: 'How loud everything is.' },
  { key: 'engineVolume', label: 'Engine', hint: 'How loud the motor is. It is silent when you stop and loudest when you press the throttle.' },
  { key: 'effectsVolume', label: 'Effects', hint: 'How loud crashes, splashes, scrapes and the other sounds are.' },
] as const;

const TOGGLES = [
  { key: 'forceArrows', label: 'Force arrows', hint: 'Arrows on the rover show the forces on it.' },
  { key: 'showMaths', label: 'Show the maths', hint: 'The F = ma line and the worked numbers in captions.' },
  { key: 'cameraShake', label: 'Camera shake', hint: 'The camera shakes when you crash.' },
] as const;

/**
 * The settings (LEVELS_BUILD_PLAN A3; grouped in R1, SHOWCASE_PLAN §12): Sound (volumes and Mute), Display (Force arrows, Show the
 * maths, Camera shake, Graphics) and Help (the controls list, Replay tutorial, Reset progress: press twice to confirm). Used by the Settings screen and, as an
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
        {VOLUMES.map(({ key, label, hint }) => (
          <div key={key} className="option">
            <label className="slider">
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
            <small>{hint}</small>
          </div>
        ))}
        <label className="check">
          <input type="checkbox" checked={settings.muted} onChange={(e) => change({ ...settings, muted: e.target.checked })} />
          <span>
            Mute
            <small>Turns all sound off.</small>
          </span>
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

      <section aria-label="Help" className="help">
        <h2>Help</h2>
        <h3>Controls</h3>
        <small>These keys work in the levels.</small>
        <ul className="control-list">
          {controlsList({ levels: true, extra: ['Space: flip your magnet (Iron Ridge)'] }).map((c) => (
            <li key={c.keys + c.does}>
              <kbd>{c.keys}</kbd> {c.does}
            </li>
          ))}
        </ul>
        <h3>Tutorial</h3>
        <small>Shows the how-to-drive tips again.</small>
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
        <h3>Progress</h3>
        <small>Erases every star, time and best distance. You press the button twice to confirm.</small>
        <button type="button" className={`btn danger${reset.armed ? ' armed' : ''}`} onClick={press}>
          {reset.armed ? 'Press again to erase all stars, times and bests' : 'Reset progress'}
        </button>
      </section>
    </div>
  );
}

import { content, type EventKind, type Part, type Slot } from '../content/index.ts';
import { EVENT_KINDS, FORMULA_KINDS } from '../content/types.ts';
import { roverFromParts } from '../game/buildFromParts.ts';
import { garageNumbers } from '../game/run/garageNumbers.ts';
import { speedText } from '../game/run/feedback.ts';
import { displayPartName, nextUnlock, unlockedPartIds, unlockText } from '../game/run/unlocks.ts';
import { formatForce, formatMass } from '../game/partEffects.ts';
import type { DemoBuild, DemoProgress } from '../save/demoProgress.ts';

const SLOTS: { slot: Slot; title: string; key: keyof DemoBuild; note?: string }[] = [
  { slot: 'chassis', title: 'Body', key: 'chassisId', note: 'also called the chassis: the rover’s frame' },
  { slot: 'wheels', title: 'Wheels', key: 'wheelsId' },
  { slot: 'motor', title: 'Motor', key: 'motorId' },
];

const EVENT_TITLES: Record<EventKind, string> = {
  mud: 'Mud',
  sand: 'Sand',
  ice: 'Ice',
  boost: 'Boost pad',
  headOnHit: 'Sandbag hit',
  kickerHit: 'Kicker hit',
  gravity: 'Gravity zone',
  slip: 'Wheels slipping',
  aboveTopSpeed: 'Above top speed',
};

function partDetail(part: Part): string {
  if (part.slot === 'chassis') return `${part.massKg} kg`;
  if (part.slot === 'wheels') return `${part.massKg} kg · grip ×${part.gripFactor} · rolling ×${part.rollingFactor}`;
  return `${part.massKg} kg · ${part.driveForceMaxN} N · top speed ${part.topSpeedMps} m/s`;
}

export function GarageScreen({
  progress,
  onProgressChange,
  onStart,
  onReplay,
  onDeveloper,
}: {
  progress: DemoProgress;
  onProgressChange: (progress: DemoProgress) => void;
  onStart: () => void;
  onReplay: () => void;
  onDeveloper: () => void;
}) {
  const unlocked = new Set(unlockedPartIds(content, progress.bestDistanceM));
  const rover = roverFromParts(content, progress.build);
  const n = garageNumbers(content, rover);
  const unit = progress.speedUnit;
  const next = nextUnlock(content, progress.bestDistanceM);
  const seen = EVENT_KINDS.filter((k) => progress.seenEvents.includes(k));
  const text = content.runText;
  const k = unit === 'kmh' ? 3.6 : 1;

  return (
    <main className="garage">
      <header className="build-header">
        <span className="brand">ROVEM</span>
        <span>Garage</span>
        <span className="garage-best">
          Best {progress.bestDistanceM.toFixed(0)} m · score {progress.bestScore}
        </span>
      </header>

      <div className="garage-body">
        <section aria-label="Parts">
          <h2>Build your rover</h2>
          {SLOTS.map(({ slot, title, key, note }) => (
            <div key={slot} className="slot">
              <h3>
                {title}
                {note && <small> — {note}</small>}
              </h3>
              <div className="part-row">
                {content.parts
                  .filter((p) => p.slot === slot)
                  .map((part) => {
                    const open = unlocked.has(part.id);
                    const selected = progress.build[key] === part.id;
                    return (
                      <div key={part.id} className={`part${selected ? ' selected' : ''}${open ? '' : ' locked'}`}>
                        <button
                          type="button"
                          disabled={!open}
                          aria-pressed={selected}
                          onClick={() => onProgressChange({ ...progress, build: { ...progress.build, [key]: part.id } })}
                        >
                          <strong>{displayPartName(part.name)}</strong>
                          <span>{partDetail(part)}</span>
                          {!open && <span className="lock">{unlockText(content, part.id)}</span>}
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
          <p className="note">{next ? `Next part at ${next.atBestDistanceM} m best distance.` : 'Every part is unlocked.'}</p>
        </section>

        <section aria-label="Your rover in the canyon">
          <h2>Your rover in the canyon</h2>
          <table className="numbers">
            <tbody>
              <tr>
                <th scope="row">Mass</th>
                <td>{formatMass(n.massKg)}</td>
              </tr>
              <tr>
                <th scope="row">Motor force</th>
                <td>{formatForce(n.motorForceN)}</td>
              </tr>
              <tr>
                <th scope="row">Top speed</th>
                <td>{speedText(n.topSpeedMps, unit)}</td>
              </tr>
              <tr>
                <th scope="row">In mud</th>
                <td>
                  friction {formatForce(n.mud.frictionN)} vs motor {formatForce(n.mud.motorN)}: <b>{n.mud.verdict}</b>
                </td>
              </tr>
              <tr>
                <th scope="row">Boost pad</th>
                <td>+{speedText(n.boostGainMps, unit)}</td>
              </tr>
              <tr>
                <th scope="row">Sandbag hit</th>
                <td>
                  {(n.sandbag.fromMps * k).toFixed(2)} → {speedText(n.sandbag.toMps, unit)}
                </td>
              </tr>
              <tr>
                <th scope="row">Weight, low gravity</th>
                <td>{formatForce(n.weightLowN)}</td>
              </tr>
              <tr>
                <th scope="row">Weight, high gravity</th>
                <td>{formatForce(n.weightHighN)}</td>
              </tr>
            </tbody>
          </table>
          <p className="note">These come from the same physics the run uses.</p>

          <h2>Field log</h2>
          {seen.length === 0 ? (
            <p className="note">Things you meet in the canyon are written down here.</p>
          ) : (
            <ul className="field-log">
              {seen.map((kind) => (
                <li key={kind}>
                  <strong>{EVENT_TITLES[kind]}</strong>
                  <span>{text.tidbits[kind]}</span>
                  {(FORMULA_KINDS as readonly string[]).includes(kind) && (
                    <em>{text.formulas[kind as (typeof FORMULA_KINDS)[number]]}</em>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Start">
          <h2>Go</h2>
          <button type="button" className="primary" onClick={onStart}>
            Start run
          </button>
          {progress.lastSeed !== null && (
            <button type="button" className="secondary" onClick={onReplay}>
              Replay last course
            </button>
          )}

          <h2>Settings</h2>
          <div className="settings">
            <label>
              Speed unit
              <select
                value={progress.speedUnit}
                onChange={(e) => onProgressChange({ ...progress, speedUnit: e.target.value === 'kmh' ? 'kmh' : 'mps' })}
              >
                <option value="mps">m/s</option>
                <option value="kmh">km/h</option>
              </select>
            </label>
            <small>km/h = m/s × 3.6, e.g. 16 m/s × 3.6 = 57.6 km/h</small>
            <label>
              <input
                type="checkbox"
                checked={progress.showForces}
                onChange={(e) => onProgressChange({ ...progress, showForces: e.target.checked })}
              />
              Force panel
            </label>
            <label>
              <input
                type="checkbox"
                checked={progress.soundOn}
                onChange={(e) => onProgressChange({ ...progress, soundOn: e.target.checked })}
              />
              Sound
            </label>
          </div>
        </section>
      </div>

      <footer className="garage-footer">
        <button type="button" className="link" onClick={onDeveloper}>
          Developer: M5a test course
        </button>
      </footer>
    </main>
  );
}

import { useEffect, useState } from 'react';
import { content, type EventKind, type Part, type Slot } from '../content/index.ts';
import { roverFromParts } from '../game/buildFromParts.ts';
import { garageNumbers } from '../game/run/garageNumbers.ts';
import { compareRows, fieldLogEntries, garageRows } from '../game/run/garageView.ts';
import { displayPartName, newPartIds, nextUnlock, unlockedPartIds, unlockProgress, unlockText } from '../game/run/unlocks.ts';
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
  slide: 'Sliding',
};

function partDetail(part: Part): string {
  if (part.slot === 'chassis') return `${part.massKg} kg`;
  if (part.slot === 'wheels') return `${part.massKg} kg · grip ×${part.gripFactor} · rolling ×${part.rollingFactor}`;
  return `${part.massKg} kg · ${part.driveForceMaxN} N · top speed ${part.topSpeedMps} m/s`;
}

/** "350 / 400 m" with a thin bar, on a locked part. */
function UnlockBar({ partId, bestDistanceM }: { partId: string; bestDistanceM: number }) {
  const progress = unlockProgress(content, partId, bestDistanceM);
  if (!progress) return null;
  return (
    <span className="unlock-progress">
      {progress.text}
      <span className="bar" aria-hidden="true">
        <span style={{ width: `${(progress.fraction * 100).toFixed(1)}%` }} />
      </span>
    </span>
  );
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
  const unit = progress.speedUnit;
  const next = nextUnlock(content, progress.bestDistanceM);
  const log = fieldLogEntries(progress.seenEvents, content.runText);

  // Parts opened since the last visit wear a NEW badge for this whole visit; they are marked as seen on arrival.
  const [fresh] = useState(() => newPartIds(content, progress.bestDistanceM, progress.partsSeen));
  useEffect(() => {
    if (fresh.length > 0) onProgressChange({ ...progress, partsSeen: [...new Set([...progress.partsSeen, ...fresh])] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hovering (or focusing) a part shows the numbers with that part fitted: before → after.
  const [preview, setPreview] = useState<{ key: keyof DemoBuild; id: string } | null>(null);
  const previewed =
    preview && progress.build[preview.key] !== preview.id
      ? garageRows(garageNumbers(content, roverFromParts(content, { ...progress.build, [preview.key]: preview.id })), unit)
      : undefined;
  const rows = compareRows(garageRows(garageNumbers(content, rover), unit), previewed);

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
                      <div
                        key={part.id}
                        className={`part${selected ? ' selected' : ''}${open ? '' : ' locked'}`}
                        onMouseEnter={() => setPreview({ key, id: part.id })}
                        onMouseLeave={() => setPreview(null)}
                      >
                        <button
                          type="button"
                          disabled={!open}
                          aria-pressed={selected}
                          onFocus={() => setPreview({ key, id: part.id })}
                          onBlur={() => setPreview(null)}
                          onClick={() => onProgressChange({ ...progress, build: { ...progress.build, [key]: part.id } })}
                        >
                          <strong>
                            {displayPartName(part.name)}
                            {fresh.includes(part.id) && <em className="new-badge">NEW</em>}
                          </strong>
                          <span>{partDetail(part)}</span>
                          {!open && <span className="lock">{unlockText(content, part.id)}</span>}
                          {!open && <UnlockBar partId={part.id} bestDistanceM={progress.bestDistanceM} />}
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
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>
                    {row.after === undefined ? (
                      row.value
                    ) : (
                      <>
                        <span className="before">{row.value}</span> → <b className="after">{row.after}</b>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">These come from the same physics the run uses. Point at a part to see what it changes.</p>

          <h2>Field log</h2>
          {log.length === 0 ? (
            <p className="note">Things you meet in the canyon are written down here.</p>
          ) : (
            <ul className="field-log">
              {log.map((entry) => (
                <li key={entry.kind}>
                  <strong>{EVENT_TITLES[entry.kind]}</strong>
                  <span>{entry.tidbit}</span>
                  {entry.formula && <em>{entry.formula}</em>}
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

import { useState } from 'react';
import { content, type EventKind, type Part, type Slot } from '../content/index.ts';
import { roverFromParts } from '../game/buildFromParts.ts';
import { garageNumbers } from '../game/run/garageNumbers.ts';
import { changeBanner, changeRows, compareRows, displayPartName, fieldLogEntries, garageRows } from '../game/run/garageView.ts';
import { roverLookFor } from '../render/roverModel.ts';
import type { DemoBuild, DemoProgress } from '../save/demoProgress.ts';
import { GaragePreview } from './GaragePreview.tsx';

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

export function GarageScreen({
  progress,
  onProgressChange,
  backLabel,
  onBack,
  onStart,
  startLabel = 'Start run',
  onReplay,
  onDeveloper,
}: {
  progress: DemoProgress;
  onProgressChange: (progress: DemoProgress) => void;
  /** Where Back goes, e.g. "Home" or "Back to level". */
  backLabel: string;
  onBack: () => void;
  /** Start an Endless run from here; left out when the garage was opened from a level. */
  onStart?: () => void;
  /** The label of the start button (default "Start run"). */
  startLabel?: string;
  onReplay?: () => void;
  /** The M5a test course link; shown only with the developer link (?unlock=all). */
  onDeveloper?: () => void;
}) {
  const unit = progress.speedUnit;
  const log = fieldLogEntries(progress.seenEvents, content.runText);
  const numbersFor = (build: DemoBuild) => garageNumbers(content, roverFromParts(content, build));

  // The build before the latest swap: the ▲/▼ changes and the banner compare against it.
  const [before, setBefore] = useState<DemoBuild | null>(null);
  // Hovering (or focusing) a part shows the numbers with that part fitted: before → after.
  const [preview, setPreview] = useState<{ key: keyof DemoBuild; id: string } | null>(null);

  const banner = before ? changeBanner(content, before, progress.build) : null;
  const fitted = numbersFor(progress.build);
  const fittedRows = before && banner ? changeRows(numbersFor(before), fitted, unit) : garageRows(fitted, unit);
  const previewed =
    preview && progress.build[preview.key] !== preview.id
      ? garageRows(numbersFor({ ...progress.build, [preview.key]: preview.id }), unit)
      : undefined;
  const rows = compareRows(fittedRows, previewed);

  const choose = (key: keyof DemoBuild, id: string) => {
    if (progress.build[key] === id) return;
    setBefore(progress.build);
    onProgressChange({ ...progress, build: { ...progress.build, [key]: id } });
  };

  return (
    <main className="garage">
      <header className="build-header">
        <button type="button" className="btn small" onClick={onBack}>
          ← {backLabel}
        </button>
        <span className="brand">ROVEM</span>
        <span>Garage</span>
        <span className="garage-best">
          Best {progress.bestDistanceM.toFixed(0)} m · score {progress.bestScore}
        </span>
      </header>

      <div className="garage-body">
        <section aria-label="Parts" className="garage-parts">
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
                    const selected = progress.build[key] === part.id;
                    return (
                      <div
                        key={part.id}
                        className={`part${selected ? ' selected' : ''}`}
                        onMouseEnter={() => setPreview({ key, id: part.id })}
                        onMouseLeave={() => setPreview(null)}
                      >
                        <button
                          type="button"
                          aria-pressed={selected}
                          onFocus={() => setPreview({ key, id: part.id })}
                          onBlur={() => setPreview(null)}
                          onClick={() => choose(key, part.id)}
                        >
                          <strong>{displayPartName(part.name)}</strong>
                          <span>{partDetail(part)}</span>
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
          <p className="note">Every part is open. Try them all.</p>
        </section>

        <section aria-label="Your rover" className="garage-stage">
          <GaragePreview look={roverLookFor(progress.build)} />
          <p className="garage-hint">Drag to turn the rover.</p>
          <div className={`change-banner${banner ? ' on' : ''}`} role="status" aria-live="polite">
            {banner && (
              <>
                <strong>{banner.title}</strong>
                <span>{banner.why}</span>
              </>
            )}
          </div>
        </section>

        <section aria-label="Your rover in numbers" className="garage-side">
          <h2>Your rover in numbers</h2>
          <table className="numbers">
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.label}</th>
                  <td>
                    {row.after === undefined ? (
                      row.value
                    ) : (
                      <>
                        <span className="before">{row.value}</span> → <b className="after">{row.after}</b>
                      </>
                    )}
                    {row.change && (
                      <span className={`delta ${row.change.direction}`}>
                        <span aria-hidden="true">{row.change.direction === 'up' ? '▲' : '▼'}</span>
                        <span className="sr-only">{row.change.direction === 'up' ? 'up' : 'down'}</span> {row.change.text}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">These come from the same physics the levels use. Point at a part to see what it would change.</p>

          {onStart && (
            <button type="button" className="btn cta garage-go" onClick={onStart}>
              {startLabel}
            </button>
          )}
          {onReplay && progress.lastSeed !== null && (
            <button type="button" className="btn small" onClick={onReplay}>
              Replay last course
            </button>
          )}

          <div className="settings garage-units">
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
          </div>

          {log.length > 0 && (
            <>
              <h2>Field log</h2>
              <ul className="field-log">
                {log.map((entry) => (
                  <li key={entry.kind}>
                    <strong>{EVENT_TITLES[entry.kind]}</strong>
                    <span>{entry.tidbit}</span>
                    {entry.formula && <em>{entry.formula}</em>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      {onDeveloper && (
        <footer className="garage-footer">
          <button type="button" className="link" onClick={onDeveloper}>
            Developer: M5a test course
          </button>
        </footer>
      )}
    </main>
  );
}

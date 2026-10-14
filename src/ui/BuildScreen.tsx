import { content, type Part, type Slot } from '../content/index.ts';
import { type BuildSelection } from '../game/buildFromParts.ts';
import {
  formatAcceleration,
  formatForce,
  formatMass,
  formatSpeed,
  MISSION_1_SURFACE_IDS,
  ownedPartIds,
  partEffects,
} from '../game/partEffects.ts';

const SLOTS: { slot: Slot; title: string; key: keyof BuildSelection }[] = [
  { slot: 'chassis', title: 'Chassis', key: 'chassisId' },
  { slot: 'wheels', title: 'Wheels', key: 'wheelsId' },
  { slot: 'motor', title: 'Motor', key: 'motorId' },
];

/** The line of facts under a part's name, built from its data. */
function partDetail(part: Part): string {
  if (part.slot === 'chassis') return `${part.massKg} kg`;
  if (part.slot === 'wheels') return `${part.massKg} kg · grip ×${part.gripFactor} · rolling ×${part.rollingFactor}`;
  return `${part.massKg} kg · ${part.driveForceMaxN} N · top speed ${part.topSpeedMps} m/s`;
}

const surfaceName = (id: string) => content.surfaces.find((s) => s.id === id)?.name ?? id;
const partName = (id: string) => content.parts.find((p) => p.id === id)?.name;

/** Mission 1 Build screen: pick one part per slot and see the effect on each surface (FR-1–FR-3, FR-37). */
export function BuildScreen({
  selection,
  onSelectionChange,
  onTestDrive,
  onExit,
}: {
  selection: BuildSelection;
  onSelectionChange: (selection: BuildSelection) => void;
  onTestDrive: () => void;
  /** Back to the garage (the demo's first screen), when this screen is opened from there. */
  onExit?: () => void;
}) {
  const owned = ownedPartIds(content);
  const columns = partEffects(content, selection, MISSION_1_SURFACE_IDS);
  const { asphaltRouteLengthM, sandRouteLengthM, timeLimitS } = content.missions.mission1;

  const rows: { label: string; value: (i: number) => string }[] = [
    { label: 'Mass', value: (i) => formatMass(columns[i]!.quantities.massKg) },
    { label: 'Weight', value: (i) => formatForce(columns[i]!.quantities.weightN) },
    { label: 'Rolling friction', value: (i) => formatForce(columns[i]!.quantities.rollingForceN) },
    { label: 'Grip limit', value: (i) => formatForce(columns[i]!.quantities.gripLimitN) },
    { label: 'Driving force', value: (i) => formatForce(columns[i]!.driveForceMaxN) },
    { label: 'Top speed', value: (i) => formatSpeed(columns[i]!.quantities.topSpeedMps) },
    { label: 'Max acceleration', value: (i) => formatAcceleration(columns[i]!.quantities.maxAccelerationMps2) },
    { label: 'Max braking', value: (i) => formatAcceleration(columns[i]!.quantities.maxBrakingMps2) },
  ];

  return (
    <main className="build">
      <header className="build-header">
        <span className="brand">ROVEM</span>
        <span>Mission 1 · Motion Trial · Build</span>
        {onExit && (
          <button type="button" className="unlock" onClick={onExit}>
            Back to garage
          </button>
        )}
      </header>

      <div className="build-body">
        <section className="build-rover" aria-label="Your rover">
          <h2>Your rover</h2>
          <div className="preview">3D rover preview (placeholder)</div>
          <ul>
            <li>Chassis: {partName(selection.chassisId)}</li>
            <li>Wheels: {partName(selection.wheelsId)}</li>
            <li>Motor: {partName(selection.motorId)}</li>
          </ul>
          <p>
            Mission 1 routes: {surfaceName('asphalt').toLowerCase()} {asphaltRouteLengthM} m, {surfaceName('sand').toLowerCase()}{' '}
            shortcut {sandRouteLengthM} m
          </p>
          <p>Time limit {timeLimitS} s · starts from rest (0 m/s)</p>
        </section>

        <section className="build-parts" aria-label="Parts">
          <h2>Choose one part per slot</h2>
          {SLOTS.map(({ slot, title, key }) => (
            <div key={slot} className="slot">
              <h3>{title}</h3>
              <div className="part-row">
                {content.parts
                  .filter((p) => p.slot === slot)
                  .map((part) => {
                    const isOwned = owned.has(part.id);
                    const isSelected = selection[key] === part.id;
                    return (
                      <div key={part.id} className={`part${isSelected ? ' selected' : ''}${isOwned ? '' : ' locked'}`}>
                        <button
                          type="button"
                          disabled={!isOwned}
                          aria-pressed={isSelected}
                          onClick={() => onSelectionChange({ ...selection, [key]: part.id })}
                        >
                          <strong>{part.name}</strong>
                          <span>{partDetail(part)}</span>
                        </button>
                        {!isOwned && (
                          <button type="button" className="unlock" disabled title="Unlocking arrives with saving (M7)">
                            Unlock · {part.unlockCost}
                          </button>
                        )}
                        {isSelected && <span className="tag">{part.startsUnlocked ? 'Selected · starting part' : 'Selected'}</span>}
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
          {/* +5 is the confirmed unlock-question reward (SRS 3.8); move it into content in M9, when the button works. */}
          <button type="button" className="unlock-question" disabled title="Unlock questions arrive in M9">
            Answer an unlock question · +5 Knowledge
          </button>
        </section>

        <section className="build-effects" aria-label="Part effects">
          <h2>Part effects</h2>
          <table>
            <thead>
              <tr>
                <th />
                {columns.map((c) => (
                  <th key={c.surfaceId}>{surfaceName(c.surfaceId)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {columns.map((c, i) => (
                    <td key={c.surfaceId}>{row.value(i)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">
            Values update when a part changes. They come from the same physics model that drives the run. Surfaces shown are the
            ones in this mission.
          </p>
          <button type="button" className="test-drive" onClick={onTestDrive}>
            Test drive (temporary, M4)
          </button>
          <button type="button" className="continue" disabled title="Questions arrive in M6">
            Continue to questions
          </button>
        </section>
      </div>
    </main>
  );
}

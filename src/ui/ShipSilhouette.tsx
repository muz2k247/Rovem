import { partsRecovered, type ShipPartState, type ShipPartView } from '../game/ship.ts';
import './ship.css';

// The ship on the Levels screen (SHOWCASE_PLAN §12): a side view with five parts. A recovered part is lit, the part to find
// next is outlined, and the part of a level that is not built yet is dashed and dim. The list beside it says the same in words.

/** One path for each part, in the order of `levelText.json` → ship.parts: brakes, thruster, lift engine, floats, clamps. */
const PART_SHAPES: readonly string[] = [
  'M92 100 L100 100 L108 121 L82 121 Z M186 100 L194 100 L202 121 L176 121 Z',
  'M42 50 L16 40 L16 90 L42 80 Z',
  'M128 100 L168 100 L164 114 L132 114 Z',
  'M84 31 Q84 14 110 14 Q136 14 136 31 Z M170 31 Q170 14 196 14 Q222 14 222 31 Z',
  'M288 52 L314 42 L314 54 L296 61 Z M288 78 L314 88 L314 76 L296 69 Z',
];

const STATE_WORDS: Record<ShipPartState, string> = { recovered: 'recovered', open: 'to find', locked: 'locked' };

/** Just the ship's outline with its parts (R14, the ship-part moment): the part of `justLevelId` pulses, the others show as saved. */
export function ShipOutline({ parts, justLevelId }: { parts: readonly ShipPartView[]; justLevelId: string }) {
  return (
    <svg className="ship ship-outline" viewBox="0 0 330 130" role="img" aria-label={`Your ship: ${partsRecovered(parts)} of ${parts.length} parts recovered`}>
      <path className="ship-hull" d="M42 55 Q42 30 82 30 L222 30 Q288 36 304 65 Q288 94 222 100 L82 100 Q42 100 42 75 Z" />
      <circle className="ship-window" cx="232" cy="62" r="9" />
      {parts.map((p, i) => (
        <path key={p.levelId} className={`ship-part ship-part-${p.state}${p.levelId === justLevelId ? ' ship-part-just' : ''}`} d={PART_SHAPES[i] ?? ''} />
      ))}
    </svg>
  );
}

export function ShipSilhouette({ parts }: { parts: readonly ShipPartView[] }) {
  return (
    <section className="ship-panel" aria-label="Your ship">
      <svg className="ship" viewBox="0 0 330 130" role="img" aria-label={`Your ship: ${partsRecovered(parts)} of ${parts.length} parts recovered`}>
        <path className="ship-hull" d="M42 55 Q42 30 82 30 L222 30 Q288 36 304 65 Q288 94 222 100 L82 100 Q42 100 42 75 Z" />
        <circle className="ship-window" cx="232" cy="62" r="9" />
        {parts.map((p, i) => (
          <path key={p.levelId} className={`ship-part ship-part-${p.state}`} d={PART_SHAPES[i] ?? ''} />
        ))}
      </svg>
      <div className="ship-text">
        <h2>Your ship</h2>
        <p className="ship-count">
          {partsRecovered(parts)} of {parts.length} parts recovered
        </p>
        <ul className="ship-list">
          {parts.map((p) => (
            <li key={p.levelId} className={`ship-item ship-item-${p.state}`}>
              <span className="ship-dot" aria-hidden="true" />
              {p.name} <span className="ship-state">({STATE_WORDS[p.state]})</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

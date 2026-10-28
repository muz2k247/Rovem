import { useEffect, useRef, useState } from 'react';
import { partsRecovered, type ShipPartState, type ShipPartView } from '../game/ship.ts';
import { SHIP_PART_ORDER, type ShipPartLook } from '../render/shipModel.ts';
import { drawShipPortrait } from '../render/shipPortrait.ts';
import './ship.css';

// The ship on the Levels screen (SHOWCASE_PLAN §12; the 3D model since R15): the same model as the wreck and the launch, with each
// part lit when its level is finished, outlined when it is the one to find next, and dim when its level is not built yet. The list
// beside it says the same in words. Without WebGL the drawing falls back to a flat outline.

/** One path for each part, in the order of `levelText.json` → ship.parts: brakes, thruster, lift engine, floats, clamps. The outline is a front view of the standing ship. */
const PART_SHAPES: readonly string[] = [
  'M20 176 L44 176 L44 184 L20 184 Z M116 176 L140 176 L140 184 L116 184 Z',
  'M52 72 L60 72 L60 82 L52 82 Z M100 72 L108 72 L108 82 L100 82 Z',
  'M62 168 L72 168 L72 180 L62 180 Z M88 168 L98 168 L98 180 L88 180 Z',
  'M22 96 Q22 88 30 88 Q38 88 38 96 L38 132 Q38 140 30 140 Q22 140 22 132 Z M122 96 Q122 88 130 88 Q138 88 138 96 L138 132 Q138 140 130 140 Q122 140 122 132 Z',
  'M70 14 L76 6 L84 6 L90 14 L84 16 L76 16 Z',
];
const HULL_PATH = 'M60 168 L56 120 Q54 70 68 40 Q74 24 80 14 Q86 24 92 40 Q106 70 104 120 L100 168 Z M56 150 L36 178 M104 150 L124 178';

const STATE_WORDS: Record<ShipPartState, string> = { recovered: 'recovered', open: 'to find', locked: 'locked' };

function Outline({ parts, justLevelId, className }: { parts: readonly ShipPartView[]; justLevelId?: string; className: string }) {
  return (
    <svg className={className} viewBox="0 0 160 200" role="img" aria-label={`Your ship: ${partsRecovered(parts)} of ${parts.length} parts recovered`}>
      <path className="ship-hull" d={HULL_PATH} />
      <circle className="ship-window" cx="80" cy="64" r="6" />
      {parts.map((p, i) => (
        <path key={p.levelId} className={`ship-part ship-part-${p.state}${p.levelId === justLevelId ? ' ship-part-just' : ''}`} d={PART_SHAPES[i] ?? ''} />
      ))}
    </svg>
  );
}

/** Just the ship's outline with its parts (R14, the ship-part moment): the part of `justLevelId` pulses, the others show as saved. It is a flat drawing because the level scene behind it already holds the page's graphics context. */
export function ShipOutline({ parts, justLevelId }: { parts: readonly ShipPartView[]; justLevelId: string }) {
  return <Outline parts={parts} justLevelId={justLevelId} className="ship ship-outline" />;
}

/** The 3D portrait: drawn once when the parts' states change, then the graphics context is handed back. */
function ShipPortrait({ parts }: { parts: readonly ShipPartView[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const key = parts.map((p) => p.state).join(',');
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const looks = {} as Record<(typeof SHIP_PART_ORDER)[number], ShipPartLook>;
    SHIP_PART_ORDER.forEach((part, i) => {
      looks[part] = parts[i]?.state ?? 'locked';
    });
    const stop = drawShipPortrait(host, looks);
    if (!stop) {
      setFailed(true);
      return;
    }
    return stop;
    // `key` stands for the parts' states: redraw only when one changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (failed) return <Outline parts={parts} className="ship" />;
  return <div className="ship ship-portrait" ref={hostRef} role="img" aria-label={`Your ship: ${partsRecovered(parts)} of ${parts.length} parts recovered`} />;
}

export function ShipSilhouette({ parts }: { parts: readonly ShipPartView[] }) {
  return (
    <section className="ship-panel" aria-label="Your ship">
      <ShipPortrait parts={parts} />
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

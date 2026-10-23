import { describe, expect, it } from 'vitest';
import { emptyLevelProgress, recordLevelResult } from '../save/levelProgress.ts';
import { levelText } from './level/text.ts';
import { launchReady, partsRecovered, shipParts } from './ship.ts';

describe('the ship (SHOWCASE_PLAN §12)', () => {
  const parts = levelText.ship.parts;

  it('has five parts, one for each Showcase level, in play order', () => {
    expect(parts.map((p) => p.levelId)).toEqual(['crash-site', 'geyser-canyon', 'crater-field', 'the-crossing', 'iron-ridge']);
    expect(parts.map((p) => p.name)).toEqual(['Landing brakes', 'Thruster', 'Lift engine', 'Splashdown floats', 'Docking clamps']);
  });

  it('with nothing finished: all five parts are open (R7 built the last two levels)', () => {
    const v = shipParts(parts, emptyLevelProgress());
    expect(v.map((p) => p.state)).toEqual(['open', 'open', 'open', 'open', 'open']);
    expect(partsRecovered(v)).toBe(0);
  });

  it('lights a part once its level is finished', () => {
    let p = recordLevelResult(emptyLevelProgress(), 'crash-site', { stars: 1, timeS: 95 });
    p = recordLevelResult(p, 'the-crossing', { stars: 3, timeS: 80 });
    const v = shipParts(parts, p);
    expect(v.map((x) => x.state)).toEqual(['recovered', 'open', 'open', 'recovered', 'open']);
    expect(partsRecovered(v)).toBe(2);
  });

  it('keeps a part of a level that is not built locked even if its old level was finished', () => {
    const unbuilt = parts.map((x) => (x.levelId === 'the-crossing' || x.levelId === 'iron-ridge' ? { ...x, built: false } : x));
    const p = recordLevelResult(emptyLevelProgress(), 'the-crossing', { stars: 3, timeS: 80 });
    expect(shipParts(unbuilt, p).map((x) => x.state)).toEqual(['open', 'open', 'open', 'locked', 'locked']);
  });

  it('lights a built part for every finished level (the rule holds for later rounds)', () => {
    const built = parts.map((x) => ({ ...x, built: true }));
    const p = recordLevelResult(recordLevelResult(emptyLevelProgress(), 'crash-site', { stars: 2, timeS: 90 }), 'geyser-canyon', { stars: 1, timeS: 100 });
    expect(shipParts(built, p).map((x) => x.state)).toEqual(['recovered', 'recovered', 'open', 'open', 'open']);
  });

  it('an unfinished run (0 stars) lights nothing', () => {
    const p = recordLevelResult(emptyLevelProgress(), 'crash-site', { stars: 0, timeS: 90 });
    expect(partsRecovered(shipParts(parts, p))).toBe(0);
  });

  it('the launch opens only when all five parts are recovered (R8)', () => {
    let p = emptyLevelProgress();
    for (const [i, part] of parts.entries()) {
      expect(launchReady(shipParts(parts, p))).toBe(false);
      p = recordLevelResult(p, part.levelId, { stars: 1, timeS: 100 + i });
    }
    expect(launchReady(shipParts(parts, p))).toBe(true);
    expect(launchReady([])).toBe(false);
    const unbuilt = parts.map((x) => (x.levelId === 'iron-ridge' ? { ...x, built: false } : x));
    expect(launchReady(shipParts(unbuilt, p))).toBe(false);
  });
});

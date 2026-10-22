import { describe, expect, it } from 'vitest';
import { emptyLevelProgress, recordLevelResult } from '../save/levelProgress.ts';
import { levelText } from './level/text.ts';
import { partsRecovered, shipParts } from './ship.ts';

describe('the ship (SHOWCASE_PLAN §12)', () => {
  const parts = levelText.ship.parts;

  it('has five parts, one for each Showcase level, in play order', () => {
    expect(parts.map((p) => p.levelId)).toEqual(['crash-site', 'geyser-canyon', 'crater-field', 'the-crossing', 'iron-ridge']);
    expect(parts.map((p) => p.name)).toEqual(['Landing brakes', 'Thruster', 'Lift engine', 'Splashdown floats', 'Docking clamps']);
  });

  it('with nothing finished: the built levels’ parts are open, the others are locked', () => {
    const v = shipParts(parts, emptyLevelProgress());
    expect(v.map((p) => p.state)).toEqual(['open', 'open', 'locked', 'locked', 'locked']);
    expect(partsRecovered(v)).toBe(0);
  });

  it('lights a part once its level is finished, and keeps a part of an unbuilt level locked even if its old level was finished', () => {
    let p = recordLevelResult(emptyLevelProgress(), 'crash-site', { stars: 1, timeS: 95 });
    p = recordLevelResult(p, 'crater-field', { stars: 3, timeS: 80 });
    const v = shipParts(parts, p);
    expect(v.map((x) => x.state)).toEqual(['recovered', 'open', 'locked', 'locked', 'locked']);
    expect(partsRecovered(v)).toBe(1);
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
});

import { describe, expect, it } from 'vitest';
import { builtLevelIds, loadLevelDef } from './levels.ts';
import { testLevelRaw } from './testLevel.ts';
import { LEVEL_IDS } from './types.ts';

describe('level registry', () => {
  it('the level ids are exactly these, in play order (Crash Site replaced First Tracks and Ring Road in R3)', () => {
    expect(LEVEL_IDS).toEqual(['crash-site', 'geyser-canyon', 'crater-field', 'the-crossing', 'polar-pass']);
  });

  it('loads and validates a level file, and lists the ones that exist in play order', () => {
    const files = { 'crater-field': { ...testLevelRaw(), id: 'crater-field' }, 'crash-site': testLevelRaw() };
    expect(builtLevelIds(files)).toEqual(['crash-site', 'crater-field']);
    expect(loadLevelDef('crash-site', files).name).toBe('Test level');
  });

  it('refuses an unknown id, a level with no file, and a file under the wrong id', () => {
    expect(() => loadLevelDef('fork-in-the-road', {})).toThrow(/Unknown level/);
    expect(() => loadLevelDef('the-crossing', {})).toThrow(/no level file/);
    expect(() => loadLevelDef('the-crossing', { 'the-crossing': testLevelRaw() })).toThrow(/says "crash-site"/);
  });

  it('every level file that is registered is valid (B4 adds them)', () => {
    for (const id of builtLevelIds()) expect(() => loadLevelDef(id)).not.toThrow();
  });
});

describe('atmosphere', () => {
  it('a level file may only ask for a known look (A8)', () => {
    const raw = { ...testLevelRaw(), atmosphere: 'sunny-day' };
    expect(() => loadLevelDef('crash-site', { 'crash-site': raw })).toThrow(/level\.atmosphere: unknown value "sunny-day"/);
  });
});

describe('stretches (Showcase P6)', () => {
  /** The test level with two more roads on its route, so there is room for up to four stretches. */
  const withStretches = (stretches: unknown[]) => {
    const raw = testLevelRaw() as { roads: unknown[]; route: string[]; stretches?: unknown[] };
    raw.roads.push({ id: 'r3', after: 'bend', segments: [{ kind: 'straight', lengthM: 40 }] }, { id: 'r4', after: 'r3', segments: [{ kind: 'straight', lengthM: 40 }] });
    raw.route.push('r3', 'r4');
    raw.stretches = stretches;
    return { 'crash-site': raw } as const;
  };
  const four = () => [
    { id: 's1', name: 'One', cleanS: 10 },
    { id: 's2', name: 'Two', startsAfterRoad: 'main', cleanS: 10 },
    { id: 's3', name: 'Three', startsAfterRoad: 'bend', cleanS: 10 },
    { id: 's4', name: 'Four', startsAfterRoad: 'r3', cleanS: 10 },
  ];

  it('a level may name none (the v4 levels do), or four to six that follow its route', () => {
    expect(loadLevelDef('crash-site', { 'crash-site': testLevelRaw() }).stretches).toEqual([]);
    expect(loadLevelDef('crash-site', withStretches(four())).stretches.map((s) => s.id)).toEqual(['s1', 's2', 's3', 's4']);
  });

  it('refuses three, or a first stretch that begins after a road', () => {
    expect(() => loadLevelDef('crash-site', withStretches(four().slice(0, 3)))).toThrow(/level\.stretches: a level names 4 to 6 stretches/);
    const first = four();
    first[0] = { ...first[0]!, startsAfterRoad: 'main' } as never;
    expect(() => loadLevelDef('crash-site', withStretches(first))).toThrow(/stretches\[0\]\.startsAfterRoad: the first stretch begins at the start/);
  });

  it('refuses a stretch with no road, a road that is not on the route, and stretches out of route order', () => {
    const noRoad = four();
    delete (noRoad[2] as { startsAfterRoad?: string }).startsAfterRoad;
    expect(() => loadLevelDef('crash-site', withStretches(noRoad))).toThrow(/stretches\[2\]\.startsAfterRoad: expected a road id/);
    const offRoute = four();
    offRoute[3] = { ...offRoute[3]!, startsAfterRoad: 'elsewhere' };
    expect(() => loadLevelDef('crash-site', withStretches(offRoute))).toThrow(/stretches\[3\]\.startsAfterRoad: road "elsewhere" is not on the route/);
    const swapped = four();
    swapped[1] = { ...swapped[1]!, startsAfterRoad: 'bend' };
    swapped[2] = { ...swapped[2]!, startsAfterRoad: 'main' };
    expect(() => loadLevelDef('crash-site', withStretches(swapped))).toThrow(/stretches must follow the route in order/);
  });

  it('refuses a duplicate id and a clean time of 0', () => {
    const dup = four();
    dup[1] = { ...dup[1]!, id: 's1' };
    expect(() => loadLevelDef('crash-site', withStretches(dup))).toThrow(/duplicate id "s1"/);
    const zero = four();
    zero[0] = { ...zero[0]!, cleanS: 0 };
    expect(() => loadLevelDef('crash-site', withStretches(zero))).toThrow(/cleanS: expected a number above 0/);
  });
});

describe('barrier looks (Showcase R3)', () => {
  const withBarrier = (look?: unknown) => {
    const raw = testLevelRaw() as { barriers?: unknown[] };
    raw.barriers = [{ id: 'b', xM: 50, zM: 0, headingDeg: 0, lengthM: 2, widthM: 2, ...(look === undefined ? {} : { look }) }];
    return { 'crash-site': raw } as const;
  };

  it('a barrier may be drawn as a boulder; the box the physics uses is the same', () => {
    expect(loadLevelDef('crash-site', withBarrier('boulder')).barriers[0]!.look).toBe('boulder');
    expect(loadLevelDef('crash-site', withBarrier()).barriers[0]!.look).toBeUndefined();
  });

  it('refuses any other look', () => {
    expect(() => loadLevelDef('crash-site', withBarrier('crate'))).toThrow(/barriers\[0\]\.look: expected "boulder"/);
  });
});

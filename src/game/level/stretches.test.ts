import { describe, expect, it } from 'vitest';
import { createStretchTracker } from './stretches.ts';
import type { StretchDef } from './types.ts';

const defs: StretchDef[] = [
  { id: 'a', name: 'A', cleanS: 10 },
  { id: 'b', name: 'B', startsAfterRoad: 'r1', cleanS: 10 },
  { id: 'c', name: 'C', startsAfterRoad: 'r2', cleanS: 10 },
];

describe('stretch tracker (P6)', () => {
  it('times each stretch from the gate that opens it to the next gate, and the last one to the part', () => {
    const t = createStretchTracker(defs);
    t.start(0);
    t.enter(1, 12, 15);
    t.enter(2, 20.5, 14);
    t.finish(31, 16);
    const r = t.records(31);
    expect(r.map((x) => x.timeS)).toEqual([12, 8.5, 10.5]);
    expect(r.map((x) => x.entrySpeedMps)).toEqual([0, 15, 14]);
    expect(r.map((x) => x.exitSpeedMps)).toEqual([15, 14, 16]);
  });

  it('can only enter the next stretch, once: a gate crossed again after a respawn changes nothing', () => {
    const t = createStretchTracker(defs);
    t.start(0);
    t.enter(2, 5, 10); // skipping one is not allowed
    expect(t.current).toBe(0);
    t.enter(1, 6, 12);
    t.enter(1, 30, 3); // back at the gate after a crash
    expect(t.records(40)[1]!.enteredAtS).toBe(6);
    expect(t.records(40)[1]!.entrySpeedMps).toBe(12);
  });

  it('counts a crash, and the drive back, against the stretch the rover was in when it crashed', () => {
    const t = createStretchTracker(defs);
    t.start(0);
    t.enter(1, 10, 15);
    t.addCrash();
    // back at the checkpoint, behind the gate of stretch B: still stretch B until the gate of C is crossed
    t.addGripLimit(0.5, 1000);
    t.enter(2, 25, 14);
    const r = t.records(25);
    expect(r[1]!.causes.crashes).toBe(1);
    expect(r[1]!.timeS).toBe(15);
    expect(r[0]!.causes.crashes).toBe(0);
  });

  it('adds up the causes of the stretch the rover is in', () => {
    const t = createStretchTracker(defs);
    t.start(0);
    t.addGripLimit(0.25, 1300);
    t.addGripLimit(0.25, 1310, 'sand');
    t.addRollingBack(0.5);
    t.addScrape(2.5);
    t.addScrape(1);
    t.addHit(-3);
    t.addBoost();
    t.addSurface('sand', 1, () => ({ frictionN: 245, rockN: 41 }));
    t.addSurface('sand', 1, () => ({ frictionN: 999, rockN: 999 }));
    const c = t.records(2)[0]!.causes;
    expect(c.gripLimitS).toBe(0.5);
    expect(c.gripLimitN).toBe(1310);
    expect(c.gripSurfaceId).toBe('sand'); // the ground of the last moment counted
    expect(c.rollingBackS).toBe(0.5);
    expect(c.scrapes).toBe(2);
    expect(c.scrapeSpeedLostMps).toBe(3.5);
    expect(c.hits).toBe(1);
    expect(c.hitSpeedChangeMps).toBe(-3);
    expect(c.boosts).toBe(1);
    expect(c.surfaceS).toEqual({ sand: 2 });
    expect(c.surfaceInfo).toEqual({ sand: { frictionN: 245, rockN: 41 } }); // read once, the first time
  });

  it('a stretch never entered has no time and no exit speed; a level with no stretches records nothing', () => {
    const t = createStretchTracker(defs);
    t.start(0);
    const r = t.records(5);
    expect(r[2]!.enteredAtS).toBeNull();
    expect(r[2]!.timeS).toBe(0);
    expect(r[2]!.exitSpeedMps).toBeNull();
    const none = createStretchTracker([]);
    none.start(0);
    none.addCrash();
    expect(none.records(5)).toEqual([]);
    expect(none.current).toBe(-1);
  });
});

import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { createLevelWorld } from './world.ts';
import { validateLevelDef } from './schema.ts';
import { testLevelRaw, SURFACE_IDS } from './testLevel.ts';

const DEG = Math.PI / 180;
const B1 = { id: 'b1', xM: 100.5, zM: 0, headingDeg: 0, lengthM: 1, widthM: 6 };
const world = (patch: Record<string, unknown> = {}) => createLevelWorld(validateLevelDef({ ...testLevelRaw(), ...patch }, SURFACE_IDS), content);

describe('level schema', () => {
  it('accepts the test level and fills the optional lists', () => {
    const def = validateLevelDef({ ...testLevelRaw(), hills: undefined, ridges: undefined }, SURFACE_IDS);
    expect(def.hills).toEqual([]);
    expect(def.ridges).toEqual([]);
    expect(def.samples).toHaveLength(3);
  });

  it('rejects an unknown level id, a wrong sample count, an unknown road and an unknown surface', () => {
    expect(() => validateLevelDef({ ...testLevelRaw(), id: 'fork-in-the-road' }, SURFACE_IDS)).toThrow(/unknown level id/);
    expect(() => validateLevelDef({ ...testLevelRaw(), samples: [] }, SURFACE_IDS)).toThrow(/exactly 3 samples/);
    expect(() => validateLevelDef({ ...testLevelRaw(), route: ['nope'] }, SURFACE_IDS)).toThrow(/unknown road/);
    expect(() => validateLevelDef({ ...testLevelRaw(), surfaceZones: [{ surfaceId: 'lava', polygon: [{ xM: 0, zM: 0 }, { xM: 1, zM: 0 }, { xM: 1, zM: 1 }] }] }, SURFACE_IDS)).toThrow(/unknown surface/);
  });

  it('rejects a road with no start and a crater with a ramp steeper than its wall', () => {
    expect(() => validateLevelDef({ ...testLevelRaw(), roads: [{ id: 'main', segments: [{ kind: 'straight', lengthM: 10 }] }] }, SURFACE_IDS)).toThrow(/start/);
    expect(() =>
      validateLevelDef({ ...testLevelRaw(), craters: [{ xM: 0, zM: 0, floorRadiusM: 3, depthM: 5, wallAngleDeg: 12, rampAngleDeg: 25, rampHeadingDeg: 0 }] }, SURFACE_IDS),
    ).toThrow(/steeper/);
  });
});

describe('roads and walls', () => {
  it('builds a straight road and an arc of the right length and radius', () => {
    const w = world();
    const main = w.roadById('main');
    expect(main.line.lengthM).toBeCloseTo(300, 3);
    const bend = w.roadById('bend');
    // A 90° bend of radius 25 m is 25 × π/2 = 39.27 m long and turns the heading to +90° (left).
    expect(bend.line.lengthM).toBeCloseTo(25 * (Math.PI / 2), 1);
    expect(bend.end.headingDeg).toBeCloseTo(90, 6);
    expect(bend.end.xM).toBeCloseTo(300 + 25, 1);
    expect(bend.end.zM).toBeCloseTo(25, 1);
  });

  it('a right turn bends to negative z', () => {
    const w = world({ roads: [{ id: 'main', start: { xM: 0, zM: 0, headingDeg: 0 }, segments: [{ kind: 'arc', radiusM: 20, angleDeg: -90 }] }], route: ['main'] });
    const end = w.roadById('main').end;
    expect(end.xM).toBeCloseTo(20, 1);
    expect(end.zM).toBeCloseTo(-20, 1);
  });

  it('is on the road inside half the width, on run-off to 4 m beyond, and a wall past that', () => {
    const w = world();
    expect(w.onRoadAt(50, 4.9)).toBeDefined();
    expect(w.onRoadAt(50, 5.1)).toBeUndefined();
    expect(w.roadAt(50, 8.9)).toBeDefined();
    expect(w.roadAt(50, 9.1)).toBeUndefined();
  });

  it('a rover in the middle is clear; one whose corner is past the run-off hits the wall', () => {
    const w = world();
    expect(w.hit(50, 0, 0)).toBeUndefined();
    const wall = w.hit(50, 8.5, 0); // the left corners are at z = 9.35
    expect(wall?.kind).toBe('wall');
    expect(w.hit(50, 7.9, 0)).toBeUndefined(); // 7.9 + 0.85 = 8.75 < 9
  });

  it('a wall hit reports the direction of the edge, which way is out, and how far the corner is past it', () => {
    const w = world();
    const wall = w.hit(50, 8.5, 0);
    if (wall?.kind !== 'wall') throw new Error('expected a wall');
    // The road runs along x with 9 m of reach each side; the worst corner is at z = 9.35: 0.35 m past the left wall.
    expect(wall.contact.depthM).toBeCloseTo(0.35, 9);
    expect(wall.contact.outwardRad).toBeCloseTo(Math.PI / 2, 9); // out is to the left (+z)
    expect(Math.abs(Math.cos(wall.contact.edgeRad))).toBeCloseTo(1, 9); // the edge runs along x
    const right = w.hit(50, -8.5, 0);
    if (right?.kind !== 'wall') throw new Error('expected a wall');
    expect(right.contact.outwardRad).toBeCloseTo(-Math.PI / 2, 9);
  });

  it('a barrier crashes the rover only when the footprint overlaps it', () => {
    const w = world({ barriers: [B1] });
    expect(w.hit(98, 0, 0)).toBeUndefined();
    const hit = w.hit(101, 0, 0); // footprint spans x 99 to 101, the barrier spans x 100 to 101
    expect(hit).toEqual({ kind: 'barrier', barrierId: 'b1' });
    expect(w.hit(99.5, 0, 0)).toBeUndefined(); // rear at 97.5, front at 99.5: touching nothing
  });

  it('a barrier turned 90° is tested in its own frame', () => {
    const w = world({ barriers: [{ id: 'b2', xM: 150, zM: 0, headingDeg: 90, lengthM: 6, widthM: 1 }] });
    // Turned 90°: it is 6 m across x... its long side runs along z; its short side (1 m) lies along x.
    expect(w.hit(150.4, 0, 0)).toEqual({ kind: 'barrier', barrierId: 'b2' });
    expect(w.hit(149, 0, 0)).toBeUndefined();
  });

  it('measures progress along the route', () => {
    const w = world();
    expect(w.progressAt(150, 2).alongM).toBeCloseTo(150, 3);
    expect(w.progressAt(150, 2).fraction).toBeCloseTo(150 / w.route.lengthM, 6);
  });

  it('knows the bend radius under a road position', () => {
    const w = world();
    const bend = w.roadById('bend');
    expect(w.curveRadiusAt(bend, 10)).toEqual({ radiusM: 25, turn: 1 });
    expect(w.curveRadiusAt(w.roadById('main'), 10)).toBeUndefined();
  });
});

describe('ground height and slope', () => {
  it('a hill peaks at its centre and is flat beyond its radius; its steepest slope is h π ÷ (2 r)', () => {
    const w = world({ hills: [{ xM: 100, zM: 0, radiusM: 60, heightM: 4 }] });
    expect(w.heightM(100, 0)).toBeCloseTo(4, 9);
    expect(w.heightM(160, 0)).toBeCloseTo(0, 9);
    expect(w.heightM(200, 0)).toBe(0);
    // Steepest at half the radius: tan θ = 4 π ÷ 120 = 0.1047.
    expect(Math.tan(w.slopeRad(70, 0, 0))).toBeCloseTo((4 * Math.PI) / 120, 3);
  });

  it('a ridge climbs at its rise angle, holds its top, and falls at its fall angle', () => {
    const w = world({ ridges: [{ xM: 100, zM: 0, headingDeg: 0, riseAngleDeg: 30, riseLengthM: 20, topLengthM: 10, fallAngleDeg: 30, widthM: 10 }] });
    expect(w.slopeRad(110, 0, 0) / DEG).toBeCloseTo(30, 1);
    expect(w.slopeRad(125, 0, 0)).toBeCloseTo(0, 6);
    expect(w.slopeRad(145, 0, 0) / DEG).toBeCloseTo(-30, 1);
    expect(w.heightM(125, 0)).toBeCloseTo(20 * Math.tan(30 * DEG), 6);
    expect(w.heightM(125, 8)).toBe(0); // beside the ridge
  });

  it('a slope seen the other way round (driving the opposite way) has the opposite sign', () => {
    const w = world({ ridges: [{ xM: 100, zM: 0, headingDeg: 0, riseAngleDeg: 30, riseLengthM: 20, topLengthM: 10, fallAngleDeg: 30, widthM: 10 }] });
    expect(w.slopeRad(110, 0, Math.PI) / DEG).toBeCloseTo(-30, 1);
  });

  it('a crater is 5 m deep with a 25° wall one way and a 12° ramp the other', () => {
    const w = world({ craters: [{ xM: 100, zM: 0, floorRadiusM: 8, depthM: 5, wallAngleDeg: 25, rampAngleDeg: 12, rampHeadingDeg: 0 }] });
    expect(w.heightM(100, 0)).toBe(-5);
    // The ramp side (+x) climbs at 12°; the wall side (−x) at 25°. The rover drives out of the crater towards the rim.
    expect(w.slopeRad(100 + 8 + 10, 0, 0) / DEG).toBeCloseTo(12, 1);
    expect(w.slopeRad(100 - 8 - 4, 0, Math.PI) / DEG).toBeCloseTo(25, 1);
    // The rim is level with the ground around it.
    expect(w.heightM(100 + 8 + 5 / Math.tan(12 * DEG) + 1, 0)).toBe(0);
    expect(w.heightM(100 - 8 - 5 / Math.tan(25 * DEG) - 1, 0)).toBe(0);
  });

  it('driving down into a crater and back out: the slope signs follow the direction of motion', () => {
    const w = world({ craters: [{ xM: 100, zM: 0, floorRadiusM: 8, depthM: 5, wallAngleDeg: 25, rampAngleDeg: 12, rampHeadingDeg: 180 }] });
    // Ramp on the −x side: entering from the west goes down it (negative slope).
    expect(w.slopeRad(100 - 8 - 10, 0, 0)).toBeLessThan(0);
    // Leaving to the east climbs the steep wall.
    expect(w.slopeRad(100 + 8 + 4, 0, 0) / DEG).toBeCloseTo(25, 1);
  });
});

describe('surfaces, water and gravity', () => {
  it('the road, its run-off, a surface patch and the riverbed give the right surface', () => {
    const w = world({
      surfaceZones: [{ surfaceId: 'mud', polygon: [{ xM: 40, zM: -3 }, { xM: 60, zM: -3 }, { xM: 60, zM: 3 }, { xM: 40, zM: 3 }] }],
      water: [{ id: 'river', depthM: 0.5, polygon: [{ xM: 200, zM: -6 }, { xM: 210, zM: -6 }, { xM: 210, zM: 6 }, { xM: 200, zM: 6 }] }],
    });
    expect(w.surfaceIdAt(10, 0)).toBe('asphalt');
    expect(w.surfaceIdAt(10, 6)).toBe('sand'); // run-off
    expect(w.surfaceIdAt(50, 0)).toBe('mud');
    expect(w.surfaceIdAt(205, 0)).toBe('sand'); // riverbed
    expect(w.waterDepthM(205, 0)).toBe(0.5);
    expect(w.waterDepthM(10, 0)).toBe(0);
  });

  it('a road can choose its own run-off surface', () => {
    const w = world({ roads: [{ id: 'main', runoffSurfaceId: 'mud', start: { xM: 0, zM: 0, headingDeg: 0 }, segments: [{ kind: 'straight', lengthM: 100 }] }], route: ['main'] });
    expect(w.surfaceIdAt(10, 6)).toBe('mud');
  });

  it('gravity zones give the run multipliers', () => {
    const w = world({ gravityZones: [{ id: 'z', kind: 'low', polygon: [{ xM: 20, zM: -6 }, { xM: 40, zM: -6 }, { xM: 40, zM: 6 }, { xM: 20, zM: 6 }] }] });
    expect(w.gravityKindAt(30, 0)).toBe('low');
    expect(w.gravityMultiplierAt(30, 0)).toBe(0.5);
    expect(w.gravityMultiplierAt(10, 0)).toBe(1);
  });
});

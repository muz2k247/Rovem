import { describe, expect, it } from 'vitest';
import { content, validateContent } from './index.ts';
import rawConstants from './constants.json';
import rawSurfaces from './surfaces.json';
import rawParts from './parts.json';
import rawPowerUps from './powerUps.json';
import rawMissions from './missions.json';
import rawTestCourse from './levels/testCourse.json';
import rawRun from './run.json';
import rawRunChunks from './runChunks.json';
import rawRunText from './runText.json';

// A deep copy of the shipped data that a test can break on purpose.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;
const raw = (): Raw =>
  structuredClone({
    constants: rawConstants,
    surfaces: rawSurfaces,
    parts: rawParts,
    powerUps: rawPowerUps,
    missions: rawMissions,
    levels: { testCourse: rawTestCourse },
    run: rawRun,
    runChunks: rawRunChunks,
    runText: rawRunText,
  });

describe('content data', () => {
  it('loads the Inputs sheet values', () => {
    expect(content.constants.stepsPerSecond).toBe(120);
    expect(content.constants.maxBrakeForceN).toBe(1500);
    expect(content.constants.turnRateDegPerS).toBe(60);
    expect(content.surfaces.map((s) => s.id)).toEqual(['asphalt', 'sand', 'ice', 'mud', 'oil']);
    expect(content.parts).toHaveLength(9);
    expect(content.powerUps).toHaveLength(6);
    expect(content.missions.mission3.brakeLineBeforeZoneEndM).toBe(23);
  });

  it('gives exactly the three starting parts a cost of 0 and the rest 15', () => {
    for (const p of content.parts) {
      expect(p.unlockCost).toBe(p.startsUnlocked ? 0 : 15);
    }
    expect(content.parts.filter((p) => p.startsUnlocked).map((p) => p.id)).toEqual([
      'chassis-standard',
      'wheels-all-terrain',
      'motor-medium',
    ]);
  });

  it('accepts the shipped data', () => {
    expect(() => validateContent(raw())).not.toThrow();
  });

  it('rejects a missing number, with the path in the message', () => {
    const r = raw();
    delete r.constants.maxBrakeForceN;
    expect(() => validateContent(r)).toThrow(/constants\.maxBrakeForceN/);
  });

  it('rejects a motor with no top speed', () => {
    const r = raw();
    delete r.parts[7].topSpeedMps;
    expect(() => validateContent(r)).toThrow(/topSpeedMps/);
  });

  it('rejects a non-positive grip and a bad slot', () => {
    const a = raw();
    a.surfaces[0].grip = 0;
    expect(() => validateContent(a)).toThrow(/grip/);
    const b = raw();
    b.parts[0].slot = 'bumper';
    expect(() => validateContent(b)).toThrow(/slot/);
  });

  it('rejects duplicate ids and unknown power-up variables', () => {
    const a = raw();
    a.parts[1].id = a.parts[0].id;
    expect(() => validateContent(a)).toThrow(/duplicate/i);
    const b = raw();
    b.powerUps[0].variable = 'colour';
    expect(() => validateContent(b)).toThrow(/variable/);
  });

  it('loads the rover width and the reverse top speed fraction', () => {
    expect(content.constants.roverWidthM).toBe(1.7);
    expect(content.constants.reverseTopSpeedFraction).toBe(0.5);
  });

  it('rejects the old cost name', () => {
    const r = raw();
    delete r.parts[0].unlockCost;
    r.parts[0].knowledgeCost = 15;
    expect(() => validateContent(r)).toThrow(/unlockCost/);
  });
});

describe('level data (DESIGN §8)', () => {
  const level = content.levels.testCourse;
  const bad = (edit: (l: Raw) => void) => {
    const r = raw();
    edit(r.levels.testCourse);
    return () => validateContent(r);
  };

  it('loads the test course with every layer', () => {
    expect(level.name).toBe('Test course');
    expect(level.surfaces[0]!.surfaceId).toBe('asphalt');
    expect(level.props.length).toBeGreaterThan(0);
    expect(level.lines.map((l) => l.kind)).toEqual(['start', 'target']);
    expect(level.path.length).toBeGreaterThanOrEqual(2);
    expect(level.hazards).toEqual([]);
    expect(level.modifiers).toEqual([]);
  });

  it('names the bad path: a rock with no size', () => {
    expect(bad((l) => (l.props[1].radiusM = -1))).toThrow(/levels\.testCourse\.props\[1\]\.radiusM/);
  });

  it('names the bad path: an unknown surface or prop kind', () => {
    expect(bad((l) => (l.surfaces[0].surfaceId = 'lava'))).toThrow(/levels\.testCourse\.surfaces\[0\]\.surfaceId.*lava/);
    expect(bad((l) => (l.defaultSurfaceId = 'lava'))).toThrow(/levels\.testCourse\.defaultSurfaceId/);
    expect(bad((l) => (l.props[0].kind = 'tree'))).toThrow(/levels\.testCourse\.props\[0\]\.kind/);
  });

  it('names the bad path: a polygon with too few corners and a point with no number', () => {
    expect(bad((l) => l.surfaces[0].polygon.splice(2))).toThrow(/levels\.testCourse\.surfaces\[0\]\.polygon/);
    expect(bad((l) => delete l.path[1].zM)).toThrow(/levels\.testCourse\.path\[1\]\.zM/);
  });

  it('names the bad path: a path with one point, a bad line, a bad start', () => {
    expect(bad((l) => l.path.splice(1))).toThrow(/levels\.testCourse\.path/);
    expect(bad((l) => (l.lines[1].kind = 'finish'))).toThrow(/levels\.testCourse\.lines\[1\]\.kind/);
    expect(bad((l) => delete l.lines[0].to)).toThrow(/levels\.testCourse\.lines\[0\]\.to/);
    expect(bad((l) => (l.start.headingDeg = 'east'))).toThrow(/levels\.testCourse\.start\.headingDeg/);
  });

  it('names the bad path: a pickup for an unknown power-up', () => {
    expect(bad((l) => l.pickups.push({ powerUpId: 'jetpack', xM: 5, zM: 0, radiusM: 1 }))).toThrow(
      /levels\.testCourse\.pickups\[0\]\.powerUpId/,
    );
    expect(bad((l) => l.pickups.push({ powerUpId: 'motor-boost', xM: 5, zM: 0, radiusM: 1 }))).not.toThrow();
  });

  it('keeps hazards and modifiers empty in the MVP', () => {
    expect(bad((l) => l.hazards.push({ kind: 'cannon' }))).toThrow(/levels\.testCourse\.hazards.*empty/);
    expect(bad((l) => (l.modifiers = undefined))).toThrow(/levels\.testCourse\.modifiers/);
  });

  it('rejects duplicate line ids', () => {
    expect(bad((l) => (l.lines[1].id = 'start'))).toThrow(/levels\.testCourse\.lines.*duplicate/i);
  });
});

describe('reverse top speed fraction', () => {
  it('must be at most 1', () => {
    const r = raw();
    r.constants.reverseTopSpeedFraction = 1.5;
    expect(() => validateContent(r)).toThrow(/constants\.reverseTopSpeedFraction.*at most 1/);
  });
});

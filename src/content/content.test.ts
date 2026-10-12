import { describe, expect, it } from 'vitest';
import { content, validateContent } from './index.ts';
import rawConstants from './constants.json';
import rawSurfaces from './surfaces.json';
import rawParts from './parts.json';
import rawPowerUps from './powerUps.json';
import rawMissions from './missions.json';

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
  });

describe('content data', () => {
  it('loads the Inputs sheet values', () => {
    expect(content.constants.stepsPerSecond).toBe(120);
    expect(content.constants.maxBrakeForceN).toBe(1500);
    expect(content.constants.turnRateDegPerS).toBe(60);
    expect(content.surfaces.map((s) => s.id)).toEqual(['asphalt', 'sand', 'ice']);
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

  it('rejects the old cost name', () => {
    const r = raw();
    delete r.parts[0].unlockCost;
    r.parts[0].knowledgeCost = 15;
    expect(() => validateContent(r)).toThrow(/unlockCost/);
  });
});

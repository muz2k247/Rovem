import { describe, expect, it } from 'vitest';
import { classifyStop, runMission1, runMission2, runMission3 } from './missions.ts';
import { constants, rover, surface } from './testHelpers.ts';

const m1 = { asphaltRouteLengthM: 100, sandRouteLengthM: 85, timeLimitS: 9 };
const m2 = { iceLengthM: 25, iceTimeLimitS: 8, coastTargetM: 17.5 };
const m3 = { approachSpeedMps: 15, zoneLengthM: 6, brakeLineBeforeZoneEndM: 23 };

describe('starting build, ideal driving', () => {
  it('Mission 1: 100 m on asphalt in 8.500 s', () => {
    const r = runMission1(rover(), surface('asphalt'), m1.asphaltRouteLengthM, constants);
    expect(r.timeS).toBeCloseTo(8.5, 3);
  });
  it('Mission 1: 85 m on sand in 8.150 s', () => {
    const r = runMission1(rover(), surface('sand'), m1.sandRouteLengthM, constants);
    expect(r.timeS).toBeCloseTo(8.15, 3);
  });
  it('Mission 1 reports a whole number of steps and the speeds needed for the results', () => {
    const r = runMission1(rover(), surface('asphalt'), m1.asphaltRouteLengthM, constants);
    expect(r.timeS * 120).toBeCloseTo(Math.round(r.timeS * 120), 6);
    expect(r.endSpeedMps).toBeGreaterThan(0);
    expect(r.topSpeedMps).toBeLessThanOrEqual(16);
    expect(r.topSpeedMps).toBeGreaterThanOrEqual(r.endSpeedMps);
  });
  it('Mission 2: ice 7.642 s, coast 18.770 m', () => {
    const r = runMission2(rover(), surface('ice'), surface('sand'), m2, constants);
    expect(r.iceTimeS).toBeCloseTo(7.642, 3);
    expect(r.coastDistanceM).toBeCloseTo(18.77, 3);
  });
  it('Mission 3: stops 18.767 m after the brake input', () => {
    const r = runMission3(rover(), surface('asphalt'), m3, constants);
    expect(r.stoppingDistanceM).toBeCloseTo(18.767, 3);
  });
});

describe('Mission 3 zone rule (DECISIONS OI-8)', () => {
  // Zone end 23 m after the brake line, zone 6 m long, rover 2 m: inside from 19 m to 23 m.
  const zone = { zoneEndM: 23, zoneLengthM: 6, roverLengthM: 2 };
  it('inside, short and past', () => {
    expect(classifyStop(19, zone)).toBe('inside');
    expect(classifyStop(23, zone)).toBe('inside');
    expect(classifyStop(18.999, zone)).toBe('short');
    expect(classifyStop(23.001, zone)).toBe('past');
  });
});

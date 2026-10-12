import { describe, expect, it } from 'vitest';
import { content } from '../src/content/index.ts';
import { physicsConstants, roverFromParts, surfaceSpec } from '../src/game/buildFromParts.ts';
import { runMission1, runMission2, runMission3 } from '../src/physics/missions.ts';
import fixture from './fixtures/simulation.json';

// T10: all 135 values of the Simulation sheet, each within 0.0005 (DECISIONS OI-3).
const TOLERANCE = 0.0005;
const c = physicsConstants(content);
const { mission1, mission2, mission3 } = content.missions;

describe('T10 sheet regression', () => {
  it('has 27 builds', () => expect(fixture).toHaveLength(27));

  describe.each(fixture)('$chassisId + $wheelsId + $motorId', (row) => {
    const rover = roverFromParts(content, row);
    it('Mission 1, asphalt route', () => {
      const r = runMission1(rover, surfaceSpec(content, 'asphalt'), mission1.asphaltRouteLengthM, c);
      expect(Math.abs(r.timeS - row.mission1AsphaltS)).toBeLessThanOrEqual(TOLERANCE);
    });
    it('Mission 1, sand shortcut', () => {
      const r = runMission1(rover, surfaceSpec(content, 'sand'), mission1.sandRouteLengthM, c);
      expect(Math.abs(r.timeS - row.mission1SandS)).toBeLessThanOrEqual(TOLERANCE);
    });
    it('Mission 2, ice time and coasting distance', () => {
      const r = runMission2(rover, surfaceSpec(content, 'ice'), surfaceSpec(content, 'sand'), mission2, c);
      expect(Math.abs(r.iceTimeS - row.mission2IceS)).toBeLessThanOrEqual(TOLERANCE);
      expect(Math.abs(r.coastDistanceM - row.mission2CoastM)).toBeLessThanOrEqual(TOLERANCE);
    });
    it('Mission 3, stopping distance', () => {
      const r = runMission3(rover, surfaceSpec(content, 'asphalt'), mission3, c);
      expect(Math.abs(r.stoppingDistanceM - row.mission3StopM)).toBeLessThanOrEqual(TOLERANCE);
    });
  });
});

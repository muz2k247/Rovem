import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { buildQuantities } from '../physics/build.ts';
import { roverFromParts, STARTING_BUILD, surfaceSpec } from './buildFromParts.ts';
import { formatAcceleration, formatForce, formatMass, formatSpeed, MISSION_1_SURFACE_IDS, ownedPartIds, partEffects } from './partEffects.ts';

const table = partEffects(content, STARTING_BUILD, MISSION_1_SURFACE_IDS);
const [asphalt, sand] = table;

describe('part effects table, starting build (M3 done-when)', () => {
  it('has one column for asphalt and one for sand', () => {
    expect(table.map((c) => c.surfaceId)).toEqual(['asphalt', 'sand']);
  });
  it('mass 209 kg and weight 2048 N on both surfaces', () => {
    for (const col of table) {
      expect(formatMass(col.quantities.massKg)).toBe('209 kg');
      expect(formatForce(col.quantities.weightN)).toBe('2048 N');
    }
  });
  it('maximum acceleration 4.59 and 3.61 m/s²', () => {
    expect(formatAcceleration(asphalt!.quantities.maxAccelerationMps2)).toBe('4.59 m/s²');
    expect(formatAcceleration(sand!.quantities.maxAccelerationMps2)).toBe('3.61 m/s²');
  });
  it('maximum braking 7.37 and 6.08 m/s²', () => {
    expect(formatAcceleration(asphalt!.quantities.maxBrakingMps2)).toBe('7.37 m/s²');
    expect(formatAcceleration(sand!.quantities.maxBrakingMps2)).toBe('6.08 m/s²');
  });
  it('rolling friction 41 N / 246 N, grip limit 1639 N / 1024 N, driving force 1000 N, top speed 16 m/s', () => {
    expect(formatForce(asphalt!.quantities.rollingForceN)).toBe('41 N');
    expect(formatForce(sand!.quantities.rollingForceN)).toBe('246 N');
    expect(formatForce(asphalt!.quantities.gripLimitN)).toBe('1639 N');
    expect(formatForce(sand!.quantities.gripLimitN)).toBe('1024 N');
    expect(formatForce(asphalt!.driveForceMaxN)).toBe('1000 N');
    expect(formatSpeed(asphalt!.quantities.topSpeedMps)).toBe('16.00 m/s');
  });
});

describe('the table uses the physics module (FR-3)', () => {
  it('equals buildQuantities for every one of the 27 builds on both surfaces', () => {
    const ids = (slot: string) => content.parts.filter((p) => p.slot === slot).map((p) => p.id);
    for (const chassisId of ids('chassis'))
      for (const wheelsId of ids('wheels'))
        for (const motorId of ids('motor')) {
          const selection = { chassisId, wheelsId, motorId };
          const rover = roverFromParts(content, selection);
          partEffects(content, selection, MISSION_1_SURFACE_IDS).forEach((col) => {
            const direct = buildQuantities(rover, surfaceSpec(content, col.surfaceId), content.constants);
            expect(col.quantities).toEqual(direct);
            expect(col.driveForceMaxN).toBe(rover.driveForceMaxN);
          });
        }
  });
});

describe('which parts are available', () => {
  it('before M7, only the three starting parts are owned', () => {
    expect([...ownedPartIds(content)].sort()).toEqual(['chassis-standard', 'motor-medium', 'wheels-all-terrain']);
  });
});

describe('display rounding', () => {
  it('shows whole numbers and 2 decimals as the conventions say', () => {
    expect(formatForce(40.6)).toBe('41 N');
    expect(formatAcceleration(4.5876)).toBe('4.59 m/s²');
  });
});

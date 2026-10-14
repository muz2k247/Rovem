import { describe, expect, it } from 'vitest';
import { applyMultiplier, buildQuantities } from './build.ts';
import { constants, rover, surface } from '../../tests/helpers/physics.ts';

const close = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(1e-9);

describe('T1 build quantities (starting build)', () => {
  it('mass and weight', () => {
    const q = buildQuantities(rover(), surface('asphalt'), constants);
    expect(q.massKg).toBe(209);
    close(q.weightN, 2048.2);
  });
  it('asphalt', () => {
    const q = buildQuantities(rover(), surface('asphalt'), constants);
    close(q.rollingForceN, 40.964);
    close(q.gripLimitN, 1638.56);
  });
  it('sand', () => {
    const q = buildQuantities(rover(), surface('sand'), constants);
    close(q.rollingForceN, 245.784);
    close(q.gripLimitN, 1024.1);
  });
  it('ice', () => {
    const q = buildQuantities(rover(), surface('ice'), constants);
    close(q.rollingForceN, 20.482);
    close(q.gripLimitN, 204.82);
  });
});

describe('T2 max acceleration', () => {
  it.each([
    ['asphalt', 4.588688995],
    ['sand', 3.608688995],
    ['ice', 0.882],
  ])('%s', (id, expected) => {
    close(buildQuantities(rover(), surface(id), constants).maxAccelerationMps2, expected);
  });
});

describe('T3 max braking', () => {
  it.each([
    ['asphalt', 7.373033493],
    ['sand', 6.076],
    ['ice', 1.078],
  ])('%s', (id, expected) => {
    close(buildQuantities(rover(), surface(id), constants).maxBrakingMps2, expected);
  });
});

describe('power-up multipliers', () => {
  it('change only their own variable', () => {
    const base = rover();
    const boosted = applyMultiplier(base, 'driveForceMaxN', 1.2);
    expect(boosted.driveForceMaxN).toBeCloseTo(1200, 9);
    expect({ ...boosted, driveForceMaxN: 0 }).toEqual({ ...base, driveForceMaxN: 0 });
  });
  it('Lighter load scales mass, and so weight, rolling friction and grip limit', () => {
    const base = buildQuantities(rover(), surface('asphalt'), constants);
    const light = buildQuantities(applyMultiplier(rover(), 'massKg', 0.9), surface('asphalt'), constants);
    close(light.massKg, base.massKg * 0.9);
    close(light.rollingForceN, base.rollingForceN * 0.9);
    close(light.gripLimitN, base.gripLimitN * 0.9);
  });
});

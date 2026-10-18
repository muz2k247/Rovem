import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { roverOf, rover } from '../../../tests/helpers/physics.ts';
import { garageNumbers } from './garageNumbers.ts';

const close = (actual: number, expected: number) => expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(1e-9);

describe('garage numbers (hand-checked, starting build: 209 kg, 1000 N, 16 m/s, asphalt)', () => {
  const n = garageNumbers(content, rover());

  it('mass and top speed', () => {
    expect([n.massKg, n.topSpeedMps]).toEqual([209, 16]);
  });
  it('acceleration on asphalt: (1000 − 0.02 × 209 × 9.8) ÷ 209 = 4.5900 m/s²', () => {
    close(n.accelerationMps2, (1000 - 0.02 * 209 * 9.8) / 209);
    expect(n.accelerationMps2.toFixed(2)).toBe('4.59');
  });
  it('safe speed in a 25 m corner: √(μ_g k_g g r) = √(0.8 × 9.8 × 25) = 14.0 m/s', () => {
    close(n.cornerSpeedMps, Math.sqrt(0.8 * 9.8 * 25));
    expect(n.cornerRadiusM).toBe(25);
  });
  it('deep water: 209 kg in 0.2 m³ is 1045 kg/m³, denser than water, so it sinks', () => {
    close(n.water.densityKgPerM3, 1045);
    expect(n.water.floats).toBe(false);
  });
});

describe('every part moves the numbers the way the physics says', () => {
  const std = { chassisId: 'chassis-standard', wheelsId: 'wheels-all-terrain', motorId: 'motor-medium' };
  it('the Heavy body adds mass and slows the acceleration, but the safe corner speed stays the same (grip grows with weight)', () => {
    const base = garageNumbers(content, roverOf(std));
    const heavy = garageNumbers(content, roverOf({ ...std, chassisId: 'chassis-heavy' }));
    expect(heavy.massKg).toBe(269);
    expect(heavy.accelerationMps2).toBeLessThan(base.accelerationMps2);
    close(heavy.cornerSpeedMps, base.cornerSpeedMps); // m cancels: v = √(μ_g k_g g r)
    expect(heavy.water.floats).toBe(false);
  });
  it('Spiked wheels (grip ×1.4) corner at √1.4 times the speed of All-terrain', () => {
    const base = garageNumbers(content, roverOf(std));
    const spiked = garageNumbers(content, roverOf({ ...std, wheelsId: 'wheels-spiked' }));
    close(spiked.cornerSpeedMps, base.cornerSpeedMps * Math.sqrt(1.4));
  });
  it('Smooth wheels corner slower: grip ×0.8', () => {
    const base = garageNumbers(content, roverOf(std));
    const smooth = garageNumbers(content, roverOf({ ...std, wheelsId: 'wheels-smooth' }));
    close(smooth.cornerSpeedMps, base.cornerSpeedMps * Math.sqrt(0.8));
  });
  it('the Light body with Smooth wheels and the Small motor (151 kg, 755 kg/m³) floats', () => {
    const light = garageNumbers(content, roverOf({ chassisId: 'chassis-light', wheelsId: 'wheels-smooth', motorId: 'motor-small' }));
    expect(light.massKg).toBe(151);
    close(light.water.densityKgPerM3, 755);
    expect(light.water.floats).toBe(true);
  });
  it('199 kg is 995 kg/m³, just under the 1000 of water, so it floats', () => {
    const small = garageNumbers(content, roverOf({ ...std, motorId: 'motor-small' }));
    expect(small.massKg).toBe(199);
    expect(small.water.floats).toBe(true);
  });
});

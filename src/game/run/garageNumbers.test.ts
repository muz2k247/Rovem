import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { roverOf, rover } from '../../../tests/helpers/physics.ts';
import { garageNumbers } from './garageNumbers.ts';

const close = (actual: number, expected: number) => expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(1e-9);

describe('garage numbers (hand-checked, starting build: 209 kg, 1000 N, 16 m/s)', () => {
  const n = garageNumbers(content, rover());

  it('mass, motor force and top speed', () => {
    expect([n.massKg, n.motorForceN, n.topSpeedMps]).toEqual([209, 1000, 16]);
  });
  it('in mud the friction beats the motor', () => {
    close(n.mud.frictionN, 1228.92); // 0.6 × 1 × 209 × 9.8
    expect(n.mud.motorN).toBe(1000);
    expect(n.mud.verdict).toBe('you slow down');
  });
  it('boost gains J/m', () => close(n.boostGainMps, 1200 / 209));
  it('a head-on sandbag takes the rover from 16 to 11.823293 m/s', () => {
    expect(n.sandbag.fromMps).toBe(16);
    close(n.sandbag.toMps, (209 * 16 - 40 * 10) / 249);
  });
  it('weight in low and high gravity', () => {
    close(n.weightLowN, 209 * 9.8 * 0.5);
    close(n.weightHighN, 209 * 9.8 * 2);
  });
  it('the Light/Smooth/Small build pushes through mud (A5: it does not slow)', () => {
    const light = garageNumbers(content, roverOf({ chassisId: 'chassis-light', wheelsId: 'wheels-smooth', motorId: 'motor-small' }));
    expect(light.mud.verdict).toBe('you push through');
  });
});

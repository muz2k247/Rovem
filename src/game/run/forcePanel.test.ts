import { describe, expect, it } from 'vitest';
import { constants, rover, surface } from '../../../tests/helpers/physics.ts';
import { createState, step } from '../../physics/step.ts';
import { forcePanel } from './forcePanel.ts';

const HOLD = { throttleHeld: true, brakeHeld: false, steer: 0 as const };
const g = constants.gravityMps2;
const FR = 0.02 * 209 * 9.8;

describe('force panel', () => {
  it('says "Balanced: constant speed" at top speed on asphalt, with motor = friction = F_r', () => {
    const s = step(createState({ speedMps: 16, throttleLevel: 1 }), HOLD, rover(), surface('asphalt'), constants);
    expect(s.drivingState).toBe('At top speed');
    const p = forcePanel(s, rover(), surface('asphalt'), g);
    expect(p.motor.valueN).toBeCloseTo(FR, 9);
    expect(p.friction.valueN).toBeCloseTo(FR, 9);
    expect(p.balancedLabel).toBe('Balanced: constant speed');
    expect(p.friction.label).toBe('Friction');
  });

  it('"Balanced: constant speed" needs v > 0: at rest with equal arrows it stays off, at 0.01 m/s on the same forces it shows', () => {
    const rest = step(createState({ throttleLevel: 0 }), HOLD, rover(), surface('asphalt'), constants);
    expect(forcePanel({ ...rest, speedMps: 0, drivingState: 'At top speed' }, rover(), surface('asphalt'), g).balancedLabel).toBeUndefined();
    expect(forcePanel({ ...rest, speedMps: 0.01, drivingState: 'At top speed' }, rover(), surface('asphalt'), g).balancedLabel).toBe('Balanced: constant speed');
  });

  it('while driving shows the drive force against friction, not balanced', () => {
    const s = step(createState({ speedMps: 5, throttleLevel: 1 }), HOLD, rover(), surface('asphalt'), constants);
    const p = forcePanel(s, rover(), surface('asphalt'), g);
    expect(p.motor.valueN).toBe(1000);
    expect(p.friction.valueN).toBeCloseTo(FR, 9);
    expect(p.balancedLabel).toBeUndefined();
  });

  it('coasting above top speed shows motor 0', () => {
    const s = step(createState({ speedMps: 20, throttleLevel: 1 }), HOLD, rover(), surface('asphalt'), constants);
    const p = forcePanel(s, rover(), surface('asphalt'), g);
    expect(p.motor.valueN).toBe(0);
    expect(p.friction.valueN).toBeCloseTo(FR, 9);
  });

  it('stopped in mud: friction shows min(F_r, drive force) so the arrows are equal, yet it does not say Balanced', () => {
    const mud = { rollingFriction: 0.6, grip: 0.5 };
    const s = step(createState({ throttleLevel: 1 }), HOLD, rover(), mud, constants);
    expect(s.drivingState).toBe('Stopped');
    const p = forcePanel(s, rover(), mud, g);
    expect(p.motor.valueN).toBe(1000);
    expect(p.friction.valueN).toBe(1000);
    expect(p.balancedLabel).toBeUndefined(); // the arrows are equal, but nothing is moving: not "constant speed"
  });

  it('braking reads "Brake + friction" = F_b + F_r', () => {
    const brake = { throttleHeld: false, brakeHeld: true, steer: 0 as const };
    const s = step(createState({ speedMps: 10, brakeLevel: 1 }), brake, rover(), surface('asphalt'), constants);
    const p = forcePanel(s, rover(), surface('asphalt'), g);
    expect(p.friction.label).toBe('Brake + friction');
    expect(p.friction.valueN).toBeCloseTo(s.brakeForceN + FR, 9);
  });

  it('weight and ground push are mg, and scale with gravity; arrow lengths are capped', () => {
    const s = createState({ speedMps: 16 });
    const low = forcePanel(s, rover(), surface('asphalt'), g * 0.5);
    const high = forcePanel(s, rover(), surface('asphalt'), g * 2);
    expect(Math.round(high.weight.valueN)).toBe(4096);
    expect(high.groundPush.valueN).toBe(high.weight.valueN);
    expect(high.weight.label).toBe('Weight');
    expect(high.groundPush.label).toBe('Ground push'); // two arrows, each with its own label and number
    expect(low.weight.valueN * 4).toBeCloseTo(high.weight.valueN, 9);
    expect(high.weight.lengthFraction).toBeCloseTo(4096.4 / 6000, 3);
    const big = forcePanel(createState({ speedMps: 1, throttleLevel: 1, driveForceN: 9000 }), rover(), surface('asphalt'), g);
    expect(big.motor.lengthFraction).toBe(1);
  });
});

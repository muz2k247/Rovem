import { describe, expect, it } from 'vitest';
import { applyImpulse, shareMomentum } from './momentum.ts';
import { createState } from './step.ts';

const closeRounded = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(1e-5);
const close = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(1e-9);

const M = 209; // starting build

describe('applyImpulse: u′ = u + J/m', () => {
  it('boost J = 1200 N·s from 16 m/s gives 21.741627 m/s', () => {
    const s = applyImpulse(createState({ speedMps: 16, throttleLevel: 1 }), M, 1200);
    close(s.speedMps, 16 + 1200 / 209);
    closeRounded(s.speedMps, 21.741627);
    expect(s.direction).toBe('forward');
  });
  it('changes nothing but speed and direction', () => {
    const before = createState({ speedMps: 16, throttleLevel: 1, headingRad: 0.2, positionXM: 7, distanceM: 9 });
    const after = applyImpulse(before, M, 1200);
    expect({ ...after, speedMps: before.speedMps }).toEqual(before);
  });
  it('does not change the input state', () => {
    const before = createState({ speedMps: 16 });
    applyImpulse(before, M, 1200);
    expect(before.speedMps).toBe(16);
  });
  it('a push along a reversing rover slows it (signed velocity)', () => {
    const s = applyImpulse(createState({ speedMps: 4, direction: 'reverse' }), M, 209);
    close(s.speedMps, 3); // u = −4, u′ = −3
    expect(s.direction).toBe('reverse');
  });
  it('an impulse against the motion that overshoots flips the direction', () => {
    const s = applyImpulse(createState({ speedMps: 1 }), M, -418);
    close(s.speedMps, 1); // u′ = 1 − 2 = −1
    expect(s.direction).toBe('reverse');
  });
});

describe('shareMomentum: m₁u₁ + m₂u₂ = (m₁ + m₂)u′', () => {
  it('head-on bag, 40 kg at 10 m/s, from 16 m/s gives 11.823293 m/s', () => {
    const s = shareMomentum(createState({ speedMps: 16 }), M, 40, -10);
    close(s.speedMps, (209 * 16 - 40 * 10) / 249);
    closeRounded(s.speedMps, 11.823293);
    expect(s.direction).toBe('forward');
  });
  it('kicker bag, 40 kg at 30 m/s, from 16 m/s gives 18.248996 m/s', () => {
    const s = shareMomentum(createState({ speedMps: 16 }), M, 40, 30);
    close(s.speedMps, (209 * 16 + 40 * 30) / 249);
    closeRounded(s.speedMps, 18.248996);
  });
  it('head-on bag at 1 m/s pushes the rover into reverse at 0.767068 m/s', () => {
    const s = shareMomentum(createState({ speedMps: 1 }), M, 40, -10);
    close(s.speedMps, 191 / 249);
    closeRounded(s.speedMps, 0.767068);
    expect(s.direction).toBe('reverse');
  });
  it('u′ = 0 stops the rover and keeps its direction', () => {
    const s = shareMomentum(createState({ speedMps: 4 }), 100, 50, -8);
    expect(s.speedMps).toBe(0);
    expect(s.direction).toBe('forward');
    const r = shareMomentum(createState({ speedMps: 4, direction: 'reverse' }), 100, 50, 8);
    expect(r.speedMps).toBe(0);
    expect(r.direction).toBe('reverse');
  });
  it('a reversing rover hit from behind uses signed velocity', () => {
    // u = −2, bag +6: (100·(−2) + 50·6)/150 = 100/150
    const s = shareMomentum(createState({ speedMps: 2, direction: 'reverse' }), 100, 50, 6);
    close(s.speedMps, 100 / 150);
    expect(s.direction).toBe('forward');
  });
  it('changes nothing but speed and direction', () => {
    const before = createState({ speedMps: 16, headingRad: 0.1, positionXM: 3, brakeLevel: 0.2 });
    const after = shareMomentum(before, M, 40, -10);
    expect({ ...after, speedMps: before.speedMps }).toEqual(before);
  });
});
